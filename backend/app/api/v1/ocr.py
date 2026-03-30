"""Gemini Vision OCR endpoint — extracts medicine name from an image."""

import base64
import os

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/api/v1", tags=["ocr"])

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)


@router.post("/ocr")
async def ocr_image(image: UploadFile = File(...)):
    """
    Accept an image upload, send it to Gemini Vision, and return extracted text.
    The frontend uses this text to search the drug database.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    content = await image.read()
    b64_image = base64.b64encode(content).decode("utf-8")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": image.content_type or "image/jpeg",
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
        "generationConfig": {
            "temperature": 0.1,  # Low temp for deterministic OCR
            "maxOutputTokens": 50,  # Brand name is short
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={api_key}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini OCR failed: {resp.text[:200]}",
        )

    data = resp.json()

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        text = ""

    return {"text": text}