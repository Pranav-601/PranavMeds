# Pranavtics — Master Build Reference Guide
> Last verified: March 27, 2026

---

## 1. Verified Tech Stack — Exact Versions

| Layer | Technology | Latest Version | Min Runtime Required |
|-------|-----------|---------------|---------------------|
| **Language (Backend)** | Python | **3.12.13** | — |
| **Language (Frontend)** | Node.js | **24.14.1 LTS** (Krypton) | Node 20+ for Tailwind v4 |
| **Backend Framework** | FastAPI | **0.135.1** | Python 3.9+ |
| **Data Validation** | Pydantic | **v2.9+** (v1 is dead) | Python 3.9+ |
| **Frontend Framework** | Next.js | **16.2** | Node 20+ |
| **Styling** | Tailwind CSS | **v4** (Oxide engine) | Node 20+, Safari 16.4+/Chrome 111+/Firefox 128+ |
| **Data Fetching** | TanStack Query | **5.95.2** | React 18+ |
| **Database** | PostgreSQL | **18.3** | — |
| **Vector Search** | pgvector | Latest (supports PG 13+) | PostgreSQL 13+ |
| **Search Engine** | Typesense Server | **30.1** | — |
| **Typesense Client** | typesense (Python) | **2.0.0** | Python 3.9+ |
| **Scraping Framework** | Scrapy | **2.14.2** | Python 3.10+ |
| **PDF Parsing** | pdfplumber | Latest | Python 3.8+ |
| **PDF Tables** | tabula-py | **9.0+** | Python 3.12 (jpype optional) |
| **Excel Parsing** | pandas | Latest | Python 3.9+ |
| **Cache** | Redis Server | **8.6.1** | — |
| **Redis Client** | redis-py | **6.2.0+** | Python 3.9+ |
| **HTTP Client** | requests | Latest | Python 3.7+ |
| **HTML Parsing** | BeautifulSoup4 | Latest | Python 3.6+ |

---

## 2. Compatibility Matrix — ✅ Confirmed

```mermaid
graph TD
    subgraph Python["Python 3.12 Ecosystem"]
        FastAPI["FastAPI 0.135.1"]
        Pydantic["Pydantic v2.9+"]
        Scrapy["Scrapy 2.14.2"]
        RedisPy["redis-py 6.2.0+"]
        TSClient["typesense 2.0.0"]
        Pandas["pandas"]
        PDFPlumber["pdfplumber"]
        TabulaPy["tabula-py 9.0+"]

        FastAPI --> Pydantic
        FastAPI --> RedisPy
        FastAPI --> TSClient
    end

    subgraph Node["Node.js 24 LTS Ecosystem"]
        NextJS["Next.js 16.2"]
        Tailwind["Tailwind CSS v4"]
        TanStack["TanStack Query 5.95"]
        React["React 19"]

        NextJS --> React
        NextJS --> Tailwind
        NextJS --> TanStack
    end

    subgraph Infra["Infrastructure"]
        PG["PostgreSQL 18.3"]
        PGVector["pgvector"]
        Redis["Redis 8.6.1"]
        TS["Typesense 30.1"]

        PG --> PGVector
    end

    FastAPI --> PG
    FastAPI --> Redis
    FastAPI --> TS
    NextJS -->|"API calls"| FastAPI
```

> [!TIP]
> **Python 3.12** is the sweet spot — all libraries support it. Don't use 3.13/3.14 yet (some libraries like jpype have edge-case issues).

---

## 3. 🚨 Critical Issues & Gotchas Found

### 🔴 Issue 1: Pydantic v1 is DEAD — Use v2 Only

FastAPI 0.135.1 requires **Pydantic ≥ 2.9.0**. Pydantic v1 support was dropped in FastAPI 0.126.0.

**What this means:**
- Use `@field_validator` not `@validator`
- Use `model_config = ConfigDict(from_attributes=True)` not `class Config: orm_mode = True`
- `Optional[T]` now means "required but can be None" — use `T | None = None` for truly optional fields

**All tutorials from 2023 or earlier are using v1 syntax. Don't copy them.**

---

### 🔴 Issue 2: Tailwind CSS v4 is a Ground-Up Rewrite

Tailwind v4 uses a **CSS-first configuration** — no more `tailwind.config.js`.

**Breaking changes you'll hit:**
- Replace `@tailwind base; @tailwind components; @tailwind utilities;` with `@import "tailwindcss";`
- Config goes in CSS using `@theme { }` blocks, not JS
- `bg-opacity-*` → `bg-black/50` (opacity modifier syntax)
- `shadow-sm` → `shadow-xs` (scale rename)
- Default border color is now `currentColor` not `gray-200`
- Requires **Node.js 20+** and targets **modern browsers only** (Safari 16.4+, Chrome 111+, Firefox 128+)
- PostCSS plugin is now `@tailwindcss/postcss` (separate package)

