import logging
from typing import BinaryIO
from pptx import Presentation

from .base import BaseExtractor, ExtractedDocument, ExtractedSection

logger = logging.getLogger(__name__)


class PptxExtractor(BaseExtractor):
    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        file_stream.seek(0)
        try:
            prs = Presentation(file_stream)
        except Exception as e:
            logger.error(f"Failed to read PPTX {filename}: {e}")
            raise ValueError(f"Corrupted or invalid PPTX file: {e}")

        sections = []
        slide_count = len(prs.slides)

        for slide_idx, slide in enumerate(prs.slides):
            slide_text = []

            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        line = paragraph.text.strip()
                        if line:
                            slide_text.append(line)
                elif shape.has_table:
                    for row in shape.table.rows:
                        row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if row_cells:
                            slide_text.append(" | ".join(row_cells))

            if slide_text:
                sections.append(
                    ExtractedSection(
                        content="\n".join(slide_text),
                        page_number=slide_idx + 1,  # slide number
                        metadata={"slide_number": slide_idx + 1, "total_slides": slide_count}
                    )
                )

        return ExtractedDocument(
            sections=sections,
            metadata={"total_slides": slide_count}
        )
