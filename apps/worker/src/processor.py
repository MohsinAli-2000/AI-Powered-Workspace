import logging
import time
from typing import Any, Dict, List, Optional

from src.config import settings
from src.db import (
    get_document_version,
    update_version_status,
    claim_version_for_processing,
    save_chunks_and_mark_ready,
)
from src.storage import storage_client
from src.extractors import get_extractor
from src.chunker import DocumentChunker
from src.embeddings import get_embedding_client, BaseEmbeddingClient

logger = logging.getLogger(__name__)


class DocumentProcessor:
    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        embedding_client: Optional[BaseEmbeddingClient] = None,
        batch_size: Optional[int] = None,
    ):
        # Everything that can fail on bad configuration (chunk sizes, API keys) is built lazily inside
        # process_version, so a config error marks the version FAILED instead of killing the process at
        # import time and leaving the document QUEUED forever.
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap
        self._embedding_client = embedding_client
        self.batch_size = batch_size or settings.EMBEDDING_BATCH_SIZE
        self._chunker: Optional[DocumentChunker] = None

    @property
    def chunker(self) -> DocumentChunker:
        if self._chunker is None:
            self._chunker = DocumentChunker(chunk_size=self._chunk_size, chunk_overlap=self._chunk_overlap)
        return self._chunker

    @property
    def embedding_client(self) -> BaseEmbeddingClient:
        if self._embedding_client is None:
            self._embedding_client = get_embedding_client()
        return self._embedding_client

    def process_version(self, version_id: str) -> Dict[str, Any]:
        """
        Orchestrates full processing for a document version:
        Claim -> Download -> Extract -> Chunk -> Embed -> Persist + READY (atomic). Any failure -> FAILED.
        """
        logger.info(f"--- Starting processing for document_version_id={version_id} ---")
        start_time = time.time()

        # 1. Fetch document version record from PostgreSQL
        version = get_document_version(version_id)
        if not version:
            raise ValueError(f"Document version {version_id} not found in database.")

        # 2. Claim it (QUEUED/FAILED/READY -> PROCESSING). A concurrent duplicate run must not interfere.
        if not claim_version_for_processing(version_id):
            logger.warning(f"Version {version_id} is already being processed by another run; skipping.")
            return {"success": True, "version_id": version_id, "skipped": True}

        try:
            storage_key = version.get("storage_key")
            original_filename = version.get("original_filename", "unknown")
            mime_type = version.get("mime_type", "")

            if not storage_key:
                raise ValueError(f"Version {version_id} does not have a storage_key.")

            # 3. Download file stream from S3 / MinIO
            file_stream = storage_client.download_file(storage_key)

            # 4. Extract content using format extractor
            extractor = get_extractor(mime_type=mime_type, filename=original_filename)
            extracted_doc = extractor.extract(file_stream, filename=original_filename)

            # 5. Chunk the extracted text
            chunks = self.chunker.chunk_document(extracted_doc)

            # A document without searchable text (scanned PDF, empty file) must not look "ready": the user
            # would see READY while the AI can never find anything in it.
            if not chunks:
                raise ValueError(
                    "No extractable text was found in this file (it may be a scanned/image-only document or empty)."
                )

            # 6. Generate embeddings for chunks in batches
            logger.info(
                f"Generating embeddings for {len(chunks)} chunks in batches of {self.batch_size}..."
            )
            for i in range(0, len(chunks), self.batch_size):
                if i > 0 and settings.EMBEDDING_BATCH_DELAY_SECONDS > 0:
                    time.sleep(settings.EMBEDDING_BATCH_DELAY_SECONDS)  # stay under provider rate limits
                batch = chunks[i:i + self.batch_size]
                batch_texts = [c["content"] for c in batch]
                vectors = self.embedding_client.embed_batch(batch_texts)

                if len(vectors) != len(batch):
                    raise RuntimeError(
                        f"Embedding batch size mismatch: expected {len(batch)} vectors, got {len(vectors)}"
                    )

                for chunk_dict, vec in zip(batch, vectors):
                    chunk_dict["embedding"] = vec

            # 7 + 8. Save chunks and flip to READY in a single transaction
            inserted_count = save_chunks_and_mark_ready(version_id, chunks)

            duration = round(time.time() - start_time, 2)
            logger.info(
                f"Successfully processed {version_id} ({original_filename}): "
                f"{inserted_count} chunks embedded and saved in {duration}s."
            )

            return {
                "success": True,
                "version_id": version_id,
                "chunks_count": inserted_count,
                "duration_seconds": duration,
                "metadata": extracted_doc.metadata
            }

        except Exception as e:
            logger.error(f"Processing failed for version {version_id}: {e}", exc_info=True)
            # Mark version status FAILED
            try:
                update_version_status(version_id, "FAILED")
            except Exception as db_err:
                logger.error(f"Failed to update version status to FAILED: {db_err}")
            raise


processor = DocumentProcessor()
