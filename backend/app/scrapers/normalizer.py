"""Salt name normalizer — converts scraped salt names to clean INN-style names."""

import re
import unicodedata

# Common aliases → canonical INN name
SALT_ALIASES: dict[str, str] = {
    "acetaminophen": "Paracetamol",
    "para-acetylaminophenol": "Paracetamol",
    "paracetamol": "Paracetamol",
    "ibuprofen": "Ibuprofen",
    "ibuprofene": "Ibuprofen",
    "caffeine": "Caffeine",
    "anhydrous caffeine": "Caffeine",
    "amoxicillin": "Amoxicillin",
    "amoxycillin": "Amoxicillin",
    "metformin": "Metformin",
    "metformin hydrochloride": "Metformin Hydrochloride",
    "metformin hcl": "Metformin Hydrochloride",
    "cetirizine": "Cetirizine",
    "cetirizine hydrochloride": "Cetirizine Hydrochloride",
    "cetirizine hcl": "Cetirizine Hydrochloride",
    "omeprazole": "Omeprazole",
    "atorvastatin": "Atorvastatin",
    "atorvastatin calcium": "Atorvastatin Calcium",
    "azithromycin": "Azithromycin",
    "diclofenac": "Diclofenac",
    "diclofenac sodium": "Diclofenac Sodium",
    "pantoprazole": "Pantoprazole",
    "pantoprazole sodium": "Pantoprazole Sodium",
    "losartan": "Losartan",
    "losartan potassium": "Losartan Potassium",
    "amlodipine": "Amlodipine",
    "amlodipine besylate": "Amlodipine Besylate",
    "clavulanic acid": "Clavulanic Acid",
    "potassium clavulanate": "Clavulanic Acid",
    "dextromethorphan": "Dextromethorphan",
    "dextromethorphan hydrobromide": "Dextromethorphan Hydrobromide",
    "chlorpheniramine": "Chlorpheniramine",
    "chlorphenamine": "Chlorpheniramine",
    "chlorpheniramine maleate": "Chlorpheniramine Maleate",
    "phenylephrine": "Phenylephrine",
    "phenylephrine hydrochloride": "Phenylephrine Hydrochloride",
    "pseudoephedrine": "Pseudoephedrine",
    "pseudoephedrine hydrochloride": "Pseudoephedrine Hydrochloride",
    "domperidone": "Domperidone",
    "ondansetron": "Ondansetron",
    "ranitidine": "Ranitidine",
    "famotidine": "Famotidine",
    "montelukast": "Montelukast",
    "montelukast sodium": "Montelukast Sodium",
    "salbutamol": "Salbutamol",
    "albuterol": "Salbutamol",
    "levosalbutamol": "Levosalbutamol",
    "levalbuterol": "Levosalbutamol",
    "prednisolone": "Prednisolone",
    "dexamethasone": "Dexamethasone",
    "levocetirizine": "Levocetirizine",
    "levocetirizine dihydrochloride": "Levocetirizine Dihydrochloride",
    "fexofenadine": "Fexofenadine",
    "fexofenadine hydrochloride": "Fexofenadine Hydrochloride",
    "vitamin c": "Ascorbic Acid",
    "ascorbic acid": "Ascorbic Acid",
    "vitamin d3": "Cholecalciferol",
    "cholecalciferol": "Cholecalciferol",
    "vitamin b12": "Cyanocobalamin",
    "cyanocobalamin": "Cyanocobalamin",
    "folic acid": "Folic Acid",
    "folate": "Folic Acid",
    "iron": "Ferrous Sulphate",
    "ferrous sulphate": "Ferrous Sulphate",
    "ferrous sulfate": "Ferrous Sulphate",
    "zinc": "Zinc Sulphate",
    "zinc sulphate": "Zinc Sulphate",
    "zinc sulfate": "Zinc Sulphate",
}


def normalize_text(text: str) -> str:
    """Strip unicode, lowercase, remove extra spaces."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def normalize_salt(raw_name: str) -> str:
    """
    Convert a raw scraped salt name to a canonical INN-style name.
    Returns Title Case if no alias found.
    """
    if not raw_name:
        return ""
    key = normalize_text(raw_name)
    if key in SALT_ALIASES:
        return SALT_ALIASES[key]
    # Title case as fallback — better than all-caps or all-lowercase
    return raw_name.strip().title()


def parse_salt_composition(composition: str) -> list[dict[str, str]]:
    """
    Parse a salt composition string like:
      "Paracetamol 500mg + Ibuprofen 400mg"
    into:
      [{"name": "Paracetamol", "quantity": "500mg"}, {"name": "Ibuprofen", "quantity": "400mg"}]
    """
    if not composition:
        return []

    results = []
    # Split on + or / between components
    parts = re.split(r"\s*[+/]\s*", composition)

    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Try to extract quantity at the end: e.g. "Paracetamol 500mg" or "Paracetamol 500 mg"
        match = re.match(r"^(.+?)\s+([\d.,]+\s*(?:mg|mcg|g|iu|ml|%|mmol|mEq|units?)?)\s*$", part, re.IGNORECASE)
        if match:
            raw_name = match.group(1).strip()
            quantity = match.group(2).strip()
        else:
            raw_name = part
            quantity = ""

        canonical = normalize_salt(raw_name)
        if canonical:
            results.append({"name": canonical, "quantity": quantity})

    return results