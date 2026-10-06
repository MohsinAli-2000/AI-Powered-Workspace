import logging
from typing import BinaryIO
import openpyxl

from .base import BaseExtractor, ExtractedDocument, ExtractedSection

logger = logging.getLogger(__name__)


class XlsxExtractor(BaseExtractor):
    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        file_stream.seek(0)
        try:
            wb = openpyxl.load_workbook(file_stream, data_only=True, read_only=True)
        except Exception as e:
            logger.error(f"Failed to read XLSX {filename}: {e}")
            raise ValueError(f"Corrupted or invalid XLSX file: {e}")

        sections = []
        try:
            sheet_names = wb.sheetnames

            for sheet_idx, sheet_name in enumerate(sheet_names):
                sheet = wb[sheet_name]
                sheet_lines = []
                # Some generators write a wrong <dimension> tag; in read-only mode that truncates the sheet.
                try:
                    sheet.reset_dimensions()
                except AttributeError:
                    pass

                for row in sheet.iter_rows(values_only=True):
                    # Filter out all-None rows
                    row_values = [str(cell).strip() for cell in row if cell is not None and str(cell).strip() != ""]
                    if row_values:
                        sheet_lines.append(" | ".join(row_values))

                if sheet_lines:
                    sheet_content = f"Sheet: {sheet_name}\n" + "\n".join(sheet_lines)
                    sections.append(
                        ExtractedSection(
                            content=sheet_content,
                            page_number=sheet_idx + 1,  # treat sheets as logical pages
                            metadata={"sheet_name": sheet_name, "row_count": len(sheet_lines)}
                        )
                    )

            return ExtractedDocument(
                sections=sections,
                metadata={"sheet_count": len(sheet_names), "sheets": sheet_names}
            )
        finally:
            wb.close()

