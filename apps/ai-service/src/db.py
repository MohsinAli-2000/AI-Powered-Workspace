import asyncio
import uuid
from typing import Any, Optional
import asyncpg
from pgvector.asyncpg import register_vector
from src.config import settings
from src.logger import logger

_db_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()

# Errors that mean "this pooled connection went away" (Neon suspends idle compute / recycles pooler links).
_CONNECTION_ERRORS = (
    asyncpg.PostgresConnectionError,
    asyncpg.InterfaceError,
    ConnectionResetError,
    OSError,
)

__all__ = [
    "get_db_pool",
    "close_db_pool",
    "check_db_health",
    "search_authorized_chunks",
]


async def init_connection(conn: asyncpg.Connection) -> None:
    """
    Initializes each connection in the pool by registering the pgvector extension type.
    """
    await register_vector(conn)


async def get_db_pool() -> asyncpg.Pool:
    """
    Returns the singleton asyncpg database pool, initializing it if necessary.
    """
    global _db_pool
    if _db_pool is not None:
        return _db_pool
    # The lock prevents concurrent first requests from each creating (and leaking) their own pool.
    async with _pool_lock:
        if _db_pool is None:
            logger.info("Initializing asyncpg connection pool...")
            _db_pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=1,
                max_size=10,
                init=init_connection,
                timeout=30.0,
                command_timeout=30.0,
                # Drop connections before Neon's idle timeout does it for us.
                max_inactive_connection_lifetime=60.0,
                # Neon's `-pooler` endpoint is PgBouncer; named prepared statements are not safe there.
                statement_cache_size=0,
            )
            logger.info("asyncpg connection pool initialized successfully.")
    return _db_pool


async def close_db_pool() -> None:
    """
    Gracefully closes the database connection pool.
    """
    global _db_pool
    if _db_pool is not None:
        logger.info("Closing asyncpg connection pool...")
        await _db_pool.close()
        _db_pool = None
        logger.info("asyncpg connection pool closed.")


async def check_db_health() -> bool:
    """
    Performs a lightweight ping against PostgreSQL to verify connectivity.
    """
    try:
        async def _ping() -> bool:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                return await conn.fetchval("SELECT 1;") == 1

        return await asyncio.wait_for(_ping(), timeout=8.0)
    except Exception as exc:
        logger.error(f"Database health check failed: {exc}")
        return False


