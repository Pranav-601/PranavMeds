"""
Seed script: Inserts 20 well-known Indian drug pairs into the database.
Run: python -m app.seed
"""

import asyncio
from sqlalchemy import select
from app.core.database import engine, async_session, Base
from app.models.db.models import Salt, Drug, DrugSalt, DataSource


# ── Seed Data ─────────────────────────────────────────────────
# 20 well-known Indian drug pairs (branded ↔ generic)

SALTS = [
    {"inn_name": "Paracetamol", "atc_code": "N02BE01", "pharmacological_class": "Analgesic/Antipyretic"},
    {"inn_name": "Ibuprofen", "atc_code": "M01AE01", "pharmacological_class": "NSAID"},
    {"inn_name": "Cetirizine", "atc_code": "R06AE07", "pharmacological_class": "Antihistamine"},
    {"inn_name": "Azithromycin", "atc_code": "J01FA10", "pharmacological_class": "Macrolide Antibiotic"},
    {"inn_name": "Amoxicillin", "atc_code": "J01CA04", "pharmacological_class": "Penicillin Antibiotic"},
    {"inn_name": "Omeprazole", "atc_code": "A02BC01", "pharmacological_class": "Proton Pump Inhibitor"},
    {"inn_name": "Pantoprazole", "atc_code": "A02BC02", "pharmacological_class": "Proton Pump Inhibitor"},
    {"inn_name": "Metformin", "atc_code": "A10BA02", "pharmacological_class": "Antidiabetic (Biguanide)"},
    {"inn_name": "Atorvastatin", "atc_code": "C10AA05", "pharmacological_class": "Statin"},
    {"inn_name": "Amlodipine", "atc_code": "C08CA01", "pharmacological_class": "Calcium Channel Blocker"},
    {"inn_name": "Ciprofloxacin", "atc_code": "J01MA02", "pharmacological_class": "Fluoroquinolone Antibiotic"},
    {"inn_name": "Domperidone", "atc_code": "A03FA03", "pharmacological_class": "Antiemetic"},
    {"inn_name": "Ranitidine", "atc_code": "A02BA02", "pharmacological_class": "H2 Receptor Antagonist"},
    {"inn_name": "Levocetirizine", "atc_code": "R06AE09", "pharmacological_class": "Antihistamine"},
    {"inn_name": "Montelukast", "atc_code": "R03DC03", "pharmacological_class": "Leukotriene Receptor Antagonist"},
    {"inn_name": "Caffeine", "atc_code": "N06BC01", "pharmacological_class": "CNS Stimulant"},
    {"inn_name": "Diclofenac", "atc_code": "M01AB05", "pharmacological_class": "NSAID"},
    {"inn_name": "Clavulanic Acid", "atc_code": "J01CR02", "pharmacological_class": "Beta-Lactamase Inhibitor"},
    {"inn_name": "Dextromethorphan", "atc_code": "R05DA09", "pharmacological_class": "Antitussive"},
    {"inn_name": "Phenylephrine", "atc_code": "R01BA03", "pharmacological_class": "Decongestant"},
    {"inn_name": "Chlorpheniramine", "atc_code": "R06AB04", "pharmacological_class": "Antihistamine"},
]

