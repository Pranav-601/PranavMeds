# PranavMeds — Build Progress Tracker v3
> Last updated: March 30, 2026

---

## ✅ Phase 1: Core Platform (COMPLETE)

| Step | Status | Description |
|------|--------|-------------|
| 1. Database seeded | ✅ | PostgreSQL 18.3 in Docker, 6 tables |
| 2. FastAPI server | ✅ | Running on port 8000, Swagger UI |
| 3. Endpoints tested | ✅ | GET /search, GET /drug/{id} |
| 4. Next.js frontend | ✅ | Next.js 16.2, React 19, Tailwind v4 |
| 5. Search page | ✅ | Debounced search, medicine images |
| 6. Compare API | ✅ | POST /compare — salt overlap, verdict |
| 7. Compare UI | ✅ | Side-by-side comparison page |
| 8. Fuzzy search | ✅ | 11,145 drugs indexed (Meilisearch local) |
| 9. Drug detail page | ✅ | Full drug info, salts, uses, side effects |
| 10. TanStack Query | ✅ | Autocomplete with react-query |
| 11. On-demand scraper | ✅ | POST /request-drug + Jan Aushadhi scraper |

---

## ✅ Phase 2: Deployment (COMPLETE)

| Step | Status | Description |
|------|--------|-------------|
| Backend → Render | ✅ | `pranavmeds.onrender.com` |
| Database → Neon | ✅ | PostgreSQL with 11,145 drugs |
| Frontend → Netlify | ✅ | `pranavmeds.netlify.app` |
| CORS configured | ✅ | Allow all origins |
| SSL for Neon | ✅ | asyncpg SSL via connect_args |
| pg_trgm fuzzy search | ✅ | Replaced Meilisearch with free PostgreSQL trigrams |

---

## 🔨 Phase 3: Medicine Scanner (IN PROGRESS — code written, not yet deployed)

| Step | Status | Description |
|------|--------|-------------|
| 3.1 Plan & design | ✅ | Gemini Vision (cloud OCR) via FastAPI backend |
| 3.2 Install deps | ⬜ | `npm install react-webcam` (tesseract.js NOT needed) |
| 3.3 MedicineScanner component | ✅ | Written — `frontend/src/components/MedicineScanner.tsx` |
| 3.4 Backend OCR endpoint | ✅ | Written — `backend/app/api/v1/ocr.py` |
| 3.5 Register OCR router | ✅ | Written — updated `backend/app/main.py` |
| 3.6 Integrate with homepage | ✅ | Already done in `page.tsx` — scan button + lazy modal wired |
| 3.7 Add GEMINI_API_KEY to Render | ⬜ | Render dashboard → Environment Variables |
| 3.8 Push & deploy | ⬜ | `git add . && git commit -m "feat: add medicine scanner with Gemini Vision OCR" && git push` |
| 3.9 Test on mobile | ⬜ | Android Chrome + iOS Safari — HTTPS required for camera |

---

## ⬜ Phase 4: Polish & Future

| Step | Status | Description |
|------|--------|-------------|
| UptimeRobot monitoring | ⬜ | Keep Render awake |
| Sentry error tracking | ⬜ | Free tier |
| SEO meta tags | ⬜ | Title, description per page |
| PWA support | ⬜ | Installable on mobile |

---

## 🖥️ Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://pranavmeds.netlify.app |
| Backend API | https://pranavmeds.onrender.com |
| API Docs | https://pranavmeds.onrender.com/docs |

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.135.1, Python 3.12 |
| Database | PostgreSQL 18.3 (Neon) |
| Search | pg_trgm fuzzy search |
| Frontend | Next.js 16.2, React 19, Tailwind v4 |
| Data fetching | TanStack Query 5.95 |
| OCR | Gemini Vision (`gemini-2.0-flash`) via FastAPI proxy |
| Hosting | Netlify + Render + Neon |

---

## 🐳 Local Dev Commands

```bash
# Start containers
docker start pranavmeds-pg pranavmeds-redis pranavmeds-meili

# Backend (Terminal 1)
cd PranavMeds/backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

# Frontend (Terminal 2)
cd PranavMeds/frontend && npm run dev
```

---

## 📁 Phase 3 — File Changes (what was written this session)

### New file: `backend/app/api/v1/ocr.py`
Gemini Vision OCR endpoint. Accepts multipart image upload, sends it to
`gemini-2.0-flash` with a targeted prompt asking only for the medicine brand name,
returns `{ "text": "<brand name>" }` to the frontend.

