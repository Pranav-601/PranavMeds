"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setRequestStatus("idle"); // reset toast when query changes
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
        body: JSON.stringify({ name: debouncedQuery }),
      });
    } catch {
      // fire and forget — show success regardless
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
      <div className="w-full max-w-xl mb-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by medicine name (e.g. Crocin, Dolo, Combiflam...)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors text-base"
            autoFocus
          />
          {isFetching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {results.length > 0 && (
          <p className="text-zinc-600 text-xs mt-2 text-center">
            Select 2 medicines to compare them
          </p>
        )}
      </div>

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

      {/* No results + Request missing button */}
      {searched && results.length === 0 && !isFetching && (
        <div className="w-full max-w-xl text-center mb-6">
          <p className="text-zinc-500 mb-4">No medicines found for &quot;{debouncedQuery}&quot;</p>

          {requestStatus === "idle" && (
            <button
              onClick={handleRequestMissing}
              className="text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl hover:border-emerald-400 hover:text-emerald-400 transition-colors"
            >
              Can&apos;t find it? Request this medicine →
            </button>
          )}

          {requestStatus === "loading" && (
            <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm">
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              Looking it up...
            </div>
          )}

          {requestStatus === "sent" && (
            <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl px-5 py-3 text-emerald-400 text-sm">
              ✓ Request sent! We&apos;re fetching &quot;{debouncedQuery}&quot; from Jan Aushadhi.
              <br />
              <span className="text-zinc-400 text-xs">Search again in about 30 seconds.</span>
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      <div className="w-full max-w-xl flex flex-col gap-3">
        {results.map((drug) => (
          <div
            key={drug.id}
            onClick={() => toggleSelect(drug)}
            className={`border rounded-xl px-5 py-4 cursor-pointer transition-all flex items-center gap-4 ${
              isSelected(drug)
                ? "bg-emerald-400/10 border-emerald-400"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
            }`}
          >
            {/* Medicine image */}
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

            {/* Drug info */}
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

            {/* Price + selected */}
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
      <p className="mt-4 text-roboto-1800 text-xs text-center max-w-md underline underline-offset-4 decoration-emerald-400/30 decoration-dashed">
        Made by Pranav :D
      </p>
    </main>
  );
}