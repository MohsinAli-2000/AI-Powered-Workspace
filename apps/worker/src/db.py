import json
import logging
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
import psycopg2
from psycopg2 import pool
from psycopg2.extras import execute_values, RealDictCursor

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
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=settings.DB_POOL_MIN,
            maxconn=settings.DB_POOL_MAX,
            dsn=settings.DATABASE_URL
        )
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
    """Context manager for acquiring a connection and cursor from the pool."""
    p = get_connection_pool()
    conn = p.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            yield cursor
        if commit:
            conn.commit()
    except Exception as e:
        if not conn.closed:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        p.putconn(conn)


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



def save_document_chunks(
    version_id: str,
    chunks: List[Dict[str, Any]]
) -> int:
    """
    Idempotently save document chunks:
    1. Removes any existing chunks for this version_id.
    2. Bulk inserts the new chunks.
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
                json.dumps(c.get("metadata", {}))
            )
            for c in chunks
        ]

        query = """
            INSERT INTO document_chunks (
                document_version_id,
                chunk_index,
                content,
                page_number,
                metadata
            ) VALUES %s
        """
        execute_values(cur, query, records)
        return len(chunks)
