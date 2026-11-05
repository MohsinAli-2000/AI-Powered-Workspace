import re
from typing import Any
from langchain_text_splitters import TextSplitter


class BoundaryAwareTextSplitter(TextSplitter):
    """
    LangChain `TextSplitter` implementing the service's original chunking algorithm:
    fixed-size windows with overlap that snap to the nearest paragraph, sentence, or word boundary
    in the second half of the window.

    The algorithm is kept byte-for-byte identical to the pre-LangChain implementation so that
    re-processing a document yields exactly the same chunks (and therefore the same embeddings
    and chunk indexes). Being a `TextSplitter`, it also provides `create_documents` /
    `split_documents` for LangChain document pipelines.
    """

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, **kwargs: Any) -> None:
        # The public API allows overlap >= chunk_size (the algorithm then advances by 1 char at a
        # time); LangChain's base class rejects that, so only a clamped value is passed to it.
        super().__init__(
            chunk_size=chunk_size,
            chunk_overlap=min(chunk_overlap, chunk_size),
            **kwargs,
        )
        self.boundary_chunk_size = chunk_size
        self.boundary_chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> list[str]:
        chunk_size = self.boundary_chunk_size
        chunk_overlap = self.boundary_chunk_overlap

        if not text:
            return []

        cleaned_text = text.replace("\r\n", "\n").strip()
        if len(cleaned_text) <= chunk_size:
            return [cleaned_text]

        chunks: list[str] = []
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