> [!CAUTION]
> If you follow any Tailwind tutorial from before 2025, the setup won't work. Use the v4 docs only: [tailwindcss.com/docs](https://tailwindcss.com/docs)

---

### 🔴 Issue 3: Typesense Cloud "Free Tier" is a One-Time Trial

Typesense Cloud gives you **720 hours** (≈30 days) of free cluster time + 10 GB bandwidth. **It does not renew monthly.** After that, minimum pricing is ~$7/month (0.5 GB RAM cluster).

**Recommendation:** Self-host Typesense via Docker on Railway during development. Move to Typesense Cloud only for production if you want managed infra.

---

### 🟡 Issue 4: Vercel Hobby Plan = Non-Commercial Only

Vercel's free "Hobby" plan explicitly restricts your project to **personal, non-commercial use**. If Pranavtics generates revenue (ads, premium, etc.), you need the **Pro plan ($20/mo)**.

**Free tier limits:**
- 100K serverless function invocations/month
- 100 GB bandwidth/month
- 60 sec max function duration

---

### 🟡 Issue 5: Railway Pricing is Higher Than You Think

Railway's "free tier" gives $5 in credits and then costs **$1/month** base. The Hobby plan ($5/mo) includes $5 in credits.

**Realistic monthly cost for FastAPI + PostgreSQL + Redis:**
- Minimal usage (hobby project): ~$5–15/mo on Hobby plan
- With moderate traffic: ~$20–40/mo (Pro plan recommended)
- PostgreSQL with 2 vCPU + 4 GB RAM + 50 GB storage alone ≈ $92/mo

**Budget recommendation:** Start with Hobby ($5/mo). Use minimal resource limits. Scale only when needed.

---

### 🟡 Issue 6: tabula-py + jpype on Python 3.12

`tabula-py` 9.0 made `jpype` optional because jpype had compatibility issues with Python 3.12. This means:
- `tabula-py` works on 3.12 **without jpype** (uses subprocess to call Java)
- It will be **slower** than with jpype, but functional
- You need **Java 8+** installed on any machine running tabula-py

**Alternative:** Use `pdfplumber` instead for most PDF parsing. Only use `tabula-py` for complex table extraction where `pdfplumber` fails.

---

### 🟡 Issue 7: Scrapy 2.14+ Requires Python 3.10+

Scrapy dropped Python 3.9 support. This isn't a problem if you're on 3.12, but if any of your deployment environments default to an older Python (e.g., some Railway/GitHub Actions base images), you'll get silent failures.

**Fix:** Always pin `python: "3.12"` explicitly in your Dockerfile, `pyproject.toml`, and GitHub Actions workflow.

---

### 🟡 Issue 8: CDSCO Scraping May Need Playwright

CDSCO's drug database pages may use JavaScript-rendered pagination (click-to-load rather than URL-based `?page=N`). If that's the case:
- `requests` + `BeautifulSoup` won't work
- Use **Playwright** (async, headless browser) or **Scrapy + scrapy-playwright**
- Always check the site's `robots.txt` before scraping
- Add 2–5 second delays between requests to avoid IP bans

---

## 4. Dependency Lock File — `pyproject.toml`

```toml
[project]
name = "pranavtics-backend"
requires-python = ">=3.12,<3.13"

dependencies = [
    "fastapi>=0.135.0",
    "uvicorn[standard]>=0.34.0",
    "pydantic>=2.9.0",
    "sqlalchemy>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.15.0",
    "redis>=6.2.0",
    "typesense>=2.0.0",
    "scrapy>=2.14.0",
    "pdfplumber>=0.11.0",
    "tabula-py>=9.0.0",
    "pandas>=2.2.0",
    "requests>=2.32.0",
    "beautifulsoup4>=4.12.0",
    "rapidfuzz>=3.10.0",
    "httpx>=0.28.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "ruff>=0.9.0",
]
```

---

## 5. Frontend `package.json` Dependencies

