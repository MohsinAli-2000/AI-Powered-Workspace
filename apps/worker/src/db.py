import json
import logging
import time
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
import psycopg2
from psycopg2 import pool
from psycopg2.extras import execute_values, RealDictCursor
from pgvector.psycopg2 import register_vector

from src.config import settings

logger = logging.getLogger(__name__)

# Connection pool
_connection_pool: Optional[pool.ThreadedConnectionPool] = None


def get_connection_pool() -> pool.ThreadedConnectionPool:
    """Thread-safe connection pool singleton."""
    global _connection_pool
    if _connection_pool is None or _connection_pool.closed:
        logger.info(
            f"Initializing ThreadedConnectionPool (min={settings.DB_POOL_MIN}, max={settings.DB_POOL_MAX})..."
        )
        last_error: Optional[Exception] = None
        # Neon wakes suspended compute on the first connection, which can fail or take several seconds.
        for attempt in range(1, 4):
            try:
                _connection_pool = pool.ThreadedConnectionPool(
                    minconn=settings.DB_POOL_MIN,
                    maxconn=settings.DB_POOL_MAX,
                    dsn=settings.DATABASE_URL,
                    connect_timeout=20,
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=10,
                    keepalives_count=5,
                )
                last_error = None
                break
            except psycopg2.OperationalError as exc:
                last_error = exc
                logger.warning(f"Database connection failed (attempt {attempt}/3): {exc}")
                time.sleep(2 * attempt)
        if last_error is not None:
            raise last_error
    return _connection_pool


def close_connection_pool() -> None:
    """Closes all connections in the pool gracefully upon service shutdown."""
    global _connection_pool
    if _connection_pool is not None and not _connection_pool.closed:
        logger.info("Closing database connection pool...")
        _connection_pool.closeall()
        _connection_pool = None


@contextmanager
def get_db_cursor(commit: bool = True):
    """Context manager for acquiring a connection and cursor from the pool with pgvector registered."""
    p = get_connection_pool()
    conn = p.getconn()
    # A pooled connection can have been closed by the server while idle (Neon suspend, long embedding run).
    if conn.closed:
        p.putconn(conn, close=True)
        conn = p.getconn()
    try:
        register_vector(conn)
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            yield cursor
        if commit:
            conn.commit()
    except Exception as e:
        if not conn.closed:
            try:
                conn.rollback()
            except Exception:
                pass
        logger.error(f"Database error: {e}")
        raise
    finally:
        # Throw broken connections away instead of returning them to the pool.
        p.putconn(conn, close=bool(conn.closed))


def ensure_vector_schema(dimension: Optional[int] = None) -> None:
    """
    Idempotently configures pgvector extension, typed embedding column,
    and HNSW cosine similarity index.
    """
    dim = dimension or settings.EMBEDDING_DIMENSION
    logger.info(f"Ensuring pgvector schema (dimension={dim})...")
    with get_db_cursor(commit=True) as cur:
        # 1. Enable extension
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # 2. Check current dimension of document_chunks.embedding
        cur.execute(
            """
            SELECT atttypmod
            FROM pg_attribute
            WHERE attrelid = 'document_chunks'::regclass
              AND attname = 'embedding';
            """
        )
        row = cur.fetchone()
        current_typmod = row["atttypmod"] if row else None

        # In PostgreSQL pgvector, vector(dim) typmod is dim. Unconstrained is -1.
        if current_typmod != dim:
            logger.info(f"Altering document_chunks.embedding to vector({dim})...")
            cur.execute(f"ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector({dim});")

        # 3. Ensure HNSW index on embedding column
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
            ON document_chunks
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
            """
        )
        logger.info("HNSW index verified.")


def get_document_version(version_id: str) -> Optional[Dict[str, Any]]:
    """Fetch document version details by ID."""
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """
            SELECT id, document_id, version_number, storage_key,
                   original_filename, mime_type, file_size, status
            FROM document_versions
            WHERE id = %s
            """,
            (version_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None


def update_version_status(
    version_id: str,
    status: str,
    processed_at: Optional[bool] = None
) -> None:
    """
    Update document_version status (e.g. PROCESSING, READY, FAILED).
    Automatically sets processed_at = NOW() for terminal statuses (READY, FAILED),
    matching API repository convention.
    """
    is_completed = (status in ("READY", "FAILED")) if processed_at is None else processed_at
    with get_db_cursor(commit=True) as cur:
        if is_completed:
            cur.execute(
                """
                UPDATE document_versions
                SET status = %s, processed_at = NOW(), updated_at = NOW()
                WHERE id = %s
                """,
                (status, version_id)
            )
        else:
            cur.execute(
                """
                UPDATE document_versions
                SET status = %s, updated_at = NOW()
                WHERE id = %s
                """,
                (status, version_id)
            )


def claim_version_for_processing(version_id: str) -> bool:
    """
    Atomically moves a version to PROCESSING unless another run already holds it.
    Returns False when the version is already PROCESSING (a concurrent duplicate run), so the caller
    can skip instead of racing - the race previously ended with FAILED written over a successful READY.
    """
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE document_versions
            SET status = 'PROCESSING', updated_at = NOW()
            WHERE id = %s AND status <> 'PROCESSING'
            RETURNING id
            """,
            (version_id,)
        )
        return cur.fetchone() is not None


