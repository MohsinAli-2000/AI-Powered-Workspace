import argparse
import logging
import sys
import time
from typing import Optional

from src.config import settings
from src.db import get_unembedded_chunks, update_chunks_embeddings_batch, close_connection_pool
from src.embeddings import get_embedding_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("batch_embedder")


def run_batch_embedder(
    batch_size: int = 32,
    max_chunks: Optional[int] = None,
    provider: Optional[str] = None,
) -> int:
    """
    Backfills vector embeddings for chunks currently missing embeddings in document_chunks.
    Returns total number of chunks embedded.
    """
    client = get_embedding_client(provider=provider)
    logger.info(
        f"Starting Batch Embedder: provider={client.model_name}, dim={client.expected_dimension}, "
        f"batch_size={batch_size}, max_chunks={max_chunks or 'unlimited'}"
    )

    total_embedded = 0
    start_time = time.time()

    while True:
        limit = batch_size
        if max_chunks is not None:
            remaining = max_chunks - total_embedded
            if remaining <= 0:
                break
            limit = min(batch_size, remaining)

        chunks = get_unembedded_chunks(limit=limit)
        if not chunks:
            logger.info("No more un-embedded chunks found.")
            break

        texts = [c["content"] for c in chunks]
        vectors = client.embed_batch(texts)

        updates = [
            {"id": c["id"], "embedding": vec}
            for c, vec in zip(chunks, vectors)
        ]

        updated_count = update_chunks_embeddings_batch(updates)
        total_embedded += updated_count

        logger.info(f"Embedded batch of {updated_count} chunks (total so far: {total_embedded})")

    duration = round(time.time() - start_time, 2)
    logger.info(f"Batch embedding completed: {total_embedded} chunks embedded in {duration}s.")
    return total_embedded


def main():
    parser = argparse.ArgumentParser(description="Backfill vector embeddings for document chunks.")
    parser.add_argument("--batch-size", type=int, default=settings.EMBEDDING_BATCH_SIZE, help="Batch size")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of chunks to process")
    parser.add_argument("--provider", type=str, default=None, help="Override embedding provider (ollama/mock)")
    args = parser.parse_args()

    try:
        run_batch_embedder(
            batch_size=args.batch_size,
            max_chunks=args.limit,
            provider=args.provider,
        )
    finally:
        close_connection_pool()


if __name__ == "__main__":
    main()
