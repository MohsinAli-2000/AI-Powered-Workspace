from typing import Any, Dict, List, Optional
from src.config import settings
from src.extractors.base import ExtractedDocument, ExtractedSection
from src.normalizer import TextNormalizer


class DocumentChunker:
    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None
    ):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")

    def chunk_document(self, doc: ExtractedDocument) -> List[Dict[str, Any]]:
        """
        Takes an ExtractedDocument and splits each section into overlapping chunks.
        Returns a list of dicts formatted for the `document_chunks` table.
        """
        chunks: List[Dict[str, Any]] = []
        global_chunk_idx = 0

        for sec_idx, section in enumerate(doc.sections):
            normalized_content = TextNormalizer.normalize(section.content)
            if not normalized_content:
                continue

            sec_chunks = self._split_text(
                text=normalized_content,
                page_number=section.page_number,
                base_metadata={
                    **doc.metadata,
                    **section.metadata,
                    "section_index": sec_idx
                },
                start_index=global_chunk_idx
            )

            chunks.extend(sec_chunks)
            global_chunk_idx += len(sec_chunks)

        return chunks

    def _split_text(
        self,
        text: str,
        page_number: Optional[int],
        base_metadata: Dict[str, Any],
        start_index: int
    ) -> List[Dict[str, Any]]:
        """Splits a single text block using sliding window with overlap."""
        chunks = []
        current_idx = start_index
        text_len = len(text)
        start = 0

        while start < text_len:
            end = start + self.chunk_size

            # If this is not the last chunk, try to break at a newline or space
            if end < text_len:
                # Look for paragraph break first
                break_point = text.rfind("\n\n", start, end)
                if break_point != -1 and break_point > start + (self.chunk_size // 2):
                    end = break_point + 2
                else:
                    # Look for sentence or line break
                    break_point = text.rfind("\n", start, end)
                    if break_point != -1 and break_point > start + (self.chunk_size // 2):
                        end = break_point + 1
                    else:
                        # Look for space
                        break_point = text.rfind(" ", start, end)
                        if break_point != -1 and break_point > start + (self.chunk_size // 2):
                            end = break_point + 1

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    "chunk_index": current_idx,
                    "content": chunk_text,
                    "page_number": page_number,
                    "metadata": {
                        **base_metadata,
                        "character_length": len(chunk_text),
                        "char_start": start,
                        "char_end": end
                    }
                })
                current_idx += 1

            # Advance by step (size - overlap)
            step = end - start
            if step <= self.chunk_overlap:
                start = end
            else:
                start = end - self.chunk_overlap
                # If start lands mid-word, snap to the start of next word to avoid orphan fragments
                if start < text_len and text[start] not in (" ", "\n") and text[start - 1] not in (" ", "\n"):
                    next_space = text.find(" ", start, min(start + self.chunk_overlap, text_len))
                    if next_space != -1:
                        start = next_space + 1


        return chunks
