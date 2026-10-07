import base64
import io
import logging
import time
from typing import BinaryIO, Optional
import httpx
from PIL import Image

from src.config import settings
from .base import BaseExtractor, ExtractedDocument, ExtractedSection

logger = logging.getLogger(__name__)

GEMINI_VISION_MODELS = [
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
]

EXTRACTION_PROMPT = (
    "You are an expert document OCR and visual data extraction engine. "
    "Perform optical character recognition (OCR) and comprehensive content extraction on this image:\n"
    "1. Extract all text, titles, subtitles, numerical data, tables, bullet points, and key-value pairs exactly as written.\n"
    "2. If the image depicts an infographic, diagram, architectural workflow, flowchart, or chart, thoroughly transcribe all labels, connections, and provide a clear factual explanation of the components and data.\n"
    "3. Format tables and structural hierarchies using clean GitHub-flavored Markdown.\n"
    "4. Return ONLY the extracted text and structured factual content without conversational commentary or greetings."
)


class ImageExtractor(BaseExtractor):
    """
    Extracts text, structured tables, and visual diagram descriptions from image files
    (PNG, JPEG, WEBP) using multimodal vision AI (Gemini) with robust fallback mechanisms.
    """

    def extract(self, file_stream: BinaryIO, filename: str) -> ExtractedDocument:
        file_stream.seek(0)
        raw_bytes = file_stream.read()

        if not raw_bytes:
            raise ValueError(f"Image file '{filename}' is empty (0 bytes).")

        # 1. Validate image integrity and parse geometry via Pillow
        try:
            pil_img = Image.open(io.BytesIO(raw_bytes))
            pil_img.verify()
            # Reopen after verify() because verify() can corrupt file pointer in PIL
            pil_img = Image.open(io.BytesIO(raw_bytes))
            img_format = (pil_img.format or "PNG").upper()
            width, height = pil_img.size
            mode = pil_img.mode
        except Exception as exc:
            logger.error(f"Failed to read image '{filename}': {exc}")
            raise ValueError(f"Corrupted or invalid image file: {exc}")

        # Map format to appropriate MIME type supported by Gemini Vision
        mime_type = "image/png"
        if img_format in ("JPEG", "JPG"):
            mime_type = "image/jpeg"
        elif img_format == "WEBP":
            mime_type = "image/webp"
        else:
            # Format (e.g. BMP, TIFF, GIF) not natively accepted in Gemini inlineData; convert to PNG in-memory
            try:
                buf = io.BytesIO()
                # Ensure mode is compatible with PNG
                save_img = pil_img.convert("RGBA") if pil_img.mode in ("P", "CMYK") else pil_img
                save_img.save(buf, format="PNG")
                raw_bytes = buf.getvalue()
                mime_type = "image/png"
            except Exception as conv_err:
                logger.debug(f"Could not convert {img_format} to PNG in-memory: {conv_err}")

        extracted_text = ""

        # 2. Extract using Gemini Vision if API key is configured
        if settings.GEMINI_API_KEY:
            extracted_text = self._extract_with_gemini(raw_bytes, mime_type, filename)

        # 3. Optional local OCR fallback (if pytesseract is available)
        if not extracted_text:
            extracted_text = self._extract_with_local_ocr(pil_img, filename)

        # 4. If neither produced text (e.g. rate limit or pure illustration), provide metadata summary
        if not extracted_text:
            logger.warning(
                f"No text extracted via vision API for '{filename}'. Providing metadata fallback."
            )
            extracted_text = (
                f"# Image Document: {filename}\n\n"
                f"- **Format**: {img_format}\n"
                f"- **Dimensions**: {width} × {height} pixels\n"
                f"- **Color Mode**: {mode}\n"
                f"- **File Size**: {len(raw_bytes)} bytes\n\n"
                f"*(Image uploaded to project. Visual content extraction pending or quota limited.)*"
            )

        section = ExtractedSection(
            content=extracted_text.strip(),
            page_number=1,
            metadata={
                "filename": filename,
                "format": img_format,
                "width": width,
                "height": height,
                "mode": mode,
                "is_image": True,
            },
        )

        metadata = {
            "format": img_format,
            "width": width,
            "height": height,
            "mode": mode,
            "page_count": 1,
            "is_image": True,
        }

        return ExtractedDocument(sections=[section], metadata=metadata)

    def _extract_with_gemini(
        self, raw_bytes: bytes, mime_type: str, filename: str
    ) -> str:
        """Invokes Gemini Multimodal Vision to extract text and data from image bytes."""
        base64_data = base64.b64encode(raw_bytes).decode("utf-8")
        api_key = settings.GEMINI_API_KEY
        base_url = settings.GEMINI_BASE_URL.rstrip("/")

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": EXTRACTION_PROMPT},
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": base64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
            },
        }

        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        }

        # Prioritize configured vision model first, then fallbacks
        configured_model = getattr(settings, "GEMINI_VISION_MODEL", "gemini-3.6-flash")
        models_to_try = [configured_model] + [
            m for m in GEMINI_VISION_MODELS if m != configured_model
        ]

        for model in models_to_try:
            url = f"{base_url}/models/{model}:generateContent"
            max_attempts = getattr(settings, "GEMINI_MAX_RETRIES", 4)
            initial_delay = getattr(settings, "GEMINI_INITIAL_RETRY_DELAY", 1.0)
            max_delay = getattr(settings, "GEMINI_MAX_RETRY_DELAY", 10.0)

            for attempt in range(1, max_attempts + 1):
                try:
                    with httpx.Client(timeout=60.0) as client:
                        resp = client.post(url, json=payload, headers=headers)

                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates") or []
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            text = "".join(p.get("text", "") for p in parts).strip()
                            if text:
                                logger.info(
                                    f"Successfully extracted {len(text)} characters from '{filename}' using {model}."
                                )
                                return text

                    status = resp.status_code
                    if status in (401, 403):
                        logger.error(
                            f"Gemini API key rejected permanently ({status}) for vision model {model}."
                        )
                        return ""

                    if status in (400, 404, 422):
                        logger.debug(f"Gemini model {model} rejected request ({status}), skipping to next model.")
                        break

                    # Transient errors: 429 or 5xx
                    delay = min(initial_delay * (2 ** (attempt - 1)), max_delay)
                    retry_after = resp.headers.get("retry-after")
                    if retry_after:
                        try:
                            delay = min(float(retry_after), max_delay)
                        except ValueError:
                            pass
                    import random
                    jitter = random.uniform(0.0, 0.5)
                    wait_time = delay + jitter

                    if status == 429:
                        logger.warning(
                            f"Gemini vision {model} rate limited (429) for '{filename}'. Attempt {attempt}/{max_attempts}, retry_in={wait_time:.1f}s."
                        )
                    else:
                        logger.warning(
                            f"Gemini vision {model} temporary error ({status}) for '{filename}'. Attempt {attempt}/{max_attempts}, retry_in={wait_time:.1f}s."
                        )

                    if attempt < max_attempts:
                        time.sleep(wait_time)
                    else:
                        logger.warning(f"All retries exhausted for vision model {model}; trying next fallback model.")
                        break

                except Exception as err:
                    logger.warning(
                        f"Connection error calling Gemini vision {model} for '{filename}': {err}"
                    )
                    if attempt < max_attempts:
                        time.sleep(2.0)
                    else:
                        break

                except Exception as err:
                    logger.warning(
                        f"Connection error calling Gemini {model} for '{filename}': {err}"
                    )
                    time.sleep(1.0)

        return ""

    def _extract_with_local_ocr(self, img: Image.Image, filename: str) -> str:
        """Attempts OCR with pytesseract if installed and binary is present."""
        try:
            import pytesseract  # type: ignore

            text = pytesseract.image_to_string(img)
            if text and text.strip():
                logger.info(f"Local pytesseract extracted {len(text)} characters from '{filename}'.")
                return text.strip()
        except Exception:
            pass
        return ""
