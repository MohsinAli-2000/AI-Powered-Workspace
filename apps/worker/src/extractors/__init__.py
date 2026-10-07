import os
from typing import Dict, Type

from .base import BaseExtractor, ExtractedDocument, ExtractedSection
from .pdf import PDFExtractor
from .docx import DocxExtractor
from .xlsx import XlsxExtractor
from .pptx import PptxExtractor
from .text import TextExtractor
from .image import ImageExtractor

# Supported MIME types aligned strictly with API (FR-DOC-002)
MIME_MAP: Dict[str, Type[BaseExtractor]] = {
    "application/pdf": PDFExtractor,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": DocxExtractor,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": XlsxExtractor,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": PptxExtractor,
    "text/plain": TextExtractor,
    "image/png": ImageExtractor,
    "image/jpeg": ImageExtractor,
    "image/jpg": ImageExtractor,
    "image/pjpeg": ImageExtractor,
    "image/x-png": ImageExtractor,
    "image/webp": ImageExtractor,
    "image/bmp": ImageExtractor,
    "image/tiff": ImageExtractor,
    "image/gif": ImageExtractor,
}

# Supported file extensions aligned strictly with API
EXT_MAP: Dict[str, Type[BaseExtractor]] = {
    ".pdf": PDFExtractor,
    ".docx": DocxExtractor,
    ".xlsx": XlsxExtractor,
    ".pptx": PptxExtractor,
    ".txt": TextExtractor,
    ".png": ImageExtractor,
    ".jpg": ImageExtractor,
    ".jpeg": ImageExtractor,
    ".jfif": ImageExtractor,
    ".webp": ImageExtractor,
    ".bmp": ImageExtractor,
    ".tiff": ImageExtractor,
    ".tif": ImageExtractor,
    ".gif": ImageExtractor,
}

# Known unsupported legacy binary office formats
LEGACY_EXTS = {".doc", ".ppt", ".xls"}


def get_extractor(mime_type: str, filename: str) -> BaseExtractor:
    """
    Resolves the appropriate extractor instance for the given mime_type or filename.
    Raises ValueError if the file format is unsupported or uses a legacy binary format.
    """
    # 1. Clean MIME type: strip whitespace, lowercase, and remove header parameters (e.g., charset=utf-8)
    raw_mime = (mime_type or "").strip().lower()
    cleaned_mime = raw_mime.split(";")[0].strip()
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

    # 2. Check exact MIME type match (unless generic octet-stream)
    if cleaned_mime and cleaned_mime != "application/octet-stream":
        if cleaned_mime in MIME_MAP:
            return MIME_MAP[cleaned_mime]()
        if cleaned_mime.startswith("text/"):
            return TextExtractor()
        if cleaned_mime.startswith("image/"):
            return ImageExtractor()

    # 3. Check file extension fallback
    if ext in EXT_MAP:
        return EXT_MAP[ext]()

    supported_list = ", ".join(sorted(EXT_MAP.keys()))
    raise ValueError(
        f"Unsupported document format: mime_type='{mime_type}', filename='{filename}'. "
        f"Supported formats: {supported_list}"
    )


__all__ = [
    "get_extractor",
    "BaseExtractor",
    "ExtractedDocument",
    "ExtractedSection",
    "MIME_MAP",
    "EXT_MAP",
    "PDFExtractor",
    "DocxExtractor",
    "XlsxExtractor",
    "PptxExtractor",
    "TextExtractor",
    "ImageExtractor",
]