Key details:
- Uses `base64` encoding (NOT `latin1` decode — that was a bug in an earlier draft)
- Model: `gemini-2.0-flash` (confirmed available on the project's API key)
- Prompt is tightly scoped: asks Gemini to return ONLY the brand name, nothing else
- `temperature: 0.1`, `maxOutputTokens: 50` for deterministic, short output
- API key read from `GEMINI_API_KEY` env var (never hardcoded)

```python
# backend/app/api/v1/ocr.py
import base64, os
import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/api/v1", tags=["ocr"])
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

@router.post("/ocr")
async def ocr_image(image: UploadFile = File(...)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    content = await image.read()
    b64_image = base64.b64encode(content).decode("utf-8")
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"inlineData": {"mimeType": image.content_type or "image/jpeg", "data": b64_image}},
                {"text": (
                    "This is a photo of an Indian medicine box, strip, or blister pack. "
                    "Extract ONLY the brand name of the medicine (the largest or most prominent text). "
                    "Do NOT include dosage (mg/ml), form (tablet/capsule/syrup), manufacturer name, "
                    "batch number, expiry date, or any other text. "
                    "Reply with just the medicine brand name, nothing else. "
                    "If you cannot find a medicine name, reply with an empty string."
                )}
            ]
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 50},
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(f"{GEMINI_URL}?key={api_key}", json=payload,
                                 headers={"Content-Type": "application/json"})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Gemini OCR failed: {resp.text[:200]}")
    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        text = ""
    return {"text": text}
```

---

### Modified file: `backend/app/main.py`
Only change: added two lines to import and register the OCR router.

```python
from app.api.v1.ocr import router as ocr_router  # add this import
app.include_router(ocr_router)                    # add this line after the other routers
```

---

### New file: `frontend/src/components/MedicineScanner.tsx`
Full-screen camera overlay component. Flow:
1. Opens rear camera via `react-webcam` (`facingMode: { ideal: "environment" }`)
2. User captures photo (or uploads from gallery via hidden `<input type="file">`)
3. Converts base64 dataURL → Blob → FormData
4. POSTs to `/api/v1/ocr` → gets back `{ text: "Crocin" }`
5. Cleans text (removes noise words like "mg", "tablet", etc.)
6. Searches `/api/v1/search?q=<cleaned>&limit=5`
7. Shows matched drug names as tappable emerald pills
8. User taps a match → `onResult(brand_name)` called → fills homepage search bar → scanner closes

Key props:
```typescript
interface MedicineScannerProps {
  onResult: (drugName: string) => void;
  onClose: () => void;
}
```

Handles edge cases:
- Camera permission denied → shows upload-only fallback UI
- Empty OCR result → shows "try again" message, stays on camera mode
- No search matches → shows "no matches" with scan-again button
- Scanning frame overlay with animated scan line (CSS `@keyframes scan`)

---

### No changes needed: `frontend/src/app/page.tsx`
The homepage already had the scanner fully wired before this session:
- `const [showScanner, setShowScanner] = useState(false)` — state exists
- Scan button card renders when `!searched` — already present
- `<Suspense>` + lazy import of `MedicineScanner` — already present
- `onResult={(name) => handleQueryChange(name)}` — already wired

---

## 🔑 Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | Netlify env | `https://pranavmeds.onrender.com` |
| `GEMINI_API_KEY` | Render env | Your Google AI Studio key (project: PranavMeds, key: `...ICVg`) |

**To add `GEMINI_API_KEY` on Render:**
Render Dashboard → pranavmeds backend service → Environment → Add environment variable

---

## ⚠️ Known Gotchas

- `gemini-1.5-flash` is **not available** on this API key — use `gemini-2.0-flash`
- The OCR endpoint uses `base64` encoding, not `latin1` (latin1 was a bug in an older draft — don't use it)
- `react-webcam` needs `npm install react-webcam` — do NOT install `tesseract.js` (not needed anymore)
- `next.config.ts` has `output: "export"` — everything must be `"use client"`, no SSR
- Camera requires HTTPS — works on Netlify (has SSL), won't work on plain `http://localhost` on mobile
- The `<style jsx>` block in `MedicineScanner.tsx` requires `styled-jsx` which is included with Next.js — no extra install

---

*Share this file with Claude at the start of each session for full context.*