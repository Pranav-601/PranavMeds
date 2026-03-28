"""
Push all drugs from PostgreSQL into Meilisearch.
Run with: python -m app.scrapers.reindex
"""

import asyncio
from sqlalchemy import select
from app.core.database import async_session
from app.models.db.models import Drug
from app.services.search import index_all_drugs


async def run():
    print("Fetching drugs from DB...")
    async with async_session() as session:
        result = await session.execute(
            select(
                Drug.id, Drug.brand_name, Drug.manufacturer,
                Drug.dosage_form, Drug.strength, Drug.mrp,
                Drug.slug, Drug.image_url, Drug.uses
            )
        )
        rows = result.fetchall()

    drugs = [
        {
            "id": r.id,
            "brand_name": r.brand_name,
            "manufacturer": r.manufacturer or "",
            "dosage_form": r.dosage_form or "",
            "strength": r.strength or "",
            "mrp": str(r.mrp) if r.mrp else "",
            "slug": r.slug or "",
            "image_url": r.image_url or "",
            "uses": r.uses or "",
        }
        for r in rows
    ]

    print(f"Indexing {len(drugs)} drugs into Meilisearch...")
    await index_all_drugs(drugs)
    print("Done! Meilisearch index ready.")


if __name__ == "__main__":
    asyncio.run(run())