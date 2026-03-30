# PranavMeds — Medicine Scanner Build Guide
> For AI assistants: This is a complete, self-contained build guide. Follow it step by step.

---

## What We're Building

A **camera-based medicine scanner** for the PranavMeds web app. Users point their phone camera at a medicine box/strip, the app reads the medicine name using OCR, and uses it to search the drug database.

## Current State of the Project

- **Frontend**: Next.js 16.2 + React 19 + Tailwind v4, deployed on Netlify at `pranavmeds.netlify.app`
- **Backend**: FastAPI 0.135.1, deployed on Render at `pranavmeds.onrender.com`
- **Database**: PostgreSQL on Neon with 11,145 Indian medicines
- **Search**: `GET /api/v1/search?q=<query>&limit=10` — uses pg_trgm fuzzy search
- **Static export**: `next.config.ts` has `output: "export"` — no SSR, all pages are `"use client"`
- **API URL**: All pages use `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`

### Key Files You'll Touch

| File | Purpose |
|------|---------|
| `frontend/src/app/page.tsx` | Homepage with search bar — ADD scan button here |
| `frontend/src/app/layout.tsx` | Root layout with QueryClientProvider |
| `frontend/package.json` | Dependencies — ADD tesseract.js + react-webcam |
| `frontend/next.config.ts` | Has `output: "export"` and `images: { unoptimized: true }` |

---

## Architecture

```
User taps 📷 → Camera opens (rear) → User captures photo
                                          ↓
                              Tesseract.js OCR (in-browser)
                                          ↓
                              Raw text extracted from image
                                          ↓
                              Clean text (remove "mg", "tablet", etc.)
                                          ↓
                              Send top candidates to GET /api/v1/search
                                          ↓
                              Show matched drug names as clickable pills
                                          ↓
                              User taps a match → fills search bar
```

**Everything runs client-side.** No backend changes needed. No API keys. No cost.

---

## Step-by-Step Build Order

### Step 1: Install Dependencies

```bash
cd PranavMeds/frontend
npm install tesseract.js react-webcam
```

- `tesseract.js@5` — OCR engine, loads ~2MB WASM worker on demand
- `react-webcam` — Clean React wrapper for `getUserMedia`

---

### Step 2: Create `frontend/src/components/MedicineScanner.tsx`

This is the main component. It must:

#### Props
```typescript
interface MedicineScannerProps {
  onResult: (drugName: string) => void;  // Called when user picks a match
  onClose: () => void;                    // Called when user closes scanner
}
```

#### Internal State
```typescript
const [mode, setMode] = useState<"camera" | "processing" | "results">("camera");
const [capturedImage, setCapturedImage] = useState<string | null>(null);
const [ocrText, setOcrText] = useState("");
const [matches, setMatches] = useState<{id: number, brand_name: string}[]>([]);
const [error, setError] = useState<string | null>(null);
```

#### Component Sections

**A. Camera View (mode === "camera")**
- Fullscreen overlay (fixed position, z-50, black background)
- `<Webcam>` component with `facingMode: { ideal: "environment" }` (rear camera, fallback to front)
- Add `screenshotFormat="image/jpeg"` and `screenshotQuality={0.8}`
- "✕ Close" button top-right
- "📷 Capture" button at bottom center (big, round, white)
- **Gallery fallback**: A small "📁 Upload photo" link below the capture button
  - This is an `<input type="file" accept="image/*">` that lets users pick from gallery
  - On desktop, this is the primary option (no camera)

**B. Processing View (mode === "processing")**
- Show the captured image as preview (small thumbnail)
- Spinner + "Reading medicine name..."
- This is where Tesseract.js runs

**C. Results View (mode === "results")**
- Show matched medicine names as clickable pill buttons
- Each pill: `onClick={() => { onResult(match.brand_name); onClose(); }}`
- "No matches found" fallback with "Try again" button
- "Scan again" button to go back to camera mode

#### OCR Logic (the core function)

