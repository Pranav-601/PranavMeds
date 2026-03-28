"""SQLAlchemy ORM models for the PranavMeds drug database."""

from sqlalchemy import (
    Column, Integer, Text, Numeric, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Salt(Base):
    __tablename__ = "salts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    inn_name = Column(Text, unique=True, nullable=False, index=True)
    atc_code = Column(Text, nullable=True)
    pharmacological_class = Column(Text, nullable=True)

    aliases = relationship("SaltAlias", back_populates="salt", cascade="all, delete-orphan")
    drug_salts = relationship("DrugSalt", back_populates="salt")


class SaltAlias(Base):
    __tablename__ = "salt_aliases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alias = Column(Text, unique=True, nullable=False, index=True)
    salt_id = Column(Integer, ForeignKey("salts.id"), nullable=False)

    salt = relationship("Salt", back_populates="aliases")


class Drug(Base):
    __tablename__ = "drugs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_name = Column(Text, nullable=False, index=True)
    manufacturer = Column(Text, nullable=True)
    dosage_form = Column(Text, nullable=True)
    strength = Column(Text, nullable=True)
    mrp = Column(Numeric(10, 2), nullable=True)
    is_banned = Column(Boolean, default=False)
    schedule = Column(Text, nullable=True)
    nlem_listed = Column(Boolean, default=False)
    license_number = Column(Text, nullable=True)
    slug = Column(Text, unique=True, nullable=True, index=True)

    # ── NEW columns from HuggingFace dataset ──
    uses = Column(Text, nullable=True)
    side_effects = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)

    drug_salts = relationship("DrugSalt", back_populates="drug", cascade="all, delete-orphan")
    prices = relationship("Price", back_populates="drug", cascade="all, delete-orphan")


class DrugSalt(Base):
    __tablename__ = "drug_salts"

    drug_id = Column(Integer, ForeignKey("drugs.id"), primary_key=True)
    salt_id = Column(Integer, ForeignKey("salts.id"), primary_key=True)
    quantity = Column(Text, nullable=True)

    drug = relationship("Drug", back_populates="drug_salts")
    salt = relationship("Salt", back_populates="drug_salts")


class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, unique=True, nullable=False)
    confidence = Column(Text, nullable=False, default="medium")
    description = Column(Text, nullable=True)

    prices = relationship("Price", back_populates="source_ref")


class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=True)
    source = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=True)
    ceiling_price = Column(Numeric(10, 2), nullable=True)
    data_quality = Column(Text, nullable=False, default="medium")
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())

    drug = relationship("Drug", back_populates="prices")
    source_ref = relationship("DataSource", back_populates="prices")