```json
{
  "dependencies": {
    "next": "^16.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.95.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## 6. Phase-by-Phase Build Checklist

### Phase 0: Foundation (Days 1–3)

- [ ] Install Python 3.12.13 + Node.js 24 LTS
- [ ] Set up Docker with PostgreSQL 18.3 + Redis 8.6
    ```bash
    docker run -d --name pranavtics-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:18.3
    docker run -d --name pranavtics-redis -p 6379:6379 redis:8.6
    ```
- [ ] Create project structure:
    ```
    pranavtics/
    ├── backend/          # FastAPI + scrapers
    │   ├── app/
    │   │   ├── api/      # route handlers
    │   │   ├── models/   # SQLAlchemy + Pydantic models
    │   │   ├── scrapers/ # data pipeline
    │   │   ├── services/ # business logic
    │   │   └── core/     # config, db connection
    │   ├── alembic/      # migrations
    │   ├── tests/
    │   └── pyproject.toml
    ├── frontend/         # Next.js 16
    └── docker-compose.yml
    ```
- [ ] Create PostgreSQL schema with Alembic migration:
    ```sql
    -- Core tables
    CREATE TABLE salts (
        id SERIAL PRIMARY KEY,
        inn_name TEXT UNIQUE NOT NULL,
        atc_code TEXT,
        pharmacological_class TEXT
    );

    CREATE TABLE salt_aliases (
        id SERIAL PRIMARY KEY,
        alias TEXT UNIQUE NOT NULL,
        salt_id INT REFERENCES salts(id)
    );

    CREATE TABLE drugs (
        id SERIAL PRIMARY KEY,
        brand_name TEXT NOT NULL,
        manufacturer TEXT,
        dosage_form TEXT,
        strength TEXT,
        mrp DECIMAL(10,2),
        is_banned BOOLEAN DEFAULT FALSE,
        schedule TEXT,
        nlem_listed BOOLEAN DEFAULT FALSE,
        license_number TEXT
    );

    CREATE TABLE drug_salts (
        drug_id INT REFERENCES drugs(id),
        salt_id INT REFERENCES salts(id),
        quantity TEXT,
        PRIMARY KEY (drug_id, salt_id)
    );

    CREATE TABLE prices (
        id SERIAL PRIMARY KEY,
        drug_id INT REFERENCES drugs(id),
        source TEXT NOT NULL,
        price DECIMAL(10,2),
        ceiling_price DECIMAL(10,2),
        scraped_at TIMESTAMP DEFAULT NOW()
    );
    ```
- [ ] FastAPI skeleton with 2 endpoints:
    - `GET /api/v1/search?q=` — basic DB search
    - `GET /api/v1/drug/{id}` — drug detail
- [ ] Next.js 16 scaffold:
    ```bash
    npx -y create-next-app@latest ./frontend --typescript --tailwind --app --src-dir --no-import-alias
    ```
- [ ] Seed 20 drug pairs manually (Crocin↔Dolo, Combiflam↔Ibugesic, etc.)
- [ ] Verify end-to-end: type drug name → see JSON on screen

**✅ Milestone: One comparison works from browser to DB and back.**

---

### Phase 1: Data Pipeline — NLEM + Jan Aushadhi (Days 4–10)

- [ ] Download NLEM PDF from MoHFW
- [ ] Parse NLEM PDF with `pdfplumber` → extract ~400 drug names
- [ ] Write Jan Aushadhi scraper → extract generic name, salt, MRP
- [ ] Build salt normalizer v1:
    - Static lookup JSON for top 100 salts
    - INN names as canonical
    - Handle "Paracetamol" / "Acetaminophen" / "Para-Acetylaminophenol"
- [ ] Create `salt_aliases` table and populate
- [ ] Build `ingest.py` — idempotent script: scrape → normalize → upsert
- [ ] Write golden dataset test: 50 known drug-salt mappings
- [ ] Add legal disclaimer text to DB seed

**✅ Milestone: DB has 400+ real drugs with real salt compositions.**

---

### Phase 2: CDSCO + NPPA Scrapers (Days 11–18)

- [ ] Check CDSCO robots.txt before scraping
- [ ] Determine if CDSCO uses URL-based or JS-rendered pagination
    - If URL-based: use `Scrapy` with `requests`
    - If JS-rendered: use `scrapy-playwright`
- [ ] Write CDSCO scraper → brand name, manufacturer, salt, dosage form, license #
- [ ] Write NPPA Excel scraper → ceiling prices, DPCO scheduled drugs
- [ ] Download + parse data.gov.in drug datasets
- [ ] Expand salt normalizer v2:
    - Add IPC pharmacopoeia canonical names
    - Handle multi-salt FDCs ("Paracetamol 500mg + Caffeine 65mg")
    - Add fuzzy matching with `rapidfuzz`
- [ ] Populate `prices` table with source + date
- [ ] Add `is_banned`, `schedule`, `nlem_listed` flags
- [ ] Run golden dataset tests — ensure no regressions

**✅ Milestone: DB has 5,000+ drugs with pricing from multiple sources.**

---

### Phase 3: Search + Comparison Backend (Days 19–25)

- [ ] Deploy Typesense locally via Docker:
    ```bash
    docker run -d --name typesense -p 8108:8108 \
      -v typesense-data:/data typesense/typesense:30.1 \
      --data-dir /data --api-key=dev-key
    ```
- [ ] Create Typesense collection schema + index `drugs` table
- [ ] Upgrade `GET /api/v1/search` to hit Typesense (fuzzy, typo-tolerant)
- [ ] Build `POST /api/v1/compare`:
    - Input: two drug IDs
    - Output: salt overlap %, price diff, "safe to substitute?" verdict
    - Logic: same salts + same strength + same form = safe
    - Add `substitution_risk_level` (low/medium/high)
    - Add source citations
- [ ] Build `GET /api/v1/interactions` (static seed data for major interactions)
- [ ] Add Redis caching (1hr TTL) for search + comparison results
- [ ] Add API versioning (`/api/v1/`)
- [ ] Write integration tests for comparison logic

**✅ Milestone: API returns real comparison verdicts with fuzzy search.**

---

### Phase 4: Frontend — Production UI (Days 26–35)

- [ ] Set up Tailwind v4 correctly:
    ```css
    /* app/globals.css */
    @import "tailwindcss";

    @theme {
      --color-primary: oklch(0.65 0.19 255);
      --color-surface: oklch(0.15 0.02 260);
      --font-sans: 'Inter', sans-serif;
    }
    ```
- [ ] Install Inter font from Google Fonts
- [ ] Build search autocomplete component:
    - Client component with `useQuery`
    - Debounced input (300ms)
    - Dropdown shows drug name + salt preview
- [ ] Build comparison page (`/compare/[drug1]-vs-[drug2]`):
    - Two-column layout with sticky header
    - "Safe to substitute?" badge (green/amber/red)
    - Sections: salts, pricing, manufacturer, regulatory status
    - Shareable URL (SEO-friendly slugs)
- [ ] Build drug detail page (`/drug/[slug]`):
    - Server component for SEO
    - Salt composition, alternatives, price history, manufacturer
- [ ] Build homepage:
    - Hero with search bar
    - "Popular comparisons" grid
    - Trust badges (CDSCO, NPPA, NLEM data sources)
    - Legal disclaimer footer
- [ ] Dark mode support
- [ ] Mobile responsive testing
- [ ] Accessibility (WCAG AA contrast, keyboard nav)

**✅ Milestone: Polished, responsive app ready for real users.**

---

### Phase 5: Deployment + Automation (Days 36–42)

- [ ] Create `Dockerfile` for FastAPI backend
- [ ] Create `docker-compose.yml` for local full-stack dev
- [ ] Deploy Next.js to Vercel:
    - Set `NEXT_PUBLIC_API_URL` env var
    - Verify server components render correctly
- [ ] Deploy FastAPI + PostgreSQL + Redis to Railway:
    - Use Hobby plan ($5/mo) to start
    - Set connection strings as env vars
    - Enable persistent volumes for PostgreSQL
- [ ] Set up Typesense (self-hosted on Railway or Typesense Cloud)
- [ ] Set up Cloudflare DNS + CDN for your domain
- [ ] Create GitHub Actions workflow for weekly scraper runs:
    ```yaml
    name: Weekly Data Refresh
    on:
      schedule:
        - cron: '0 2 * * 1'  # Every Monday at 2 AM UTC
    jobs:
      scrape:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-python@v5
            with:
              python-version: '3.12'
          - run: pip install -e .
          - run: python -m app.scrapers.ingest
          - run: python -m app.services.reindex_typesense
    ```
- [ ] Set up error alerting (Sentry free tier)
- [ ] Set up uptime monitoring (UptimeRobot free tier)

**✅ Milestone: Live in production, data refreshing weekly.**

---

## 7. Potential Issues You'll Hit (and Solutions)

| # | Issue | When You'll Hit It | Solution |
|---|-------|--------------------|----------|
| 1 | CDSCO changes their HTML structure | Phase 2, then randomly in production | Write selectors loosely, add monitoring for scraper failures, alert on zero-result scrapes |
| 2 | NPPA publishes PDFs instead of Excel for some data | Phase 2 | Have both `pdfplumber` + `pandas` pipelines, detect file type before parsing |
| 3 | Salt name has Unicode characters or Hindi text | Phase 1-2 | Normalize all text to NFKD Unicode, strip diacritics, lowercase before comparison |
| 4 | Multi-salt FDC ordering differs between sources | Phase 2 | Sort salt components alphabetically before comparing: `"Caffeine + Paracetamol"` = `"Paracetamol + Caffeine"` |
| 5 | CORS errors between Next.js and FastAPI | Phase 0 | Add `CORSMiddleware` in FastAPI: allow origins `["http://localhost:3000", "https://your-domain.com"]` |
| 6 | Typesense index grows beyond free tier | Phase 5 | Monitor document count, implement data cleanup for old price records |
| 7 | Railway cold starts make API slow | Phase 5 | Keep a health check endpoint that Railway pings, or add a cron ping every 5 min |
| 8 | Government sites block your IP | Phase 2 | Use respectful rate limiting (3-5 sec between requests), rotate user agents, consider proxy rotation for prod |
| 9 | Next.js server component hydration mismatches | Phase 4 | Keep search/autocomplete as client components, comparison results as server components |
| 10 | Alembic migration conflicts when schema changes | Phase 1+ | Always run `alembic check` before creating new migrations, autogenerate and review |

---

## 8. Monthly Cost Estimate

| Service | Free Tier | Hobby/Paid | Notes |
|---------|-----------|-----------|-------|
| **Vercel** | Free (non-commercial) | $20/mo Pro | Switch to Pro if monetizing |
| **Railway** | $5 credits once | $5/mo Hobby | $5 credits included, pay overage |
| **Typesense Cloud** | 720hrs once | ~$7/mo | Or self-host on Railway |
| **Cloudflare** | Free forever | — | DNS + CDN + DDoS |
| **Sentry** | Free (5K events/mo) | — | Error tracking |
| **UptimeRobot** | Free (50 monitors) | — | Uptime monitoring |
| **GitHub Actions** | 2000 min/mo free | — | Weekly scraper runs |
| | | | |
| **Total (MVP)** | **~$0–5/mo** | **~$12–32/mo** | Depends on traffic |

---

## 9. Quick Reference Commands

```bash
# === BACKEND ===
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac/Linux