def save_chunks_and_mark_ready(version_id: str, chunks: List[Dict[str, Any]]) -> int:
    """
    Replaces the version's chunks and marks it READY in ONE transaction.
    Either everything is saved and the version is READY, or nothing changes - there is no window where
    chunks exist but the status is stale (or vice versa).
    """
    if not chunks:
        raise ValueError("Refusing to mark a version READY with zero chunks.")

    with get_db_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM document_chunks WHERE document_version_id = %s",
            (version_id,)
        )
        records = [
            (
                version_id,
                c["chunk_index"],
                c["content"],
                c.get("page_number"),
                json.dumps(c.get("metadata", {})),
                c.get("embedding")
            )
            for c in chunks
        ]
        execute_values(
            cur,
            """
            INSERT INTO document_chunks (
                document_version_id, chunk_index, content, page_number, metadata, embedding
            ) VALUES %s
            """,
            records,
            page_size=200,
        )
        cur.execute(
            """
            UPDATE document_versions
            SET status = 'READY', processed_at = NOW(), updated_at = NOW()
            WHERE id = %s
            """,
            (version_id,)
        )
        return len(chunks)


def save_document_chunks(
    version_id: str,
    chunks: List[Dict[str, Any]]
) -> int:
    """
    Idempotently save document chunks and their vector embeddings:
    1. Removes any existing chunks for this version_id.
    2. Bulk inserts the new chunks with embeddings.
    """
    if not chunks:
        return 0

    with get_db_cursor(commit=True) as cur:
        # Delete existing chunks for idempotency
        cur.execute(
            "DELETE FROM document_chunks WHERE document_version_id = %s",
            (version_id,)
        )

        # Prepare records for execute_values
        records = [
            (
                version_id,
                c["chunk_index"],
                c["content"],
                c.get("page_number"),
                json.dumps(c.get("metadata", {})),
                c.get("embedding")
            )
            for c in chunks
        ]

        query = """
            INSERT INTO document_chunks (
                document_version_id,
                chunk_index,
                content,
                page_number,
                metadata,
                embedding
            ) VALUES %s
        """
        execute_values(cur, query, records)
        return len(chunks)


def get_unembedded_chunks(limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch chunks with NULL embedding using concurrency-safe row locking.
    Useful for batch backfill worker/script.
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """
            SELECT id, document_version_id, chunk_index, content
            FROM document_chunks
            WHERE embedding IS NULL
            ORDER BY created_at ASC
            LIMIT %s
            FOR UPDATE SKIP LOCKED
            """,
            (limit,)
        )
        return [dict(row) for row in cur.fetchall()]


def update_chunks_embeddings_batch(
    updates: List[Dict[str, Any]]
) -> int:
    """
    Bulk update embeddings for existing chunks:
    updates: list of dicts with 'id' and 'embedding'
    """
    if not updates:
        return 0

    with get_db_cursor(commit=True) as cur:
        records = [(u["embedding"], u["id"]) for u in updates]
        query = """
            UPDATE document_chunks AS c
            SET embedding = v.embedding::vector
            FROM (VALUES %s) AS v(embedding, id)
            WHERE c.id = v.id::uuid
        """
        execute_values(cur, query, records)
        return len(updates)


def search_similar_chunks(
    query_vector: List[float],
    limit: int = 5,
    document_version_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Vector similarity search using pgvector cosine distance operator (<=>).
    Returns chunks ordered by semantic similarity.
    """
    with get_db_cursor(commit=False) as cur:
        if document_version_id:
            cur.execute(
                """
                SELECT id, document_version_id, chunk_index, content, page_number, metadata,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM document_chunks
                WHERE document_version_id = %s
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector ASC
                LIMIT %s;
                """,
                (query_vector, document_version_id, query_vector, limit)
            )
        else:
            cur.execute(
                """
                SELECT id, document_version_id, chunk_index, content, page_number, metadata,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM document_chunks
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector ASC
                LIMIT %s;
                """,
                (query_vector, query_vector, limit)
            )
        return [dict(row) for row in cur.fetchall()]
