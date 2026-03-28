"""Meilisearch integration — indexing and search."""

import meilisearch_python_sdk as meili
from app.core.config import settings

MEILI_URL = "http://localhost:7700"
MEILI_KEY = "dev-key"
INDEX_NAME = "drugs"


def get_client():
    return meili.Client(MEILI_URL, MEILI_KEY)


async def index_all_drugs(drugs: list[dict]):
    """Index all drugs into Meilisearch. Call once after bulk import."""
    async with meili.AsyncClient(MEILI_URL, MEILI_KEY) as client:
        index = client.index(INDEX_NAME)
        await index.update_settings(
            meili.models.settings.MeilisearchSettings(
                searchable_attributes=["brand_name", "manufacturer", "uses"],
                displayed_attributes=["id", "brand_name", "manufacturer", "dosage_form", "strength", "mrp", "slug", "image_url"],
                ranking_rules=["words", "typo", "proximity", "attribute", "sort", "exactness"],
            )
        )
        await index.add_documents(drugs, primary_key="id")


async def search_drugs(query: str, limit: int = 10) -> list[dict]:
    """Search drugs using Meilisearch — typo tolerant."""
    async with meili.AsyncClient(MEILI_URL, MEILI_KEY) as client:
        index = client.index(INDEX_NAME)
        results = await index.search(query, limit=limit)
        return results.hits