DRUGS = [
    # ── Paracetamol pairs ──
    {"brand_name": "Crocin 650", "manufacturer": "GSK", "dosage_form": "Tablet", "strength": "650mg", "mrp": 30.00, "schedule": "OTC", "nlem_listed": True, "slug": "crocin-650",
     "salts": [("Paracetamol", "650mg")]},

    {"brand_name": "Dolo 650", "manufacturer": "Micro Labs", "dosage_form": "Tablet", "strength": "650mg", "mrp": 31.64, "schedule": "OTC", "nlem_listed": True, "slug": "dolo-650",
     "salts": [("Paracetamol", "650mg")]},

    # ── Ibuprofen + Paracetamol combo ──
    {"brand_name": "Combiflam", "manufacturer": "Sanofi", "dosage_form": "Tablet", "strength": "400mg+325mg", "mrp": 42.00, "schedule": "H", "nlem_listed": False, "slug": "combiflam",
     "salts": [("Ibuprofen", "400mg"), ("Paracetamol", "325mg")]},

    {"brand_name": "Ibugesic Plus", "manufacturer": "Cipla", "dosage_form": "Tablet", "strength": "400mg+325mg", "mrp": 35.00, "schedule": "H", "nlem_listed": False, "slug": "ibugesic-plus",
     "salts": [("Ibuprofen", "400mg"), ("Paracetamol", "325mg")]},

    # ── Cetirizine pairs ──
    {"brand_name": "Zyrtec", "manufacturer": "UCB", "dosage_form": "Tablet", "strength": "10mg", "mrp": 68.00, "schedule": "H", "nlem_listed": True, "slug": "zyrtec",
     "salts": [("Cetirizine", "10mg")]},

    {"brand_name": "Alerid", "manufacturer": "Cipla", "dosage_form": "Tablet", "strength": "10mg", "mrp": 32.00, "schedule": "H", "nlem_listed": True, "slug": "alerid",
     "salts": [("Cetirizine", "10mg")]},

    # ── Azithromycin pairs ──
    {"brand_name": "Azithral 500", "manufacturer": "Alembic", "dosage_form": "Tablet", "strength": "500mg", "mrp": 107.00, "schedule": "H", "nlem_listed": True, "slug": "azithral-500",
     "salts": [("Azithromycin", "500mg")]},

    {"brand_name": "Zithromax", "manufacturer": "Pfizer", "dosage_form": "Tablet", "strength": "500mg", "mrp": 165.00, "schedule": "H", "nlem_listed": True, "slug": "zithromax",
     "salts": [("Azithromycin", "500mg")]},

    # ── Amoxicillin pairs ──
    {"brand_name": "Mox 500", "manufacturer": "Ranbaxy", "dosage_form": "Capsule", "strength": "500mg", "mrp": 85.00, "schedule": "H", "nlem_listed": True, "slug": "mox-500",
     "salts": [("Amoxicillin", "500mg")]},

    {"brand_name": "Novamox 500", "manufacturer": "Cipla", "dosage_form": "Capsule", "strength": "500mg", "mrp": 78.00, "schedule": "H", "nlem_listed": True, "slug": "novamox-500",
     "salts": [("Amoxicillin", "500mg")]},

    # ── Omeprazole pairs ──
    {"brand_name": "Omez 20", "manufacturer": "Dr. Reddy's", "dosage_form": "Capsule", "strength": "20mg", "mrp": 75.00, "schedule": "H", "nlem_listed": True, "slug": "omez-20",
     "salts": [("Omeprazole", "20mg")]},

    {"brand_name": "Prilosec", "manufacturer": "AstraZeneca", "dosage_form": "Capsule", "strength": "20mg", "mrp": 120.00, "schedule": "H", "nlem_listed": True, "slug": "prilosec",
     "salts": [("Omeprazole", "20mg")]},

    # ── Pantoprazole + Domperidone combo ──
    {"brand_name": "Pan-D", "manufacturer": "Alkem", "dosage_form": "Capsule", "strength": "40mg+30mg", "mrp": 145.00, "schedule": "H", "nlem_listed": False, "slug": "pan-d",
     "salts": [("Pantoprazole", "40mg"), ("Domperidone", "30mg")]},

    {"brand_name": "Pantocid-DSR", "manufacturer": "Sun Pharma", "dosage_form": "Capsule", "strength": "40mg+30mg", "mrp": 175.00, "schedule": "H", "nlem_listed": False, "slug": "pantocid-dsr",
     "salts": [("Pantoprazole", "40mg"), ("Domperidone", "30mg")]},

    # ── Metformin pairs ──
    {"brand_name": "Glycomet 500", "manufacturer": "USV", "dosage_form": "Tablet", "strength": "500mg", "mrp": 28.00, "schedule": "H", "nlem_listed": True, "slug": "glycomet-500",
     "salts": [("Metformin", "500mg")]},

    {"brand_name": "Glucophage 500", "manufacturer": "Merck", "dosage_form": "Tablet", "strength": "500mg", "mrp": 45.00, "schedule": "H", "nlem_listed": True, "slug": "glucophage-500",
     "salts": [("Metformin", "500mg")]},

    # ── Atorvastatin pairs ──
    {"brand_name": "Atorva 10", "manufacturer": "Zydus", "dosage_form": "Tablet", "strength": "10mg", "mrp": 95.00, "schedule": "H", "nlem_listed": True, "slug": "atorva-10",
     "salts": [("Atorvastatin", "10mg")]},

    {"brand_name": "Lipitor 10", "manufacturer": "Pfizer", "dosage_form": "Tablet", "strength": "10mg", "mrp": 180.00, "schedule": "H", "nlem_listed": True, "slug": "lipitor-10",
     "salts": [("Atorvastatin", "10mg")]},

    # ── Amlodipine pairs ──
    {"brand_name": "Amlokind 5", "manufacturer": "Mankind", "dosage_form": "Tablet", "strength": "5mg", "mrp": 35.00, "schedule": "H", "nlem_listed": True, "slug": "amlokind-5",
     "salts": [("Amlodipine", "5mg")]},

    {"brand_name": "Norvasc 5", "manufacturer": "Pfizer", "dosage_form": "Tablet", "strength": "5mg", "mrp": 130.00, "schedule": "H", "nlem_listed": True, "slug": "norvasc-5",
     "salts": [("Amlodipine", "5mg")]},
]

