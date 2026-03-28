"""POST /api/v1/compare — compare two drugs side by side."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.db.models import Drug, DrugSalt, Salt
from app.models.schemas.schemas import (
    ComparisonResult, ComparisonSalt, DrugDetail, SaltOut
)
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["compare"])


class CompareRequest(BaseModel):
    drug_id_1: int
    drug_id_2: int


async def fetch_drug_detail(drug_id: int, db: AsyncSession) -> tuple[Drug, DrugDetail]:
    stmt = (
        select(Drug)
        .options(selectinload(Drug.drug_salts).selectinload(DrugSalt.salt))
        .where(Drug.id == drug_id)
    )
    result = await db.execute(stmt)
    drug = result.scalar_one_or_none()

    if not drug:
        raise HTTPException(status_code=404, detail=f"Drug {drug_id} not found")

    salts = [
        SaltOut(
            id=ds.salt.id,
            inn_name=ds.salt.inn_name,
            atc_code=ds.salt.atc_code,
            pharmacological_class=ds.salt.pharmacological_class,
            quantity=ds.quantity,
        )
        for ds in drug.drug_salts
    ]

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
    return drug, detail


@router.post("/compare", response_model=ComparisonResult)
async def compare_drugs(
    payload: CompareRequest,
    db: AsyncSession = Depends(get_db),
):
    drug1, detail1 = await fetch_drug_detail(payload.drug_id_1, db)
    drug2, detail2 = await fetch_drug_detail(payload.drug_id_2, db)

    salts1 = {s.inn_name.lower(): s.quantity for s in detail1.salts}
    salts2 = {s.inn_name.lower(): s.quantity for s in detail2.salts}

    salts1_display = {s.inn_name.lower(): s.inn_name for s in detail1.salts}
    salts2_display = {s.inn_name.lower(): s.inn_name for s in detail2.salts}
    all_display = {**salts2_display, **salts1_display}

    all_salt_keys = set(salts1.keys()) | set(salts2.keys())
    common_keys = set(salts1.keys()) & set(salts2.keys())
    only_in_1_keys = set(salts1.keys()) - set(salts2.keys())
    only_in_2_keys = set(salts2.keys()) - set(salts1.keys())

    overlap_pct = round(len(common_keys) / len(all_salt_keys) * 100, 1) if all_salt_keys else 0.0

    shared_salts = sorted(all_display[k] for k in common_keys)
    only_in_drug_a = sorted(all_display[k] for k in only_in_1_keys)
    only_in_drug_b = sorted(all_display[k] for k in only_in_2_keys)

    salts_comparison = [
        ComparisonSalt(
            inn_name=all_display[name],
            in_drug_a=name in salts1,
            in_drug_b=name in salts2,
            quantity_a=salts1.get(name),
            quantity_b=salts2.get(name),
        )
        for name in sorted(all_salt_keys)
    ]

    price_difference = None
    if detail1.mrp is not None and detail2.mrp is not None:
        price_difference = abs(detail1.mrp - detail2.mrp)

    same_form = (drug1.dosage_form or "").lower() == (drug2.dosage_form or "").lower()

    if overlap_pct == 100 and same_form:
        safe = True
        risk = "low"
        reason = "Identical salt composition and dosage form — likely safe to substitute. Always confirm with your doctor."
    elif overlap_pct == 100 and not same_form:
        safe = False
        risk = "medium"
        reason = "Same salts but different dosage forms — substitution needs pharmacist approval."
    elif overlap_pct >= 50:
        safe = False
        risk = "medium"
        reason = "Partial salt overlap — do not substitute without consulting your doctor."
    else:
        safe = False
        risk = "high"
        reason = "Different compositions — these are not substitutes for each other."

    return ComparisonResult(
        drug_a=detail1,
        drug_b=detail2,
        salt_overlap_pct=overlap_pct,
        safe_to_substitute=safe,
        substitution_risk=risk,
        risk_reason=reason,
        salts_comparison=salts_comparison,
        price_difference=price_difference,
        shared_salts=shared_salts,
        only_in_drug_a=only_in_drug_a,
        only_in_drug_b=only_in_drug_b,
    )