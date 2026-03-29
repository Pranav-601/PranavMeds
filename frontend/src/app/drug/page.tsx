"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Salt {
  inn_name: string;
  atc_code: string | null;
  pharmacological_class: string | null;
  quantity: string | null;
}

interface DrugDetail {
  id: number;
  brand_name: string;
  manufacturer: string | null;
  dosage_form: string | null;
  strength: string | null;
  mrp: string | null;
  is_banned: boolean;
  schedule: string | null;
  nlem_listed: boolean;
  slug: string | null;
  uses: string | null;
  side_effects: string | null;
  image_url: string | null;
  salts: Salt[];
}

function DrugContent() {
  const searchParams = useSearchParams();
  const drugId = searchParams.get("id") || "";
  const [drug, setDrug] = useState<DrugDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!drugId) return;
    fetch(`${API}/api/v1/drug/${drugId}`)
      .then((r) => r.json())
      .then((d) => { setDrug(d); setLoading(false); })
      .catch(() => { setError("Failed to load drug."); setLoading(false); });
  }, [drugId]);

  if (loading) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </main>
  );

  if (error || !drug) return (
    <main className="min-h-screen bg-black flex items-center justify-center text-red-400">
      {error || "Drug not found."}
    </main>
  );

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <a href="/" className="text-zinc-500 text-sm hover:text-white transition-colors mb-8 inline-block">
          ← Back to search
        </a>

        {/* Image + name header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
          {drug.image_url ? (
            <div className="bg-zinc-800 flex items-center justify-center h-56">
              <img
                src={drug.image_url}
                alt={drug.brand_name}
                className="h-48 object-contain p-4"
              />
            </div>
          ) : (
            <div className="bg-zinc-800 h-56 flex items-center justify-center text-zinc-600 text-sm">
              No image available
            </div>
          )}

          <div className="p-6">
            <h1 className="text-2xl font-bold">{drug.brand_name}</h1>
            {drug.manufacturer && (
              <p className="text-zinc-400 mt-1">{drug.manufacturer}</p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-4">
              {drug.dosage_form && (
                <span className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-md">{drug.dosage_form}</span>
              )}
              {drug.strength && (
                <span className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-md">{drug.strength}</span>
              )}
              {drug.schedule && (
                <span className="bg-zinc-800 text-zinc-400 text-xs px-3 py-1.5 rounded-md">{drug.schedule}</span>
              )}
              {drug.nlem_listed && (
                <span className="bg-emerald-400/10 text-emerald-400 text-xs px-3 py-1.5 rounded-md border border-emerald-400/20">NLEM Listed</span>
              )}
              {drug.is_banned && (
                <span className="bg-red-400/10 text-red-400 text-xs px-3 py-1.5 rounded-md border border-red-400/20">Banned</span>
              )}
            </div>

            {/* Price */}
            <div className="mt-6">
              {drug.mrp && Number(drug.mrp) > 0 ? (
                <p className="text-emerald-400 font-bold text-3xl">₹{Number(drug.mrp).toFixed(2)}</p>
              ) : (
                <p className="text-zinc-600 text-xl">Price not available</p>
              )}
            </div>
          </div>
        </div>

        {/* Salt composition */}
        {drug.salts.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="font-semibold">Salt composition</h2>
            </div>
            {drug.salts.map((salt, i) => (
              <div key={i} className="px-6 py-4 border-b border-zinc-800/50 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{salt.inn_name}</p>
                    {salt.pharmacological_class && (
                      <p className="text-zinc-500 text-sm mt-0.5">{salt.pharmacological_class}</p>
                    )}
                    {salt.atc_code && (
                      <p className="text-zinc-600 text-xs mt-0.5">ATC: {salt.atc_code}</p>
                    )}
                  </div>
                  {salt.quantity && (
                    <span className="bg-zinc-800 text-zinc-300 text-sm px-3 py-1 rounded-md shrink-0">{salt.quantity}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Uses */}
        {drug.uses && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5 mb-6">
            <h2 className="font-semibold mb-3">Uses</h2>
            <p className="text-zinc-300 text-sm leading-relaxed">{drug.uses}</p>
          </div>
        )}

        {/* Side effects */}
        {drug.side_effects && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5 mb-6">
            <h2 className="font-semibold mb-3">Side effects</h2>
            <div className="flex flex-wrap gap-2">
              {drug.side_effects.split(" ").filter(Boolean).map((effect, i) => (
                <span key={i} className="bg-zinc-800 text-zinc-400 text-xs px-2.5 py-1 rounded-md">
                  {effect}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-zinc-600 text-xs text-center mt-8">
          For informational purposes only. Always consult your doctor before taking any medicine.
        </p>
      </div>
    </main>
  );
}

export default function DrugPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <DrugContent />
    </Suspense>
  );
}
