"""Pydantic v2 schemas for API request/response serialization."""

from pydantic import BaseModel, ConfigDict, computed_field
from decimal import Decimal


# ── Salt Schemas ──────────────────────────────────────────────

class SaltOut(BaseModel):
    id: int
    inn_name: str
    atc_code: str | None = None
    pharmacological_class: str | None = None
    quantity: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def name(self) -> str:
        return self.inn_name


# ── Drug Schemas ──────────────────────────────────────────────

class DrugBrief(BaseModel):
    id: int
    brand_name: str
    manufacturer: str | None = None
    dosage_form: str | None = None
    strength: str | None = None
    mrp: Decimal | None = None
    slug: str | None = None
    image_url: str | None = None      # ← NEW

    model_config = ConfigDict(from_attributes=True)


class DrugDetail(BaseModel):
    id: int
    brand_name: str
    manufacturer: str | None = None
    dosage_form: str | None = None
    strength: str | None = None
    mrp: Decimal | None = None
    is_banned: bool = False
    schedule: str | None = None
    nlem_listed: bool = False
    license_number: str | None = None
    slug: str | None = None
    uses: str | None = None           # ← NEW
    side_effects: str | None = None   # ← NEW
    image_url: str | None = None      # ← NEW
    salts: list[SaltOut] = []

    model_config = ConfigDict(from_attributes=True)


# ── Search Schemas ────────────────────────────────────────────

class SearchResult(BaseModel):
    query: str
    count: int
    results: list[DrugBrief]


# ── Comparison Schemas ────────────────────────────────────────

class ComparisonSalt(BaseModel):
    inn_name: str
    in_drug_a: bool = False
    in_drug_b: bool = False
    quantity_a: str | None = None
    quantity_b: str | None = None


class ComparisonResult(BaseModel):
    drug_a: DrugDetail
    drug_b: DrugDetail
    salt_overlap_pct: float
    safe_to_substitute: bool
    substitution_risk: str
    risk_reason: str
    salts_comparison: list[ComparisonSalt]
    price_difference: Decimal | None = None
    shared_salts: list[str] = []
    only_in_drug_a: list[str] = []
    only_in_drug_b: list[str] = []
    disclaimer: str = (
        "This is for informational purposes only. "
        "Always consult your doctor or pharmacist before switching medicines."
    )