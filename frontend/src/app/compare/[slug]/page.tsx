"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiSalt {
  inn_name: string;
  name?: string;
  quantity?: string | null;
}

interface ApiDrugDetail {
  id: number;
  brand_name: string;
  manufacturer: string | null;
  dosage_form: string | null;
  strength: string | null;
  mrp: string | number | null;
  schedule?: string | null;
  nlem_listed?: boolean;
  salts?: ApiSalt[];
  image_url?: string | null;
  uses?: string | null;
  side_effects?: string | null;
  is_banned?: boolean;
}

interface ApiComparisonResult {
  drug_a: ApiDrugDetail;
  drug_b: ApiDrugDetail;
  salt_overlap_pct: number;
  safe_to_substitute: boolean;
  substitution_risk: string;
  risk_reason: string;
  price_difference: string | number | null;
  shared_salts?: string[];
  only_in_drug_a?: string[];
  only_in_drug_b?: string[];
  salts_comparison?: {
    inn_name: string;
    in_drug_a: boolean;
    in_drug_b: boolean;
    quantity_a?: string | null;
    quantity_b?: string | null;
  }[];
  disclaimer?: string;
}

const verdictConfig = {
  safe: {
    label: "Safe to substitute",
    icon: "✓",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
    dot: "bg-emerald-400",
    barColor: "bg-emerald-400",
  },
  caution: {
    label: "Caution needed",
    icon: "!",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/30",
    dot: "bg-amber-400",
    barColor: "bg-amber-400",
  },
  unsafe: {
    label: "Do not substitute",
    icon: "✕",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30",
    dot: "bg-red-400",
    barColor: "bg-red-400",
  },
};

