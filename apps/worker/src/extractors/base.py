from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import BinaryIO, Dict, List, Optional, Any


@dataclass
class ExtractedSection:
    """Represents a discrete section, slide, or page extracted from a document."""
    content: str
    page_number: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExtractedDocument:
    """Full extraction result containing sections and overall metadata."""
    sections: List[ExtractedSection]
    metadata: Dict[str, Any] = field(default_factory=dict)
    total_characters: int = 0

    def __post_init__(self):
        if not self.total_characters:
            self.total_characters = sum(len(s.content) for s in self.sections)


class BaseExtractor(ABC):
    """Abstract Base Class for format-specific text extractors."""

    @abstractmethod
    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        """
        Extract text and structure from a binary stream.
        Raises an exception if extraction fails or file is corrupted.
        """
        pass
