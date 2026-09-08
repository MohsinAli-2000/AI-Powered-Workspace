import logging
from typing import BinaryIO
from docx import Document

from .base import BaseExtractor, ExtractedDocument, ExtractedSection

logger = logging.getLogger(__name__)


class DocxExtractor(BaseExtractor):
    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        file_stream.seek(0)
        try:
            doc = Document(file_stream)
        except Exception as e:
            logger.error(f"Failed to read DOCX {filename}: {e}")
            raise ValueError(f"Corrupted or invalid DOCX file: {e}")

        sections = []
        full_text = []

        # 1. Extract paragraphs
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                full_text.append(text)

        # 2. Extract tables
        for table_idx, table in enumerate(doc.tables):
            table_lines = []
            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_cells:
                    table_lines.append(" | ".join(row_cells))
            if table_lines:
                full_text.append(f"\n[Table {table_idx + 1}]\n" + "\n".join(table_lines))

        combined_text = "\n\n".join(full_text)
        if combined_text:
            sections.append(
                ExtractedSection(
                    content=combined_text,
                    page_number=None,
                    metadata={"tables_count": len(doc.tables), "paragraphs_count": len(doc.paragraphs)}
                )
            )

        return ExtractedDocument(
            sections=sections,
            metadata={"paragraphs_count": len(doc.paragraphs), "tables_count": len(doc.tables)}
        )
