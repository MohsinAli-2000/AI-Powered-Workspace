import re
from typing import List, Optional


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

    async def extract_image_data(
        self,
        image_base64: str,
        mime_type: str = "image/png",
        instruction: Optional[str] = None,
    ) -> dict:
        """
        Extracts textual content, structured tables, or visual descriptions
        from an image using multimodal vision AI.
        """
        import base64
        import io
        from PIL import Image
        import httpx
        from ..config import settings
        from ..logger import logger

        # Clean base64 data if data-uri scheme was passed
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        raw_bytes = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(raw_bytes))
        width, height = img.size
        img_format = (img.format or "PNG").upper()

        prompt = instruction or (
            "Extract all text, numbers, labels, tables, key-value pairs, and visual descriptions from this image. "
            "Format tables and hierarchical lists using clean Markdown. "
            "Return only the extracted text and factual content without conversational filler."
        )

        extracted_text = ""

        # Use Gemini Vision if API key is present
        if settings.gemini_api_key:
            vision_models = [
                "gemini-3.6-flash",
                "gemini-3-flash-preview",
                "gemini-flash-lite-latest",
                "gemini-3.1-flash-lite",
            ]
            base_url = settings.gemini_base_url.rstrip("/")
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": image_base64,
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {"temperature": 0.1},
            }
            headers = {
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            }

            for model in vision_models:
                url = f"{base_url}/models/{model}:generateContent"
                try:
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        candidates = resp.json().get("candidates") or []
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            text = "".join(p.get("text", "") for p in parts).strip()
                            if text:
                                extracted_text = text
                                break
                    elif resp.status_code == 404:
                        continue
                    else:
                        logger.warning(f"Gemini {model} returned {resp.status_code}: {resp.text[:120]}")
                except Exception as err:
                    logger.warning(f"Error calling vision model {model}: {err}")

        if not extracted_text:
            extracted_text = (
                f"# Image: {img_format} ({width}x{height} px)\n\n"
                f"Image processed successfully. No textual content or vision quota was reached."
            )

        return {
            "extracted_text": extracted_text,
            "format": img_format,
            "width": width,
            "height": height,
        }


utility_service = UtilityService()
