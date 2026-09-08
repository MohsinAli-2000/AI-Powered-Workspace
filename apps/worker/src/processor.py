import logging
import time
from typing import Any, Dict, Optional

from src.config import settings
from src.db import (
    get_document_version,
    update_version_status,
    save_document_chunks,
)
from src.storage import storage_client
from src.extractors import get_extractor
from src.chunker import DocumentChunker

logger = logging.getLogger(__name__)


class DocumentProcessor:
    def __init__(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        self.chunker = DocumentChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    def process_version(self, version_id: str) -> Dict[str, Any]:
        """
        Orchestrates full processing for a document version:
        Fetch -> Transition to PROCESSING -> Download -> Extract -> Chunk -> Persist -> Transition to READY/FAILED.
        """
        logger.info(f"--- Starting processing for document_version_id={version_id} ---")
        start_time = time.time()

        # 1. Fetch document version record from PostgreSQL
        version = get_document_version(version_id)
        if not version:
            raise ValueError(f"Document version {version_id} not found in database.")

        storage_key = version.get("storage_key")
        original_filename = version.get("original_filename", "unknown")
        mime_type = version.get("mime_type", "")

        if not storage_key:
            error_msg = f"Version {version_id} does not have a storage_key."
            update_version_status(version_id, "FAILED")
            raise ValueError(error_msg)

        # 2. Transition status: QUEUED -> PROCESSING
        update_version_status(version_id, "PROCESSING")

        try:
            # 3. Download file stream from S3 / MinIO
            file_stream = storage_client.download_file(storage_key)

            # 4. Extract content using format extractor
            extractor = get_extractor(mime_type=mime_type, filename=original_filename)
            extracted_doc = extractor.extract(file_stream, filename=original_filename)

            # 5. Chunk the extracted text
            chunks = self.chunker.chunk_document(extracted_doc)

            # 6. Save chunks idempotently to PostgreSQL
            inserted_count = save_document_chunks(version_id, chunks)

            # 7. Transition status: PROCESSING -> READY
            update_version_status(version_id, "READY", processed_at=True)

            duration = round(time.time() - start_time, 2)
            logger.info(
                f"Successfully processed {version_id} ({original_filename}): "
                f"{inserted_count} chunks created in {duration}s."
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
