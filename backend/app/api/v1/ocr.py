import base64
import os
import logging
import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["ocr"])

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash-lite:generateContent"
)


@router.post("/ocr")
async def ocr_image(image: UploadFile = File(...)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable is not set")
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured on the server. "
                   "Go to Render dashboard → pranavmeds service → Environment → "
                   "Add variable: GEMINI_API_KEY = <your Google AI Studio key>",
        )

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file")

    b64_image = base64.b64encode(content).decode("utf-8")
    mime_type = image.content_type or "image/jpeg"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": b64_image,
                        }
                    },
                    {
                        "text": (
                            "This is a photo of an Indian medicine box, strip, or blister pack. "
                            "Extract ONLY the brand name of the medicine (the largest or most prominent text). "
                            "Do NOT include dosage (mg/ml), form (tablet/capsule/syrup), manufacturer name, "
                            "batch number, expiry date, or any other text. "
                            "Reply with just the medicine brand name, nothing else. "
                            "If you cannot find a medicine name, reply with an empty string."
                        )
                    },
                ],
            }
        ],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 50},
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={api_key}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Gemini API timed out. Try again.")
    except httpx.RequestError as e:
        logger.error("Gemini network error: %s", e)
        raise HTTPException(status_code=502, detail=f"Network error reaching Gemini: {e}")

    if resp.status_code != 200:
        err_snippet = resp.text[:300]
        logger.error("Gemini returned %d: %s", resp.status_code, err_snippet)
        # Common error codes
        if resp.status_code == 400:
            raise HTTPException(
                status_code=502,
                detail=f"Gemini rejected the request (400). Check API key & model name. Response: {err_snippet}",
            )
        if resp.status_code == 403:
            raise HTTPException(
                status_code=502,
                detail="Gemini API key is invalid or does not have permission for gemini-2.0-flash.",
            )
        raise HTTPException(
            status_code=502,
            detail=f"Gemini OCR failed ({resp.status_code}): {err_snippet}",
        )

    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        logger.warning("Unexpected Gemini response shape: %s", data)
        text = ""

    logger.info("OCR result: '%s' (mime=%s, size=%d bytes)", text, mime_type, len(content))
    return {"text": text}