async def search_authorized_chunks(
    query_vector: list[float],
    organization_id: str,
    authorized_project_ids: list[str],
    threshold: float,
    top_k: int,
    user_id: Optional[str] = None,
    is_org_owner: bool = False,
) -> list[dict[str, Any]]:
    """
    Performs authorization-aware pgvector similarity search matching Phase 13 specifications.

    Guarantees:
    1. Hard Tenant Isolation: p.organization_id = $2
    2. Document Readiness: dv.status = 'READY' AND dv.is_current = true
    3. Project Scope: p.id = ANY($3::uuid[])
    4. Similarity Threshold: (1 - (c.embedding <=> $1)) >= $4
    5. Document Access Control with DENY Precedence:
       - If d.access_mode = 'PROJECT' -> accessible to all project members
       - If is_org_owner = true -> global administrative bypass
       - If d.access_mode = 'RESTRICTED' -> evaluates 6-step pipeline:
           * Rejects if ANY matching rule is DENY (user, group, org role, project role)
           * Grants if ANY matching rule is ALLOW
    """
    if not authorized_project_ids:
        return []

    pool = await get_db_pool()

    # Convert IDs (str or UUID) to UUIDs for asyncpg parameterized binding
    org_uuid = uuid.UUID(str(organization_id))
    project_uuids = [uuid.UUID(str(pid)) for pid in authorized_project_ids]
    user_uuid = uuid.UUID(str(user_id)) if user_id else None

    sql = """
      SELECT
        c.id AS chunk_id,
        c.content,
        c.chunk_index,
        c.page_number,
        d.id AS document_id,
        d.name AS document_name,
        p.id AS project_id,
        p.name AS project_name,
        (1 - (c.embedding <=> $1))::float AS similarity
      FROM document_chunks c
      JOIN document_versions dv ON c.document_version_id = dv.id
      JOIN documents d ON dv.document_id = d.id
      JOIN projects p ON d.project_id = p.id
      WHERE p.organization_id = $2
        AND dv.status = 'READY'
        AND dv.is_current = true
        AND c.embedding IS NOT NULL
        AND p.id = ANY($3::uuid[])
        AND (1 - (c.embedding <=> $1)) >= $4
        AND (
          d.access_mode = 'PROJECT'
          OR $6::boolean = true
          OR (
            d.access_mode = 'RESTRICTED'
            AND $7::uuid IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM (
                SELECT effect FROM document_user_access WHERE document_id = d.id AND user_id = $7
                UNION ALL
                SELECT dga.effect FROM document_group_access dga
                JOIN group_memberships gm ON dga.group_id = gm.group_id
                WHERE dga.document_id = d.id AND gm.user_id = $7
                UNION ALL
                SELECT dora.effect FROM document_org_role_access dora
                JOIN organization_memberships om ON dora.role = om.role
                WHERE dora.document_id = d.id AND om.user_id = $7 AND om.organization_id = $2
                UNION ALL
                SELECT dpra.effect FROM document_project_role_access dpra
                JOIN project_memberships pm ON dpra.role = pm.role
                WHERE dpra.document_id = d.id AND pm.user_id = $7 AND pm.project_id = d.project_id
              ) r_deny WHERE effect = 'DENY'
            )
            AND EXISTS (
              SELECT 1 FROM (
                SELECT effect FROM document_user_access WHERE document_id = d.id AND user_id = $7
                UNION ALL
                SELECT dga.effect FROM document_group_access dga
                JOIN group_memberships gm ON dga.group_id = gm.group_id
                WHERE dga.document_id = d.id AND gm.user_id = $7
                UNION ALL
                SELECT dora.effect FROM document_org_role_access dora
                JOIN organization_memberships om ON dora.role = om.role
                WHERE dora.document_id = d.id AND om.user_id = $7 AND om.organization_id = $2
                UNION ALL
                SELECT dpra.effect FROM document_project_role_access dpra
                JOIN project_memberships pm ON dpra.role = pm.role
                WHERE dpra.document_id = d.id AND pm.user_id = $7 AND pm.project_id = d.project_id
              ) r_allow WHERE effect = 'ALLOW'
            )
          )
        )
      ORDER BY c.embedding <=> $1 ASC
      LIMIT $5;
    """

    async def _run() -> list[Any]:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # An HNSW index returns only the ~40 globally nearest rows and the tenant/access filters
                # run afterwards, which can starve results. Iterative scans keep reading until enough rows
                # pass the filters (pgvector >= 0.8). Ignore the setting where it isn't supported.
                try:
                    async with conn.transaction():
                        await conn.execute(
                            "SELECT set_config('hnsw.iterative_scan', 'strict_order', true)"
                        )
                except asyncpg.PostgresError:
                    pass
                return await conn.fetch(
                    sql,
                    query_vector,
                    org_uuid,
                    project_uuids,
                    threshold,
                    top_k,
                    is_org_owner,
                    user_uuid,
                )

    try:
        rows = await _run()
    except _CONNECTION_ERRORS as exc:
        # A stale pooled connection (Neon idle suspend) fails once; the retry gets a fresh one.
        logger.warning(f"Database connection error during search ({exc!r}); retrying once.")
        rows = await _run()

    return [
        {
            "chunk_id": str(row["chunk_id"]),
            "content": row["content"],
            "chunk_index": row["chunk_index"],
            "page_number": row["page_number"],
            "document_id": str(row["document_id"]),
            "document_name": row["document_name"],
            "project_id": str(row["project_id"]),
            "project_name": row["project_name"],
            "similarity": float(row["similarity"]),
        }
        for row in rows
    ]
