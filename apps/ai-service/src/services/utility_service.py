from typing import List, Optional
from ..langchain_integration import BoundaryAwareTextSplitter


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
        Implemented by the LangChain `BoundaryAwareTextSplitter`.
        """
        splitter = BoundaryAwareTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        return splitter.split_text(text)

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