```typescript
async function processImage(imageSrc: string) {
  setMode("processing");
  
  try {
    // 1. Run Tesseract OCR
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data: { text } } = await worker.recognize(imageSrc);
    await worker.terminate();
    
    setOcrText(text);
    
    // 2. Clean the text — remove noise words
    const noiseWords = new Set([
      "mg", "ml", "tablet", "tablets", "capsule", "capsules", "strip",
      "pack", "of", "each", "mfg", "exp", "batch", "manufactured",
      "marketed", "by", "date", "store", "below", "keep", "away",
      "children", "price", "mrp", "incl", "gst", "composition",
      "schedule", "rx", "use", "under", "medical", "supervision"
    ]);
    
    const lines = text.split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 2)
      .slice(0, 5);  // First 5 lines most likely have brand name
    
    // 3. Search each candidate line against the API
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const allMatches: {id: number, brand_name: string}[] = [];
    
    for (const line of lines) {
      // Clean the line
      const cleaned = line
        .replace(/[^a-zA-Z0-9\s]/g, "")  // Remove special chars
        .split(/\s+/)
        .filter(word => !noiseWords.has(word.toLowerCase()) && word.length > 2)
        .join(" ")
        .trim();
      
      if (cleaned.length < 3) continue;
      
      try {
        const res = await fetch(`${API}/api/v1/search?q=${encodeURIComponent(cleaned)}&limit=3`);
        const data = await res.json();
        if (data.results) {
          allMatches.push(...data.results.map((r: any) => ({
            id: r.id,
            brand_name: r.brand_name,
          })));
        }
      } catch {}
    }
    
    // 4. Deduplicate and show top 5
    const unique = [...new Map(allMatches.map(m => [m.id, m])).values()].slice(0, 5);
    setMatches(unique);
    setMode("results");
    
  } catch (err) {
    setError("Failed to read the image. Try again with better lighting.");
    setMode("camera");
  }
}
```

#### Gallery Upload Handler

```typescript
function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const imageSrc = event.target?.result as string;
    setCapturedImage(imageSrc);
    processImage(imageSrc);
  };
  reader.readAsDataURL(file);
}
```

#### Styling Guidelines
- **Overlay**: `fixed inset-0 z-50 bg-black` — covers entire screen
- **Camera feed**: Full width/height, object-cover
- **Capture button**: `w-16 h-16 rounded-full bg-white` centered at bottom
- **Close button**: `absolute top-4 right-4 text-white text-2xl`
- **Match pills**: `bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 px-4 py-2 rounded-xl cursor-pointer`
- **Consistent with existing design**: black bg, emerald-400 accent, zinc text

---

### Step 3: Modify `frontend/src/app/page.tsx`

Add the scan button and scanner modal to the homepage.

#### Changes needed:

1. **Import** the scanner component:
```typescript
import { useState } from "react";  // already imported
import MedicineScanner from "../components/MedicineScanner";
```

2. **Add state** for scanner visibility:
```typescript
const [showScanner, setShowScanner] = useState(false);
```

3. **Add scan button** next to the search input (inside the `relative` div):
```tsx
<button
  onClick={() => setShowScanner(true)}
  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-emerald-400 transition-colors"
  title="Scan medicine"
>
  📷
</button>
```
Note: Move the existing loading spinner to `right-12` when scanner button is present.

4. **Add scanner modal** at the bottom of the component (before closing `</main>`):
```tsx
{showScanner && (
  <MedicineScanner
    onResult={(name) => {
      handleQueryChange(name);  // This triggers the search
    }}
    onClose={() => setShowScanner(false)}
  />
)}
```

---

### Step 4: Test Locally

```bash
cd PranavMeds/frontend
npm run dev
```

Test these scenarios:
1. ✅ Tap 📷 → camera opens (use phone or laptop webcam)
2. ✅ Capture a medicine box → OCR extracts text → matches shown
3. ✅ Tap a match → scanner closes, search bar fills, results load
4. ✅ Gallery upload works (pick a photo from files)
5. ✅ Close button works
6. ✅ Error state works (capture a blank wall → "no matches")
7. ✅ Desktop fallback works (no rear camera → front camera or upload)

---

### Step 5: Deploy

```bash
cd PranavMeds
git add .
git commit -m "Add medicine scanner with OCR"
git push
```

Netlify auto-deploys. Test on `pranavmeds.netlify.app` using your phone:
- HTTPS is required for camera access — Netlify provides this
- Test rear camera on Android Chrome and iOS Safari

---

## Common Pitfalls to Avoid

1. **`navigator` is undefined** — Wrap camera code in `typeof window !== "undefined"` checks (Next.js SSR)
2. **Tesseract.js bundle size** — Use dynamic import (`await import("tesseract.js")`) to load on demand, NOT at page load
3. **Camera permissions** — Handle `NotAllowedError` gracefully (show upload fallback)
4. **CORS on camera** — Not an issue since OCR is 100% client-side
5. **Static export** — No `export const runtime = 'edge'`, no server components. Everything must be `"use client"`
6. **Mobile keyboard** — Don't auto-focus search input when scanner closes (it opens keyboard on mobile)

---

## File Structure After Implementation

```
frontend/src/
├── app/
│   ├── page.tsx          ← MODIFIED (scan button + scanner modal)
│   ├── compare/page.tsx  ← unchanged
│   ├── drug/page.tsx     ← unchanged
│   └── layout.tsx        ← unchanged
└── components/
    └── MedicineScanner.tsx  ← NEW (camera + OCR + results)
```
