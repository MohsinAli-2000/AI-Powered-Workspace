import logging
from typing import BinaryIO

from .base import BaseExtractor, ExtractedDocument, ExtractedSection

logger = logging.getLogger(__name__)

ENCODINGS_TO_TRY = ["utf-8", "utf-8-sig", "latin-1", "cp1252", "utf-16"]


class TextExtractor(BaseExtractor):
    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        file_stream.seek(0)
        raw_bytes = file_stream.read()

        if not raw_bytes:
            # Completely empty file
            return ExtractedDocument(sections=[], metadata={"encoding": "empty", "is_empty": True})

        decoded_text = None
        used_encoding = None

        for encoding in ENCODINGS_TO_TRY:
            try:
                decoded_text = raw_bytes.decode(encoding)
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue

        if decoded_text is None:
            # Last resort fallback with replacement
            logger.warning(f"Failed standard encodings for {filename}, falling back to utf-8 with replacement.")
            decoded_text = raw_bytes.decode("utf-8", errors="replace")
            used_encoding = "utf-8-replaced"

        clean_text = decoded_text.strip()
        sections = []
        if clean_text:
            sections.append(
                ExtractedSection(
                    content=clean_text,
                    page_number=None,
                    metadata={"encoding": used_encoding}
                )
            )

        return ExtractedDocument(
            sections=sections,
            metadata={"encoding": used_encoding, "character_count": len(clean_text)}
        )