export default function ComparePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [data, setData] = useState<ApiComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const match = slug.match(/^(\d+)-vs-(\d+)$/);
    if (!match) { setError("Invalid URL"); setLoading(false); return; }
    const [, id1, id2] = match;
    fetch(`${API}/api/v1/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drug_id_1: Number(id1), drug_id_2: Number(id2) }),
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load comparison."); setLoading(false); });
  }, [slug]);

  if (loading) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm">Loading comparison...</p>
      </div>
    </main>
  );

  if (error || !data) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-red-400">{error || "Something went wrong."}</p>
    </main>
  );

  const risk = (data.substitution_risk || "").toLowerCase();
  const verdictKey = risk === "high" ? "unsafe" : risk === "medium" ? "caution" : "safe";
  const verdict = verdictConfig[verdictKey];

  const drugA = data.drug_a;
  const drugB = data.drug_b;

  const mrpA = drugA.mrp != null ? Number(drugA.mrp) : null;
  const mrpB = drugB.mrp != null ? Number(drugB.mrp) : null;
  const cheaperName =
    mrpA != null && mrpB != null
      ? mrpA < mrpB ? drugA.brand_name : mrpA > mrpB ? drugB.brand_name : "Same price"
      : null;

  const sharedSalts = data.shared_salts ?? [];
  const onlyInA = data.only_in_drug_a ?? [];
  const onlyInB = data.only_in_drug_b ?? [];
  const saltsComparison = data.salts_comparison ?? [];

  // Build salt list from salts_comparison if shared/only arrays are empty
  const allSaltNames = saltsComparison.map(s => s.inn_name);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12">
      <div className="max-w-4xl mx-auto">

        {/* Back */}
        <a href="/" className="inline-flex items-center gap-1.5 text-zinc-500 text-sm hover:text-white transition-colors mb-8">
          ← Back to search
        </a>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold leading-tight">
            {drugA.brand_name}{" "}
            <span className="text-zinc-600 font-normal">vs</span>{" "}
            {drugB.brand_name}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Medicine comparison · PranavMeds</p>
        </div>

        {/* Verdict banner */}
        <div className={`border rounded-2xl px-6 py-5 mb-8 flex items-start gap-4 ${verdict.bg}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${verdict.dot} text-black`}>
            {verdict.icon}
          </div>
          <div>
            <p className={`font-bold text-lg ${verdict.color}`}>{verdict.label}</p>
            <p className="text-zinc-300 text-sm mt-1 leading-relaxed">{data.risk_reason}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {/* Salt overlap */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Salt overlap</p>
            <p className={`text-3xl font-bold ${data.salt_overlap_pct === 100 ? "text-emerald-400" : data.salt_overlap_pct >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {data.salt_overlap_pct}%
            </p>
            <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${verdict.barColor}`}
                style={{ width: `${data.salt_overlap_pct}%` }}
              />
            </div>
          </div>

          {/* Price difference */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Price difference</p>
            {data.price_difference != null && Number(data.price_difference) > 0 ? (
              <p className="text-3xl font-bold text-white">₹{Number(data.price_difference).toFixed(2)}</p>
            ) : (
              <p className="text-3xl font-bold text-zinc-600">—</p>
            )}
            {cheaperName && cheaperName !== "Same price" && (
              <p className="text-zinc-500 text-xs mt-2 truncate">{cheaperName} is cheaper</p>
            )}
          </div>

          {/* Cheaper option */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Cheaper option</p>
            {cheaperName ? (
              <p className="text-emerald-400 font-bold text-base leading-tight mt-1">{cheaperName}</p>
            ) : (
              <p className="text-zinc-600 text-2xl font-bold">—</p>
            )}
          </div>
        </div>

        {/* Drug cards side by side */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[drugA, drugB].map((drug, i) => (
            <div key={drug.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              {/* Image */}
              {drug.image_url ? (
                <div className="bg-zinc-800 flex items-center justify-center h-44">
                  <img
                    src={drug.image_url}
                    alt={drug.brand_name}
                    className="h-40 w-full object-contain p-3"
                  />
                </div>
              ) : (
                <div className="bg-zinc-800 h-44 flex items-center justify-center text-zinc-600 text-xs">
                  No image available
                </div>
              )}

              <div className="p-5">
                <p className="text-xs text-zinc-600 mb-1 uppercase tracking-wider">Drug {i === 0 ? "A" : "B"}</p>
                <h2 className="font-bold text-lg leading-tight">{drug.brand_name}</h2>
                {drug.manufacturer && (
                  <p className="text-zinc-400 text-sm mt-0.5">{drug.manufacturer}</p>
                )}

                {/* Badges */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {drug.dosage_form && (
                    <span className="bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-md">{drug.dosage_form}</span>
                  )}
                  {drug.strength && (
                    <span className="bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-md">{drug.strength}</span>
                  )}
                  {drug.schedule && drug.schedule !== "—" && (
                    <span className="bg-zinc-800 text-zinc-400 text-xs px-2.5 py-1 rounded-md">{drug.schedule}</span>
                  )}
                  {drug.nlem_listed && (
                    <span className="bg-emerald-400/10 text-emerald-400 text-xs px-2.5 py-1 rounded-md border border-emerald-400/20">NLEM</span>
                  )}
                  {drug.is_banned && (
                    <span className="bg-red-400/10 text-red-400 text-xs px-2.5 py-1 rounded-md border border-red-400/20">Banned</span>
                  )}
                </div>

                {/* Price */}
                <div className="mt-4 pb-4 border-b border-zinc-800">
                  {drug.mrp != null && Number(drug.mrp) > 0 ? (
                    <p className="text-emerald-400 font-bold text-2xl">₹{Number(drug.mrp).toFixed(2)}</p>
                  ) : (
                    <p className="text-zinc-600 text-2xl font-bold">Price N/A</p>
                  )}
                </div>

                {/* Uses */}
                {drug.uses && (
                  <div className="mt-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1.5">Uses</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{drug.uses}</p>
                  </div>
                )}

                {/* Side effects */}
                {drug.side_effects && (
                  <div className="mt-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1.5">Side effects</p>
                    <p className="text-zinc-400 text-sm leading-relaxed">{drug.side_effects}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ingredient comparison */}
        {saltsComparison.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Ingredient comparison</h3>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Shared salt
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Only in this drug
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" /> Not present
                </span>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-3 px-6 py-3 border-b border-zinc-800 text-xs text-zinc-500 font-medium uppercase tracking-wider">
              <span>Salt (INN)</span>
              <span className="text-center truncate">{drugA.brand_name}</span>
              <span className="text-center truncate">{drugB.brand_name}</span>
            </div>

            {saltsComparison.map((salt) => {
              const shared = salt.in_drug_a && salt.in_drug_b;
              return (
                <div
                  key={salt.inn_name}
                  className="grid grid-cols-3 px-6 py-3 border-b border-zinc-800/50 last:border-0 items-center"
                >
                  <span className={`text-sm font-medium capitalize ${shared ? "text-white" : "text-zinc-400"}`}>
                    {salt.inn_name}
                  </span>
                  <div className="flex justify-center">
                    {salt.in_drug_a ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${shared ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                        {salt.quantity_a || "✓"}
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-sm">—</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {salt.in_drug_b ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${shared ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                        {salt.quantity_b || "✓"}
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-sm">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {(sharedSalts.length > 0 || onlyInA.length > 0 || onlyInB.length > 0) && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5 mb-8">
            <h3 className="font-semibold text-white mb-4">Summary</h3>
            <div className="flex flex-col gap-2">
              {sharedSalts.map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-zinc-400">Shared:</span>
                  <span className="text-white font-medium capitalize">{s}</span>
                </div>
              ))}
              {onlyInA.map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✕</span>
                  <span className="text-zinc-400">Only in {drugA.brand_name}:</span>
                  <span className="text-white font-medium capitalize">{s}</span>
                </div>
              ))}
              {onlyInB.map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✕</span>
                  <span className="text-zinc-400">Only in {drugB.brand_name}:</span>
                  <span className="text-white font-medium capitalize">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-zinc-600 text-xs text-center leading-relaxed">
          {data.disclaimer || "For informational purposes only. Always consult your doctor or pharmacist before switching medicines."}
        </p>

      </div>
    </main>
  );
}