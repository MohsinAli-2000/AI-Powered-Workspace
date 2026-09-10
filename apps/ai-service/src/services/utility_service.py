import re
from typing import List


class UtilityService:
    """
    Text processing and semantic chunking service.
    """
    def chunk_text(
        self,
        text: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> List[str]:
        """
        Splits text into chunks of target size with specified overlap,
        snapping to paragraph and sentence boundaries where possible.
        """
        if not text:
            return []

        cleaned_text = text.replace("\r\n", "\n").strip()
        if len(cleaned_text) <= chunk_size:
            return [cleaned_text]

        chunks: List[str] = []
        start_idx = 0
        total_len = len(cleaned_text)

        while start_idx < total_len:
            end_idx = min(start_idx + chunk_size, total_len)

            if end_idx < total_len:
                # 1. Try snapping to double newline (paragraph boundary)
                para_snap = cleaned_text.rfind("\n\n", start_idx, end_idx)
                if para_snap != -1 and para_snap > start_idx + (chunk_size // 2):
                    end_idx = para_snap + 2
                else:
                    # 2. Try snapping to sentence boundary (.!?)
                    match = None
                    for m in re.finditer(r"[.!?]\s+", cleaned_text[start_idx:end_idx]):
                        match = m
                    if match and (start_idx + match.end()) > start_idx + (chunk_size // 2):
                        end_idx = start_idx + match.end()
                    else:
                        # 3. Try snapping to space (word boundary)
                        space_snap = cleaned_text.rfind(" ", start_idx, end_idx)
                        if space_snap != -1 and space_snap > start_idx + (chunk_size // 2):
                            end_idx = space_snap + 1

            chunk_content = cleaned_text[start_idx:end_idx].strip()
            if chunk_content:
                chunks.append(chunk_content)

            if end_idx >= total_len:
                break

            # Advance by step size (chunk_size - chunk_overlap)
            step = max(chunk_size - chunk_overlap, 1)
            next_start = start_idx + step
            if next_start <= start_idx:
                next_start = start_idx + 1
            start_idx = min(next_start, end_idx)

        return chunks


utility_service = UtilityService()
