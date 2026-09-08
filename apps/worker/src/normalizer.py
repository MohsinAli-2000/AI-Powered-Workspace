import re
import unicodedata


class TextNormalizer:
    @staticmethod
    def normalize(text: str) -> str:
        """
        Cleans and standardizes extracted text before chunking:
        1. Normalizes unicode characters (NFKC).
        2. Removes null bytes and non-printable control characters (except tabs and newlines).
        3. Standardizes line breaks (\r\n -> \n).
        4. Collapses excessive consecutive blank lines (> 2) into 2.
        5. Trims leading/trailing whitespace.
        """
        if not text:
            return ""

        # 1. Unicode normalization
        text = unicodedata.normalize("NFKC", text)

        # 2. Remove null bytes and unprintable control characters
        # Preserve \t (0x09) and \n (0x0A)
        text = text.replace("\x00", "")
        text = re.sub(r"[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]", "", text)

        # 3. Standardize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # 4. Collapse consecutive spaces/tabs on the same line
        lines = []
        for line in text.split("\n"):
            cleaned_line = re.sub(r"[ \t]+", " ", line).strip()
            lines.append(cleaned_line)

        reconstructed = "\n".join(lines)

        # 5. Collapse excessive line breaks (more than 2 consecutive newlines)
        reconstructed = re.sub(r"\n{3,}", "\n\n", reconstructed)

        return reconstructed.strip()
