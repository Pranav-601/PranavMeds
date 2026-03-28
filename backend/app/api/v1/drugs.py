"""Search and drug detail API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.db.models import Drug, DrugSalt, Salt
from app.models.schemas.schemas import DrugBrief, DrugDetail, SearchResult, SaltOut

router = APIRouter(prefix="/api/v1", tags=["drugs"])


@router.get("/search", response_model=SearchResult)
async def search_drugs(
    q: str = Query(..., min_length=1, description="Search query for drug name"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Search for drugs by name.
    Phase 3: Meilisearch fuzzy/typo-tolerant search with SQL fallback.
    """
    try:
        # Try Meilisearch first
        from app.services.search import search_drugs as meili_search
        hits = await meili_search(q, limit=limit)
        if hits:
            results = [
                DrugBrief(
                    id=h["id"],
                    brand_name=h.get("brand_name", ""),
                    manufacturer=h.get("manufacturer") or None,
                    dosage_form=h.get("dosage_form") or None,
                    strength=h.get("strength") or None,
                    mrp=h.get("mrp") or None,
                    slug=h.get("slug") or None,
                    image_url=h.get("image_url") or None,
                )
                for h in hits
            ]
            return SearchResult(query=q, count=len(results), results=results)
    except Exception:
        pass  # Fall back to SQL

    # SQL fallback
    stmt = (
        select(Drug)
        .where(Drug.brand_name.ilike(f"%{q}%"))
        .order_by(Drug.brand_name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    drugs = result.scalars().all()

    return SearchResult(
        query=q,
        count=len(drugs),
        results=[DrugBrief.model_validate(d) for d in drugs],
    )


@router.get("/drug/{drug_id}", response_model=DrugDetail)
async def get_drug(
    drug_id: int,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Drug)
        .options(selectinload(Drug.drug_salts).selectinload(DrugSalt.salt))
        .where(Drug.id == drug_id)
    )
    result = await db.execute(stmt)
    drug = result.scalar_one_or_none()

    if not drug:
        raise HTTPException(status_code=404, detail=f"Drug with id {drug_id} not found")

    salts = []
    for ds in drug.drug_salts:
        salt_out = SaltOut(
            id=ds.salt.id,
            inn_name=ds.salt.inn_name,
            atc_code=ds.salt.atc_code,
            pharmacological_class=ds.salt.pharmacological_class,
            quantity=ds.quantity,
        )
        salts.append(salt_out)

    detail = DrugDetail(
        id=drug.id,
        brand_name=drug.brand_name,
        manufacturer=drug.manufacturer,
        dosage_form=drug.dosage_form,
        strength=drug.strength,
        mrp=drug.mrp,
        is_banned=drug.is_banned,
        schedule=drug.schedule,
        nlem_listed=drug.nlem_listed,
        license_number=drug.license_number,
        slug=drug.slug,
        uses=drug.uses,
        side_effects=drug.side_effects,
        image_url=drug.image_url,
        salts=salts,
    )
    return detail