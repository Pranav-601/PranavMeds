"""POST /api/v1/request-drug — queue an on-demand scrape for a missing medicine."""

import re
import logging
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.db.models import Drug, Salt, DrugSalt
from app.scrapers.jan_aushadhi import scrape_jan_aushadhi

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["request"])


class DrugRequest(BaseModel):
    name: str


class DrugRequestResponse(BaseModel):
    status: str
    message: str
    drug_name: str


def _make_slug(name: str) -> str:
    """Convert a drug name to a URL-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug


async def _upsert_drug(drug_data: dict, db: AsyncSession) -> None:
    """Insert a scraped drug into the DB if it doesn't already exist."""
    brand_name = drug_data.get("brand_name", "").strip()
    if not brand_name:
        return

    # Check if drug already exists (case-insensitive)
    stmt = select(Drug).where(Drug.brand_name.ilike(brand_name))
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        logger.info(f"Drug already exists: {brand_name}")
        return

    # Build a unique slug
    base_slug = _make_slug(brand_name)
    slug = base_slug
    counter = 1
    while True:
        slug_check = await db.execute(select(Drug).where(Drug.slug == slug))
        if not slug_check.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Insert drug
    drug = Drug(
        brand_name=brand_name,
        manufacturer=drug_data.get("manufacturer"),
        dosage_form=drug_data.get("dosage_form"),
        strength=drug_data.get("strength"),
        mrp=drug_data.get("mrp"),
        slug=slug,
        uses=drug_data.get("uses"),
        side_effects=drug_data.get("side_effects"),
        image_url=drug_data.get("image_url"),
    )
    db.add(drug)
    await db.flush()  # get drug.id without committing

    # Insert salts
    for salt_data in drug_data.get("salts", []):
        salt_name = salt_data.get("name", "").strip()
        if not salt_name:
            continue

        # Upsert salt
        salt_stmt = select(Salt).where(Salt.inn_name.ilike(salt_name))
        salt_result = await db.execute(salt_stmt)
        salt = salt_result.scalar_one_or_none()

        if not salt:
            salt = Salt(inn_name=salt_name)
            db.add(salt)
            await db.flush()

        # Link drug ↔ salt
        drug_salt = DrugSalt(
            drug_id=drug.id,
            salt_id=salt.id,
            quantity=salt_data.get("quantity"),
        )
        db.add(drug_salt)

    await db.commit()
    logger.info(f"Inserted new drug from scraper: {brand_name} (slug: {slug})")


async def _scrape_and_insert(drug_name: str, db: AsyncSession) -> None:
    """Background task: scrape Jan Aushadhi and insert results into DB."""
    logger.info(f"Background scrape started for: {drug_name}")
    try:
        results = scrape_jan_aushadhi(drug_name)
        if not results:
            logger.warning(f"Scraper returned no results for: {drug_name}")
            return

        for drug_data in results:
            await _upsert_drug(drug_data, db)

        logger.info(f"Background scrape complete for: {drug_name} — {len(results)} results processed")
    except Exception as e:
        logger.error(f"Background scrape failed for {drug_name}: {e}", exc_info=True)


@router.post("/request-drug", response_model=DrugRequestResponse)
async def request_drug(
    payload: DrugRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Queue an on-demand scrape for a medicine not found in the database.
    Returns 200 immediately — scraping happens in the background.
    """
    drug_name = payload.name.strip()

    if not drug_name or len(drug_name) < 2:
        return DrugRequestResponse(
            status="error",
            message="Please provide a valid medicine name.",
            drug_name=drug_name,
        )

    if len(drug_name) > 100:
        return DrugRequestResponse(
            status="error",
            message="Medicine name is too long.",
            drug_name=drug_name,
        )

    # Queue the background scrape
    background_tasks.add_task(_scrape_and_insert, drug_name, db)

    return DrugRequestResponse(
        status="queued",
        message=f"We're looking up '{drug_name}' from Jan Aushadhi. Refresh in about 30 seconds.",
        drug_name=drug_name,
    )