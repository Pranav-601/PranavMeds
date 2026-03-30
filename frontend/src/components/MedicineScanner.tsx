"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DrugMatch {
  id: number;
  brand_name: string;
  manufacturer?: string | null;
}

interface MedicineScannerProps {
  onResult: (drugName: string) => void;
  onClose: () => void;
}

const NOISE_WORDS = new Set([
  "mg", "ml", "gm", "mcg", "tablet", "tablets", "tab", "capsule", "capsules",
  "cap", "strip", "pack", "of", "each", "mfg", "exp", "batch", "manufactured",
  "marketed", "by", "date", "store", "below", "keep", "away", "children",
  "price", "mrp", "incl", "gst", "composition", "schedule", "rx", "use",
  "under", "medical", "supervision", "for", "not", "sale", "only", "and",
  "the", "per", "with", "from", "this", "that", "are", "was", "been",
  "have", "has", "had", "will", "would", "could", "should", "may", "might",
  "prescription", "warning", "caution", "dosage", "dose", "oral", "external",
  "internal", "injection", "syrup", "cream", "ointment", "gel", "drops",
  "suspension", "solution", "powder", "sachet", "vial", "ampoule", "bottle",
]);

export default function MedicineScanner({ onResult, onClose }: MedicineScannerProps) {
  const [mode, setMode] = useState<"camera" | "processing" | "results">("camera");
  const [matches, setMatches] = useState<DrugMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (imageSrc: string) => {
    setMode("processing");
    setError(null);
    setProgress("Loading OCR engine...");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(`Reading text... ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      });

      setProgress("Reading medicine name...");
      const { data: { text } } = await worker.recognize(imageSrc);
      await worker.terminate();

      if (!text || text.trim().length < 2) {
        setError("Could not read any text. Try better lighting or a clearer angle.");
        setMode("camera");
        return;
      }

      setProgress("Searching database...");

      // Extract candidate lines — first 6 non-empty lines
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 2)
        .slice(0, 6);

      const allMatches: DrugMatch[] = [];

      for (const line of lines) {
        const cleaned = line
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .split(/\s+/)
          .filter((w) => !NOISE_WORDS.has(w.toLowerCase()) && w.length > 2)
          .join(" ")
          .trim();

        if (cleaned.length < 3) continue;

        try {
          const res = await fetch(
            `${API}/api/v1/search?q=${encodeURIComponent(cleaned)}&limit=3`
          );
          if (!res.ok) continue;
          const data = await res.json();
          if (data.results) {
            for (const r of data.results) {
              allMatches.push({
                id: r.id,
                brand_name: r.brand_name,
                manufacturer: r.manufacturer,
              });
            }
          }
        } catch {
          // skip failed searches
        }
      }

      // Deduplicate by id, keep first 6
      const unique = [
        ...new Map(allMatches.map((m) => [m.id, m])).values(),
      ].slice(0, 6);

      setMatches(unique);
      setMode("results");
    } catch {
      setError("Failed to process image. Please try again.");
      setMode("camera");
    }
  }, []);

  const handleCapture = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (screenshot) {
      processImage(screenshot);
    }
  }, [processImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) processImage(src);
    };
    reader.readAsDataURL(file);
  };

  const handlePickMatch = (drug: DrugMatch) => {
    onResult(drug.brand_name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800">
        <h2 className="text-white font-semibold text-sm">Scan Medicine</h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white text-2xl leading-none transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Camera Mode */}
      {mode === "camera" && (
        <div className="flex-1 flex flex-col">
          {/* Camera feed */}
          <div className="flex-1 relative bg-black overflow-hidden">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.85}
              videoConstraints={{
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }}
              className="w-full h-full object-cover"
              onUserMediaError={() =>
                setError("Camera access denied. Use the upload button below.")
              }
            />

            {/* Guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[75%] max-w-sm aspect-[3/2] border-2 border-emerald-400/40 rounded-2xl flex items-center justify-center">
                <p className="text-emerald-400/60 text-sm text-center px-4">
                  Point at the medicine name
                </p>
              </div>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="px-4 py-2 bg-red-400/10 border-t border-red-400/20">
              <p className="text-red-400 text-xs text-center">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="bg-zinc-900 px-4 py-5 flex flex-col items-center gap-3 border-t border-zinc-800">
            {/* Capture button */}
            <button
              onClick={handleCapture}
              className="w-16 h-16 rounded-full bg-white hover:bg-zinc-200 transition-colors flex items-center justify-center shadow-lg shadow-white/10 active:scale-95"
            >
              <div className="w-12 h-12 rounded-full border-[3px] border-zinc-900" />
            </button>

            {/* Upload fallback */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors"
            >
              📁 Upload from gallery
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Processing Mode */}
      {mode === "processing" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4">
          <div className="w-12 h-12 border-[3px] border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-300 text-sm text-center">{progress}</p>
          <p className="text-zinc-600 text-xs">This may take a few seconds...</p>
        </div>
      )}

      {/* Results Mode */}
      {mode === "results" && (
        <div className="flex-1 flex flex-col px-4 py-6">
          {matches.length > 0 ? (
            <>
              <p className="text-zinc-400 text-sm mb-4 text-center">
                Found {matches.length} possible match{matches.length !== 1 ? "es" : ""}. Tap to search:
              </p>
              <div className="flex flex-col gap-2 max-w-sm mx-auto w-full">
                {matches.map((drug) => (
                  <button
                    key={drug.id}
                    onClick={() => handlePickMatch(drug)}
                    className="bg-zinc-900 border border-zinc-700 hover:border-emerald-400 rounded-xl px-4 py-3 text-left transition-all group active:scale-[0.98]"
                  >
                    <p className="text-white font-medium text-sm group-hover:text-emerald-400 transition-colors">
                      {drug.brand_name}
                    </p>
                    {drug.manufacturer && (
                      <p className="text-zinc-500 text-xs mt-0.5">{drug.manufacturer}</p>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-zinc-400 text-sm text-center">
                No medicines recognized. Try again with a clearer photo.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={() => { setMode("camera"); setMatches([]); setError(null); }}
              className="text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl hover:border-emerald-400 hover:text-emerald-400 transition-colors"
            >
              📷 Scan again
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl hover:border-emerald-400 hover:text-emerald-400 transition-colors"
            >
              📁 Upload photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
}
