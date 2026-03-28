"""
Jan Aushadhi on-demand scraper.
Triggered when a user requests a medicine not in the DB.
Scrapes janaushadhi.gov.in for a specific drug name.
"""

import re
import time
import logging
import requests
from bs4 import BeautifulSoup
from app.scrapers.normalizer import normalize_salt, parse_salt_composition

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}

JAN_AUSHADHI_SEARCH_URL = "https://janaushadhi.gov.in/product.aspx"


def _clean(text: str | None) -> str:
    """Strip whitespace and normalize."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def scrape_jan_aushadhi(drug_name: str) -> list[dict]:
    """
    Search Jan Aushadhi for a drug name and return a list of matching results.

    Each result dict has:
      brand_name, manufacturer, strength, dosage_form, mrp, composition, salts
    """
    results = []

    try:
        logger.info(f"Scraping Jan Aushadhi for: {drug_name}")

        # Step 1 — load the search page to get viewstate tokens (ASP.NET)
        session = requests.Session()
        session.headers.update(HEADERS)

        resp = session.get(JAN_AUSHADHI_SEARCH_URL, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Extract ASP.NET hidden fields required for POST
        viewstate = soup.find("input", {"id": "__VIEWSTATE"})
        viewstate_gen = soup.find("input", {"id": "__VIEWSTATEGENERATOR"})
        event_validation = soup.find("input", {"id": "__EVENTVALIDATION"})

        payload = {
            "__VIEWSTATE": viewstate["value"] if viewstate else "",
            "__VIEWSTATEGENERATOR": viewstate_gen["value"] if viewstate_gen else "",
            "__EVENTVALIDATION": event_validation["value"] if event_validation else "",
            "ctl00$ContentPlaceHolder1$txtSearch": drug_name,
            "ctl00$ContentPlaceHolder1$btnSearch": "Search",
        }

        time.sleep(1.5)  # be polite

        # Step 2 — POST the search form
        resp = session.post(JAN_AUSHADHI_SEARCH_URL, data=payload, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Step 3 — parse result table
        table = soup.find("table", {"id": re.compile(r"GridView|grd|grid", re.IGNORECASE)})
        if not table:
            # Try any table with drug-like data
            tables = soup.find_all("table")
            for t in tables:
                if t.find("tr") and len(t.find_all("tr")) > 2:
                    table = t
                    break

        if not table:
            logger.warning(f"No results table found for: {drug_name}")
            return []

        rows = table.find_all("tr")
        if len(rows) < 2:
            return []

        # Detect column headers from first row
        headers = [_clean(th.get_text()) for th in rows[0].find_all(["th", "td"])]
        logger.info(f"Table headers: {headers}")

        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells or len(cells) < 2:
                continue

            values = [_clean(c.get_text()) for c in cells]
            row_data = dict(zip(headers, values)) if headers else {}

            # Try to extract fields by common column name patterns
            def get_col(*keys: str) -> str:
                for k in keys:
                    for h, v in zip(headers, values):
                        if k.lower() in h.lower():
                            return v
                # fallback: positional
                return ""

            brand_name = get_col("product", "name", "drug") or (values[0] if values else "")
            composition = get_col("composition", "salt", "ingredient", "formula")
            strength = get_col("strength", "dose")
            dosage_form = get_col("form", "type", "dosage")
            mrp_raw = get_col("mrp", "price", "rate", "cost")
            manufacturer = get_col("manufacturer", "company", "mfg")

            if not brand_name:
                continue

            # Clean MRP — extract numeric value
            mrp = None
            mrp_match = re.search(r"[\d,]+\.?\d*", mrp_raw.replace(",", ""))
            if mrp_match:
                try:
                    mrp = float(mrp_match.group())
                except ValueError:
                    pass

            # Parse salt composition
            salts = parse_salt_composition(composition) if composition else []

            results.append({
                "brand_name": brand_name,
                "manufacturer": manufacturer or "Jan Aushadhi",
                "strength": strength,
                "dosage_form": dosage_form or "Tablet",
                "mrp": mrp,
                "composition": composition,
                "salts": salts,
                "source": "jan_aushadhi",
            })

        logger.info(f"Found {len(results)} results for: {drug_name}")

    except requests.exceptions.Timeout:
        logger.error(f"Timeout scraping Jan Aushadhi for: {drug_name}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error scraping Jan Aushadhi: {e}")
    except Exception as e:
        logger.error(f"Unexpected error scraping Jan Aushadhi: {e}", exc_info=True)

    return results