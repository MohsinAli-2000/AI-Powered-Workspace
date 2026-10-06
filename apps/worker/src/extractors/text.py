import logging
from typing import BinaryIO

from .base import BaseExtractor, ExtractedDocument, ExtractedSection

logger = logging.getLogger(__name__)

# latin-1 accepts every byte sequence, so it must be last; cp1252 comes before it for Windows "smart quotes".
ENCODINGS_TO_TRY = ["utf-8-sig", "cp1252", "latin-1"]


class TextExtractor(BaseExtractor):
    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        file_stream.seek(0)
        raw_bytes = file_stream.read()

        if not raw_bytes:
            # Completely empty file
            return ExtractedDocument(sections=[], metadata={"encoding": "empty", "is_empty": True})

        decoded_text = None
        used_encoding = None

        # A UTF-16 BOM (Notepad's "Unicode" option) must be honored before anything else.
        candidates = ENCODINGS_TO_TRY
        if raw_bytes.startswith((b"\xff\xfe", b"\xfe\xff")):
            candidates = ["utf-16"] + ENCODINGS_TO_TRY

        for encoding in candidates:
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
