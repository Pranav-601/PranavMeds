# PranavMeds — Build Progress Tracker
> Last updated: March 29, 2026

---

## 🧠 What is PranavMeds?
A neutral, India-focused medicine comparison web app. Users search two medicines, get a side-by-side comparison of salt composition, price, uses, side effects, and a "safe to substitute?" verdict. No e-commerce, no ads — just clean, accurate data.

---

## ✅ Completed Steps

### Step 1 — Database seeded
- PostgreSQL 18.3 running in Docker (`pranavmeds-pg` on port 5432)
- Redis running in Docker (`pranavmeds-redis` on port 6379)
- Meilisearch running in Docker (`pranavmeds-meili` on port 7700)
- 20 seed drugs manually inserted via `python -m app.seed`
- Schema: `drugs`, `salts`, `drug_salts`, `prices`, `data_sources`, `salt_aliases`

### Step 2 — FastAPI server running
- FastAPI 0.135.1 on Python 3.12
- Runs with: `uvicorn app.main:app --reload --port 8000`
- Swagger UI at: `http://localhost:8000/docs`
- CORS configured for `http://localhost:3000`
- Health check at: `http://localhost:8000/health`

### Step 3 — Endpoints tested
- `GET /api/v1/search?q=crocin` ✅ returns drug list
- `GET /api/v1/drug/{id}` ✅ returns full drug detail with salts

### Step 4 — Next.js frontend scaffolded
- Next.js 16.2, React 19, TypeScript, Tailwind CSS v4
- Located at: `PranavMeds/frontend/`
- Runs with: `npm run dev` (port 3000)
- TanStack Query installed: `@tanstack/react-query`

### Step 5 — Search page built
- File: `frontend/src/app/page.tsx`
- Debounced search (300ms) hitting `GET /api/v1/search`
- Medicine images shown next to results
- Select 2 medicines → "Compare →" button appears
- "View details →" link on each result card

### Step 6 — Compare API endpoint built
- File: `backend/app/api/v1/compare.py`
- `POST /api/v1/compare` takes `{ drug_id_1, drug_id_2 }`
- Returns: salt overlap %, price difference, cheaper option, verdict (safe/caution/unsafe), salts comparison table, shared/only-in-a/only-in-b lists
- Registered in `main.py`

### Step 7 — Compare UI page built
- File: `frontend/src/app/compare/[slug]/page.tsx`
- URL format: `/compare/1-vs-2`
- Shows: verdict banner, stats row (salt overlap, price diff, cheaper option), side-by-side drug cards with images, ingredient comparison table with colour coding, summary section, disclaimer

### Step 8 — Meilisearch fuzzy search
- 11,145 drugs indexed into Meilisearch
- Typo-tolerant: searching "crocen" finds "Crocin"
- File: `backend/app/services/search.py`
- Indexer: `backend/app/scrapers/reindex.py` — run with `python -m app.scrapers.reindex`
- Search endpoint now tries Meilisearch first, falls back to SQL ILIKE

### Step 9 — Drug detail page (IN PROGRESS ⬅️ YOU ARE HERE)
- File created: `frontend/src/app/drug/[slug]/page.tsx`
- URL format: `/drug/{drug_id}`
- Shows: medicine image, name, manufacturer, badges (form, strength, schedule, NLEM), price, salt composition table with ATC codes, uses, side effects as tags
- "View details →" link added to search results

---

## ⬜ Remaining Steps

### Step 10 — TanStack Query autocomplete
- Replace raw `fetch` + `useEffect` debounce in search with `useQuery` from `@tanstack/react-query`
- Debounced input (300ms) with proper loading/error states
- Dropdown autocomplete component: `frontend/src/components/SearchAutocomplete.tsx`

### Step 11 — Scrapers (Phase 2)
- `backend/app/scrapers/cdsco.py` — CDSCO drug approvals
- `backend/app/scrapers/nppa.py` — NPPA ceiling prices (Excel parser)
- `backend/app/scrapers/jan_aushadhi.py` — Jan Aushadhi generic catalog
- `backend/app/scrapers/normalizer.py` — Salt name → INN normalization engine
- `backend/app/scrapers/ingest.py` — Master ingestion script

### Step 12 — `POST /api/v1/request-drug` endpoint
- Takes a drug name, queues a background scrape job via FastAPI `BackgroundTasks`
- Returns `202 Accepted`
- "Can't find this medicine? Request it." button on search page when no results

### Step 13 — Deployment
- Next.js → Vercel (free hobby tier, non-commercial)
- FastAPI + PostgreSQL + Redis → Railway ($5/mo hobby plan)
- Meilisearch → self-hosted on Railway or Typesense Cloud
- Cloudflare DNS + CDN (free)
- GitHub Actions weekly scraper cron
- Sentry error tracking (free tier)
- UptimeRobot uptime monitoring (free tier)

---

## 🐳 Docker Commands (run every session)

```bash
# Start all containers
docker start pranavmeds-pg pranavmeds-redis pranavmeds-meili

# Verify all running
docker ps
```

## 🖥️ Dev Server Commands (run every session)

```bash
# Terminal 1 — Backend
cd PranavMeds/backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd PranavMeds/frontend
npm run dev
```

---

## 📁 Key File Locations

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI entry point, CORS, router registration |
| `backend/app/models/db/models.py` | SQLAlchemy ORM models |
| `backend/app/models/schemas/schemas.py` | Pydantic v2 schemas |
| `backend/app/api/v1/drugs.py` | Search + drug detail endpoints |
| `backend/app/api/v1/compare.py` | Compare endpoint |
| `backend/app/services/search.py` | Meilisearch client + search logic |
| `backend/app/scrapers/bulk_import.py` | HuggingFace dataset importer |
| `backend/app/scrapers/reindex.py` | Push all drugs to Meilisearch |
| `frontend/src/app/page.tsx` | Homepage search page |
| `frontend/src/app/compare/[slug]/page.tsx` | Comparison page |
| `frontend/src/app/drug/[slug]/page.tsx` | Drug detail page |

---

## 🗄️ Database Stats
- Total drugs: **11,145**
- Source: HuggingFace `dmedhi/indian-medicines` (11,825 rows, 7 errors/dupes skipped)
- Columns added: `uses`, `side_effects`, `image_url` (via `ALTER TABLE`)
- Images: live CDN URLs from `onemg.gumlet.io`

## 🔍 Meilisearch Stats
- Index: `drugs`
- Documents: **11,145**
- Searchable fields: `brand_name`, `manufacturer`, `uses`
- Master key: `dev-key`
- URL: `http://localhost:7700`

---

## ⚙️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | FastAPI | 0.135.1 |
| Language | Python | 3.12 |
| Validation | Pydantic | v2.9+ |
| Database | PostgreSQL | 18.3 |
| Cache | Redis | 8.6.1 |
| Search | Meilisearch | v1.13 |
| Frontend | Next.js | 16.2 |
| Styling | Tailwind CSS | v4 |
| Data fetching | TanStack Query | 5.95 |
| Runtime | Node.js | 22 LTS |

---

## 💰 Estimated Monthly Cost (when deployed)
| Service | Cost |
|---------|------|
| Vercel (frontend) | Free (non-commercial) |
| Railway (backend + DB) | ~$5–15/mo |
| Meilisearch (self-hosted on Railway) | Included above |
| Cloudflare | Free |
| Sentry | Free |
| **Total** | **~$5–15/mo** |

---

*Share this file with Claude at the start of each session for full context.*