DATA_SOURCES = [
    {"name": "manual_seed", "confidence": "high", "description": "Manually verified drug data for initial testing"},
    {"name": "cdsco", "confidence": "high", "description": "Central Drugs Standard Control Organisation"},
    {"name": "nppa", "confidence": "high", "description": "National Pharmaceutical Pricing Authority"},
    {"name": "jan_aushadhi", "confidence": "high", "description": "PM Bhartiya Janaushadhi Pariyojana"},
    {"name": "data_gov_in", "confidence": "medium", "description": "Open Government Data Platform India"},
]


async def seed():
    """Seed the database with initial drug data."""
    print("🌱 Starting database seed...")

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created")

    async with async_session() as session:
        # Check if data already exists
        result = await session.execute(select(Drug).limit(1))
        if result.scalar_one_or_none():
            print("⏭️  Database already has data, skipping seed.")
            return

        # Insert data sources
        source_map = {}
        for ds_data in DATA_SOURCES:
            ds = DataSource(**ds_data)
            session.add(ds)
            source_map[ds_data["name"]] = ds
        await session.flush()
        print(f"✅ Inserted {len(DATA_SOURCES)} data sources")

        # Insert salts
        salt_map = {}
        for salt_data in SALTS:
            salt = Salt(**salt_data)
            session.add(salt)
            salt_map[salt_data["inn_name"]] = salt
        await session.flush()
        print(f"✅ Inserted {len(SALTS)} salts")

        # Insert drugs with their salt compositions
        for drug_data in DRUGS:
            salt_links = drug_data.pop("salts")
            drug = Drug(**drug_data)
            session.add(drug)
            await session.flush()  # Get drug.id

            for salt_name, quantity in salt_links:
                drug_salt = DrugSalt(
                    drug_id=drug.id,
                    salt_id=salt_map[salt_name].id,
                    quantity=quantity,
                )
                session.add(drug_salt)

        await session.commit()
        print(f"✅ Inserted {len(DRUGS)} drugs with salt compositions")

    print("🎉 Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
