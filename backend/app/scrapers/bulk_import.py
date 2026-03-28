"""
Bulk import from HuggingFace dataset: dmedhi/indian-medicines
Pulls 11,825 Indian medicines with composition, uses, side effects, image URLs.
Run with: python -m app.scrapers.bulk_import
"""

import asyncio
import re
import unicodedata
from datasets import load_dataset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session
from app.models.db.models import Drug, Salt, DrugSalt


# ── Helpers ───────────────────────────────────────────────────

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text


def parse_composition(composition: str) -> list[dict]:
    """
    Parse '(500mg) + Clavulanic Acid (125mg)' 
    into [{'inn_name': 'Amoxycillin', 'quantity': '500mg'}, ...]
    """
    salts = []
    parts = [p.strip() for p in composition.split("+")]
    for part in parts:
        match = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", part.strip())
        if match:
            inn_name = match.group(1).strip()
            quantity = match.group(2).strip()
            salts.append({"inn_name": inn_name, "quantity": quantity})
        else:
            # No quantity found — just a salt name
            if part.strip():
                salts.append({"inn_name": part.strip(), "quantity": None})
    return salts


def extract_dosage_form(name: str) -> str | None:
    """Extract dosage form from drug name."""
    forms = [
        "Tablet", "Capsule", "Syrup", "Injection", "Cream", "Gel",
        "Drops", "Inhaler", "Suspension", "Ointment", "Lotion",
        "Spray", "Patch", "Powder", "Solution", "Lozenges", "Respules",
    ]
    name_lower = name.lower()
    for form in forms:
        if form.lower() in name_lower:
            return form
    return None


async def get_or_create_salt(session: AsyncSession, inn_name: str) -> Salt:
    """Get existing salt or create new one."""
    result = await session.execute(
        select(Salt).where(Salt.inn_name == inn_name)
    )
    salt = result.scalar_one_or_none()
    if not salt:
        salt = Salt(inn_name=inn_name)
        session.add(salt)
        await session.flush()  # get the ID without committing
    return salt


async def import_row(session: AsyncSession, row: dict, seen_slugs: set) -> bool:
    """Import a single row. Returns True if inserted, False if skipped."""
    name = (row.get("name") or "").strip()
    composition = (row.get("composition") or "").strip()
    uses = (row.get("uses") or "").strip() or None
    side_effects = (row.get("side_effects") or "").strip() or None
    image_url = (row.get("image_url") or "").strip() or None

    if not name or not composition:
        return False

    # Generate unique slug
    base_slug = slugify(name)
    slug = base_slug
    counter = 1
    while slug in seen_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    seen_slugs.add(slug)

    # Check if drug already exists
    result = await session.execute(
        select(Drug).where(Drug.slug == slug)
    )
    if result.scalar_one_or_none():
        return False  # already imported

    # Create drug
    drug = Drug(
        brand_name=name,
        dosage_form=extract_dosage_form(name),
        slug=slug,
        uses=uses,
        side_effects=side_effects,
        image_url=image_url,
        schedule="OTC",  # default — dataset doesn't have schedule info
    )
    session.add(drug)
    await session.flush()  # get drug.id

    # Parse and link salts
    salt_entries = parse_composition(composition)
    for entry in salt_entries:
        salt = await get_or_create_salt(session, entry["inn_name"])
        drug_salt = DrugSalt(
            drug_id=drug.id,
            salt_id=salt.id,
            quantity=entry["quantity"],
        )
        session.add(drug_salt)

    return True


async def run_import():
    print("Loading dataset from HuggingFace...")
    dataset = load_dataset("dmedhi/indian-medicines", split="train")
    rows = list(dataset)
    print(f"Loaded {len(rows)} rows.")

    inserted = 0
    skipped = 0
    errors = 0
    seen_slugs: set = set()

    # Process in batches of 100
    batch_size = 100
    async with async_session() as session:
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            try:
                for row in batch:
                    result = await import_row(session, row, seen_slugs)
                    if result:
                        inserted += 1
                    else:
                        skipped += 1
                await session.commit()
                print(f"Progress: {min(i + batch_size, len(rows))}/{len(rows)} — inserted {inserted}, skipped {skipped}")
            except Exception as e:
                await session.rollback()
                errors += 1
                print(f"Batch error at row {i}: {e}")

    print(f"\nDone! Inserted: {inserted} | Skipped: {skipped} | Errors: {errors}")


if __name__ == "__main__":
    asyncio.run(run_import())