# Install dependencies
pip install -e ".[dev]"

# Run FastAPI dev server
uvicorn app.main:app --reload --port 8000

# Run database migrations
alembic upgrade head

# Run scrapers
python -m app.scrapers.ingest

# Run tests
pytest tests/ -v

# === FRONTEND ===
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# === DOCKER (full stack) ===
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose logs -f backend    # View backend logs

# === TYPESENSE ===
# Health check
curl http://localhost:8108/health

# === DATABASE ===
# Connect to local PostgreSQL
psql -h localhost -U postgres -d pranavtics
```

---

## 10. File/Folder Naming Convention

```
pranavtics/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app entry
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic Settings
│   │   │   ├── database.py          # SQLAlchemy engine + session
│   │   │   └── redis.py             # Redis client
│   │   ├── models/
│   │   │   ├── db/                  # SQLAlchemy ORM models
│   │   │   │   ├── drug.py
│   │   │   │   ├── salt.py
│   │   │   │   └── price.py
│   │   │   └── schemas/             # Pydantic v2 schemas
│   │   │       ├── drug.py
│   │   │       ├── comparison.py
│   │   │       └── search.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── search.py
│   │   │       ├── compare.py
│   │   │       ├── drugs.py
│   │   │       └── interactions.py
│   │   ├── scrapers/
│   │   │   ├── cdsco.py
│   │   │   ├── nppa.py
│   │   │   ├── jan_aushadhi.py
│   │   │   ├── nlem.py
│   │   │   ├── normalizer.py        # Salt normalization engine
│   │   │   └── ingest.py            # Master ingestion script
│   │   └── services/
│   │       ├── comparison.py         # Comparison logic
│   │       ├── search.py             # Typesense integration
│   │       └── reindex_typesense.py
│   ├── alembic/
│   ├── tests/
│   │   ├── golden/                   # Golden dataset fixtures
│   │   ├── test_comparison.py
│   │   ├── test_normalizer.py
│   │   └── test_search.py
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Homepage
│   │   │   ├── globals.css           # Tailwind v4 @theme config
│   │   │   ├── compare/
│   │   │   │   └── [slug]/page.tsx   # Comparison page (server)
│   │   │   └── drug/
│   │   │       └── [slug]/page.tsx   # Drug detail (server)
│   │   ├── components/
│   │   │   ├── SearchAutocomplete.tsx # Client component
│   │   │   ├── ComparisonCard.tsx
│   │   │   ├── SafetyBadge.tsx
│   │   │   └── PriceChart.tsx
│   │   └── lib/
│   │       ├── api.ts                # API client
│   │       └── typesense.ts          # Typesense client
│   ├── package.json
│   └── next.config.ts
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── weekly-scrape.yml
└── README.md
```
