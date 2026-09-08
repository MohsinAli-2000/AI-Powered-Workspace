import logging
from typing import BinaryIO
from pypdf import PdfReader

from .base import BaseExtractor, ExtractedDocument, ExtractedSection

logger = logging.getLogger(__name__)


class PDFExtractor(BaseExtractor):
    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        file_stream.seek(0)
        try:
            reader = PdfReader(file_stream)
        except Exception as e:
            logger.error(f"Failed to read PDF {filename}: {e}")
            raise ValueError(f"Corrupted or invalid PDF file: {e}")

        if reader.is_encrypted:
            # Try decrypting with empty password
            try:
                decrypted = reader.decrypt("")
                if decrypted == 0:
                    raise ValueError("Password-protected PDFs are not supported.")
            except Exception as e:
                raise ValueError(f"Failed to decrypt PDF: {e}")

        sections = []
        num_pages = len(reader.pages)
        total_extracted_chars = 0

        for page_idx, page in enumerate(reader.pages):
            try:
                text = page.extract_text() or ""
                clean_text = text.strip()
                if clean_text:
                    sections.append(
                        ExtractedSection(
                            content=clean_text,
                            page_number=page_idx + 1,
                            metadata={"page": page_idx + 1, "total_pages": num_pages}
                        )
                    )
                    total_extracted_chars += len(clean_text)
            except Exception as e:
                logger.warning(f"Error extracting text from page {page_idx + 1} of {filename}: {e}")

        # Edge case: Scanned or image-only PDF with zero extracted text
        metadata = {
            "page_count": num_pages,
            "is_scanned_or_empty": total_extracted_chars == 0
        }

        if total_extracted_chars == 0 and num_pages > 0:
            logger.warning(
                f"PDF {filename} has {num_pages} page(s) but no extractable text (likely image/scanned)."
            )

        return ExtractedDocument(sections=sections, metadata=metadata)
