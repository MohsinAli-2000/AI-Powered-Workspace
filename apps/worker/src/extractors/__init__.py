import os
from typing import Dict, Type

from .base import BaseExtractor, ExtractedDocument, ExtractedSection
from .pdf import PDFExtractor
from .docx import DocxExtractor
from .xlsx import XlsxExtractor
from .pptx import PptxExtractor
from .text import TextExtractor

# Supported MIME types aligned strictly with API (FR-DOC-002)
MIME_MAP: Dict[str, Type[BaseExtractor]] = {
    "application/pdf": PDFExtractor,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": DocxExtractor,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": XlsxExtractor,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": PptxExtractor,
    "text/plain": TextExtractor,
}

# Supported file extensions aligned strictly with API
EXT_MAP: Dict[str, Type[BaseExtractor]] = {
    ".pdf": PDFExtractor,
    ".docx": DocxExtractor,
    ".xlsx": XlsxExtractor,
    ".pptx": PptxExtractor,
    ".txt": TextExtractor,
}

# Known unsupported legacy binary office formats
LEGACY_EXTS = {".doc", ".ppt", ".xls"}


def get_extractor(mime_type: str, filename: str) -> BaseExtractor:
    """
    Resolves the appropriate extractor instance for the given mime_type or filename.
    Raises ValueError if the file format is unsupported or uses a legacy binary format.
    """
    cleaned_mime = (mime_type or "").strip().lower()
    _, ext = os.path.splitext((filename or "").strip().lower())

    # Check for legacy binary formats
    if ext in LEGACY_EXTS or cleaned_mime in (
        "application/msword",
        "application/vnd.ms-powerpoint",
        "application/vnd.ms-excel"
    ):
        raise ValueError(
            f"Legacy binary format '{ext}' is not supported. "
            f"Please convert to modern OpenXML format (.docx, .pptx, .xlsx) or PDF."
        )

    # 1. Check exact mime_type match (unless generic octet-stream)
    if cleaned_mime and cleaned_mime != "application/octet-stream":
        if cleaned_mime in MIME_MAP:
            return MIME_MAP[cleaned_mime]()
        if cleaned_mime.startswith("text/"):
            return TextExtractor()

    # 2. Check file extension fallback
    if ext in EXT_MAP:
        return EXT_MAP[ext]()

    raise ValueError(
        f"Unsupported document format: mime_type='{mime_type}', filename='{filename}'. "
        f"Supported formats: .pdf, .docx, .xlsx, .pptx, .txt"
    )

