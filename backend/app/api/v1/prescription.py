"""POST /api/v1/scan-prescription — scan a paper prescription and calculate savings."""

import base64
import json
import logging
import os
import re
from decimal import Decimal

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.core.database import get_db
from app.models.db.models import Drug
from app.models.schemas.schemas import PrescriptionRow, PrescriptionScanResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["prescription"])

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash-lite:generateContent"
)

# Manufacturers known to be Jan Aushadhi / government generic suppliers
JAN_AUSHADHI_KEYWORDS = [
    "jan aushadhi", "bppi", "generic", "cipla", "sun pharma", "lupin",
    "alkem", "mankind", "micro labs", "glenmark",
]

EXTRACTION_PROMPT = (
    "This is a photo of an Indian doctor's prescription or a list of medicines. "
    "Extract every medicine name written on it. "
    "Return ONLY a valid JSON array of strings in this exact format: "
    '[\"Medicine1\", \"Medicine2\", \"Medicine3\"]. '
    "Each string should be just the medicine brand name — do NOT include dosage "
    "amounts (mg/ml), frequency instructions, doctor notes, or any other text. "
    "If you see something like 'Crocin 650 mg 1-0-1', just return 'Crocin'. "
    "If no medicines are found, return an empty array: []. "
    "Return ONLY the JSON array, no explanation, no markdown code blocks."
)


async def extract_medicine_names(image_bytes: bytes, mime_type: str, api_key: str) -> list[str]:
    """Call Gemini Vision to extract medicine names from a prescription image."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"inlineData": {"mimeType": mime_type, "data": b64}},
                {"text": EXTRACTION_PROMPT},
            ],
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 512},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={api_key}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Gemini API timed out.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Network error reaching Gemini: {e}")

    if resp.status_code != 200:
        err = resp.text[:300]
        logger.error("Gemini prescription OCR failed %d: %s", resp.status_code, err)
        raise HTTPException(status_code=502, detail=f"Gemini failed ({resp.status_code}): {err}")

    data = resp.json()
    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        logger.warning("Unexpected Gemini response shape: %s", data)
        return []

    # Strip markdown code fences if Gemini wraps it
    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
    raw_text = re.sub(r"\s*```$", "", raw_text)

    try:
        names = json.loads(raw_text.strip())
        if isinstance(names, list):
            return [str(n).strip() for n in names if str(n).strip()]
    except json.JSONDecodeError:
        logger.warning("Could not parse Gemini output as JSON: %r", raw_text)

    return []


async def find_cheapest_generic(name: str, db: AsyncSession) -> Drug | None:
    """Find the cheapest drug that matches the name (proxy for generic/Jan Aushadhi)."""
    stmt = (
        select(Drug)
        .where(func.similarity(Drug.brand_name, name) > 0.1)
        .where(Drug.mrp.isnot(None))
        .order_by(Drug.mrp.asc())
        .limit(1)
    )
    try:
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    except Exception:
        # Fallback if pg_trgm unavailable
        stmt = (
            select(Drug)
            .where(Drug.brand_name.ilike(f"%{name}%"))
            .where(Drug.mrp.isnot(None))
            .order_by(Drug.mrp.asc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


async def find_best_branded(name: str, db: AsyncSession) -> Drug | None:
    """Find the most similar branded match for the medicine name."""
    stmt = (
        select(Drug)
        .where(func.similarity(Drug.brand_name, name) > 0.1)
        .order_by(func.similarity(Drug.brand_name, name).desc())
        .limit(1)
    )
    try:
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    except Exception:
        stmt = (
            select(Drug)
            .where(Drug.brand_name.ilike(f"%{name}%"))
            .order_by(Drug.brand_name)
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


@router.post("/scan-prescription", response_model=PrescriptionScanResult)
async def scan_prescription(
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "GEMINI_API_KEY is not configured. "
                "Go to Render → pranavmeds → Environment → add GEMINI_API_KEY."
            ),
        )

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file.")

    mime_type = image.content_type or "image/jpeg"

    # Step 1: Extract medicine names via Gemini Vision
    medicine_names = await extract_medicine_names(content, mime_type, api_key)
    logger.info("Prescription scan extracted %d medicine names: %s", len(medicine_names), medicine_names)

    if not medicine_names:
        return PrescriptionScanResult(
            rows=[],
            total_branded=Decimal("0"),
            total_generic=Decimal("0"),
            total_savings=Decimal("0"),
            medicines_found=0,
            medicines_not_found=0,
        )

    # Step 2: For each medicine, find branded (best match) and cheapest generic
    rows: list[PrescriptionRow] = []
    for name in medicine_names:
        branded = await find_best_branded(name, db)
        generic = await find_cheapest_generic(name, db)

        branded_mrp = Decimal(str(branded.mrp)) if branded and branded.mrp else None
        generic_mrp = Decimal(str(generic.mrp)) if generic and generic.mrp else None

        # If the cheapest match IS the branded one (same id), that's our best we have
        # We still show it — saving will just be 0
        saving: Decimal | None = None
        saving_pct: float | None = None
        if branded_mrp is not None and generic_mrp is not None:
            saving = max(branded_mrp - generic_mrp, Decimal("0"))
            if branded_mrp > 0:
                saving_pct = round(float(saving / branded_mrp * 100), 1)

        rows.append(PrescriptionRow(
            medicine_input=name,
            branded_name=branded.brand_name if branded else None,
            branded_mrp=branded_mrp,
            generic_name=generic.brand_name if generic else None,
            generic_mrp=generic_mrp,
            saving=saving,
            saving_pct=saving_pct,
        ))

    # Step 3: Compute totals
    total_branded = sum(
        (r.branded_mrp for r in rows if r.branded_mrp is not None), Decimal("0")
    )
    total_generic = sum(
        (r.generic_mrp for r in rows if r.generic_mrp is not None), Decimal("0")
    )
    total_savings = max(total_branded - total_generic, Decimal("0"))
    medicines_found = sum(1 for r in rows if r.branded_name is not None)
    medicines_not_found = len(rows) - medicines_found

    logger.info(
        "Prescription result: found=%d, not_found=%d, savings=₹%s",
        medicines_found, medicines_not_found, total_savings,
    )

    return PrescriptionScanResult(
        rows=rows,
        total_branded=total_branded,
        total_generic=total_generic,
        total_savings=total_savings,
        medicines_found=medicines_found,
        medicines_not_found=medicines_not_found,
    )
