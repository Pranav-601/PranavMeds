"use client";

import { useState, useRef, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";

const MedicineScanner = lazy(() => import("../components/MedicineScanner"));
const PrescriptionScanner = lazy(() => import("../components/PrescriptionScanner"));

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DrugResult {
  id: number;
  brand_name: string;
  manufacturer: string | null;
  dosage_form: string | null;
  strength: string | null;
  mrp: string | null;
  slug: string | null;
  image_url: string | null;
}

interface SearchResponse {
  query: string;
  count: number;
  results: DrugResult[];
}

async function searchDrugs(query: string): Promise<SearchResponse> {
  const res = await fetch(`${API}/api/v1/search?q=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<DrugResult[]>([]);
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [showScanner, setShowScanner] = useState(false);
  const [showPrescriptionScanner, setShowPrescriptionScanner] = useState(false);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setRequestStatus("idle");
    setShowRequestPanel(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  };

  const { data, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchDrugs(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
    placeholderData: (prev) => prev,
  });

  const results = data?.results ?? [];
  const searched = debouncedQuery.trim().length > 0;

  const toggleSelect = (drug: DrugResult) => {
    setSelected((prev) => {
      const exists = prev.find((d) => d.id === drug.id);
      if (exists) return prev.filter((d) => d.id !== drug.id);
      if (prev.length >= 2) return [prev[1], drug];
      return [...prev, drug];
    });
  };

  const isSelected = (drug: DrugResult) => selected.some((d) => d.id === drug.id);

  const handleCompare = () => {
    if (selected.length === 2) {
      window.location.href = `/compare?drugs=${selected[0].id}-vs-${selected[1].id}`;
    }
  };

  const handleRequestMissing = async () => {
    setRequestStatus("loading");
    try {
      await fetch(`${API}/api/v1/request-drug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: debouncedQuery || query }),
      });
    } catch {
      // fire and forget
    }
    setRequestStatus("sent");
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-20">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold tracking-tight mb-3">
          Pranav<span className="text-emerald-400">Meds</span>
        </h1>
        <p className="text-zinc-400 text-lg">
          Search, compare, and find affordable medicine alternatives in India
        </p>
      </div>

      {/* Search bar */}
      <div className="w-full max-w-xl mb-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by medicine name (e.g. Crocin, Dolo, Combiflam...)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 pr-14 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors text-base"
            autoFocus
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isFetching && (
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
        {results.length > 0 && (
          <p className="text-zinc-600 text-xs mt-2 text-center">
            Select 2 medicines to compare them
          </p>
        )}
      </div>

      {/* Scan Prescription — feature card (full width, above the two below) */}
      <div className="w-full max-w-xl mb-3">
        <button
          onClick={() => setShowPrescriptionScanner(true)}
          className="w-full group bg-zinc-900 border border-zinc-800 hover:border-purple-400/40 rounded-2xl p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center shrink-0 group-hover:bg-purple-400/15 transition-colors">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm group-hover:text-purple-400 transition-colors">
                Scan Prescription
              </p>
              <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">
                Upload your prescription → see branded vs generic savings instantly
              </p>
            </div>
            <div className="shrink-0">
              <span className="text-xs font-bold bg-purple-400/10 border border-purple-400/25 text-purple-400 px-2.5 py-1 rounded-full">
                NEW
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Scan + Request row — always visible */}
      <div className="w-full max-w-xl mb-6 flex gap-3">
        {/* Scan Medicine */}
        <button
          onClick={() => setShowScanner(true)}
          className="flex-1 group bg-zinc-900 border border-zinc-800 hover:border-emerald-400/40 rounded-2xl p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-emerald-400/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-400/15 transition-colors">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors">
                Scan Medicine
              </p>
              <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">
                Point camera at a strip or box
              </p>
            </div>
          </div>
        </button>

        {/* Request Missing Medicine */}
        <button
          onClick={() => setShowRequestPanel((prev) => !prev)}
          className="flex-1 group bg-zinc-900 border border-zinc-800 hover:border-amber-400/40 rounded-2xl p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-amber-400/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 group-hover:bg-amber-400/15 transition-colors">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm group-hover:text-amber-400 transition-colors">
                Request Medicine
              </p>
              <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">
                Can&apos;t find it? We&apos;ll fetch it
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Request panel — expands when button clicked */}
      {showRequestPanel && (
        <div className="w-full max-w-xl mb-6 bg-zinc-900 border border-amber-400/20 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-1">Request a missing medicine</p>
          <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
            If you can&apos;t find a medicine in search results, enter its name below and we&apos;ll scrape it from Jan Aushadhi and add it to our database.
          </p>

          {requestStatus !== "sent" ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Medicine name to request..."
                className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 transition-colors text-sm"
              />
              <button
                onClick={handleRequestMissing}
                disabled={requestStatus === "loading" || !query.trim()}
                className="bg-amber-400 text-black font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                {requestStatus === "loading" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Fetching…
                  </>
                ) : (
                  "Request →"
                )}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
              ✓ Request sent! We&apos;re fetching &quot;{debouncedQuery || query}&quot; from Jan Aushadhi.
              <br />
              <span className="text-zinc-400 text-xs">Search again in about 30 seconds.</span>
              <button
                onClick={() => { setRequestStatus("idle"); setShowRequestPanel(false); }}
                className="block mt-2 text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected pills + compare button */}
      {selected.length > 0 && (
        <div className="w-full max-w-xl mb-4 flex items-center gap-3 flex-wrap">
          {selected.map((drug) => (
            <div
              key={drug.id}
              className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/30 rounded-lg px-3 py-1.5"
            >
              {drug.image_url && (
                <img
                  src={drug.image_url}
                  alt={drug.brand_name}
                  className="w-5 h-5 rounded object-cover"
                />
              )}
              <span className="text-emerald-400 text-sm font-medium">{drug.brand_name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(drug); }}
                className="text-emerald-600 hover:text-emerald-400 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          {selected.length === 2 && (
            <button
              onClick={handleCompare}
              className="ml-auto bg-emerald-400 text-black font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-emerald-300 transition-colors"
            >
              Compare →
            </button>
          )}
        </div>
      )}

      {/* Zero results hint (kept as extra nudge) */}
      {searched && results.length === 0 && !isFetching && (
        <div className="w-full max-w-xl text-center mb-6">
          <p className="text-zinc-500 text-sm">
            No medicines found for &quot;{debouncedQuery}&quot; —{" "}
            <button
              onClick={() => setShowRequestPanel(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2"
            >
              request it above
            </button>
          </p>
        </div>
      )}

      {/* Results list */}
      <div className="w-full max-w-xl flex flex-col gap-3">
        {results.map((drug) => (
          <div
            key={drug.id}
            onClick={() => toggleSelect(drug)}
            className={`border rounded-xl px-5 py-4 cursor-pointer transition-all flex items-center gap-4 ${isSelected(drug)
                ? "bg-emerald-400/10 border-emerald-400"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
              }`}
          >
            {drug.image_url ? (
              <img
                src={drug.image_url}
                alt={drug.brand_name}
                className="w-14 h-14 rounded-lg object-cover shrink-0 bg-zinc-800"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-600 text-xs text-center">
                No img
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-base">{drug.brand_name}</p>
              <p className="text-zinc-400 text-sm mt-0.5 truncate">
                {[drug.manufacturer, drug.dosage_form, drug.strength].filter(Boolean).join(" · ")}
              </p>
              <a
                href={`/drug?id=${drug.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-emerald-500 text-xs hover:text-emerald-400 mt-1 inline-block"
              >
                View details →
              </a>
            </div>
            <div className="text-right shrink-0">
              {drug.mrp && (
                <p className="text-emerald-400 font-bold text-base">₹{drug.mrp}</p>
              )}
              {isSelected(drug) && (
                <p className="text-emerald-500 text-xs mt-0.5">Selected ✓</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="mt-16 text-zinc-600 text-xs text-center max-w-md">
        For informational purposes only. Always consult your doctor before substituting medicines.
      </p>
      <p className="mt-4 text-xs text-center max-w-md underline underline-offset-4 decoration-emerald-400/30 decoration-dashed">
        Made by Pranav :D
      </p>

      {/* Scanner modal */}
      {showScanner && (
        <Suspense fallback={null}>
          <MedicineScanner
            onResult={(name) => handleQueryChange(name)}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}

      {/* Prescription Scanner modal */}
      {showPrescriptionScanner && (
        <Suspense fallback={null}>
          <PrescriptionScanner onClose={() => setShowPrescriptionScanner(false)} />
        </Suspense>
      )}
    </main>
  );
}