"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MedicineScannerProps {
  onResult: (drugName: string) => void;
  onClose: () => void;
}

interface DrugMatch {
  id: number;
  brand_name: string;
}

type Mode = "camera" | "processing" | "results";

export default function MedicineScanner({ onResult, onClose }: MedicineScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matches, setMatches] = useState<DrugMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [cameraError, setCameraError] = useState(false);

  // ── Core OCR + search pipeline ──────────────────────────────────────────────
  const processImage = useCallback(async (imageSrc: string) => {
    setMode("processing");
    setError(null);

    try {
      // 1. Convert base64 dataURL → Blob
      setProgress("Sending image to Gemini Vision…");
      const fetchRes = await fetch(imageSrc);
      const blob = await fetchRes.blob();

      const form = new FormData();
      form.append("image", blob, "scan.jpg");

      // 2. Hit our backend OCR endpoint (key stays server-side)
      const ocrRes = await fetch(`${API}/api/v1/ocr`, {
        method: "POST",
        body: form,
      });

      if (!ocrRes.ok) throw new Error("OCR request failed");
      const { text } = await ocrRes.json();

      if (!text || text.trim().length < 2) {
        setError("Couldn't read a medicine name. Try better lighting or a closer shot.");
        setMode("camera");
        return;
      }

      // 3. Search the database with the extracted name
      setProgress(`Searching for "${text.trim()}"…`);

      const noiseWords = new Set([
        "mg", "ml", "tablet", "tablets", "capsule", "capsules", "strip",
        "pack", "of", "each", "mfg", "exp", "batch", "manufactured",
        "marketed", "by", "date", "store", "below", "keep", "away",
        "children", "price", "mrp", "incl", "gst", "composition",
        "schedule", "rx", "use", "under", "medical", "supervision",
        "injection", "syrup", "solution", "suspension", "cream", "ointment",
      ]);

      // Gemini already returns just the brand name, but clean it anyway
      const cleaned = text
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => !noiseWords.has(w.toLowerCase()) && w.length > 1)
        .join(" ")
        .trim();

      if (cleaned.length < 2) {
        setError("Couldn't extract a medicine name. Please try again.");
        setMode("camera");
        return;
      }

      const searchRes = await fetch(
        `${API}/api/v1/search?q=${encodeURIComponent(cleaned)}&limit=5`
      );
      if (!searchRes.ok) throw new Error("Search failed");
      const data = await searchRes.json();

      const found: DrugMatch[] = (data.results ?? []).map((r: DrugMatch) => ({
        id: r.id,
        brand_name: r.brand_name,
      }));

      setMatches(found);
      setMode("results");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setMode("camera");
    }
  }, []);

  // ── Camera capture ───────────────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    setCapturedImage(imageSrc);
    processImage(imageSrc);
  }, [processImage]);

  // ── Gallery upload ───────────────────────────────────────────────────────────
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageSrc = event.target?.result as string;
        setCapturedImage(imageSrc);
        processImage(imageSrc);
      };
      reader.readAsDataURL(file);
    },
    [processImage]
  );

  const handleReset = () => {
    setMode("camera");
    setCapturedImage(null);
    setMatches([]);
    setError(null);
    setProgress("");
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <p className="text-white font-semibold text-base">Scan Medicine</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {mode === "camera" && "Point camera at medicine box or strip"}
            {mode === "processing" && "Reading medicine name…"}
            {mode === "results" && "Tap a match to search"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          aria-label="Close scanner"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── CAMERA MODE ── */}
      {mode === "camera" && (
        <div className="flex-1 flex flex-col">
          {/* Viewfinder */}
          <div className="flex-1 relative overflow-hidden">
            {!cameraError ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.85}
                videoConstraints={{ facingMode: { ideal: "environment" } }}
                onUserMediaError={() => setCameraError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-zinc-950 px-8 text-center">
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-7 h-7 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  </svg>
                </div>
                <p className="text-zinc-400 text-sm">Camera access denied or unavailable</p>
                <p className="text-zinc-600 text-xs">Use the upload option below instead</p>
              </div>
            )}

            {/* Scanning frame overlay */}
            {!cameraError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-40 relative">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br" />
                  {/* Scan line animation */}
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan" />
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-5 mt-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="px-5 py-6 flex flex-col items-center gap-4 shrink-0">
            {!cameraError && (
              <button
                onClick={handleCapture}
                className="w-16 h-16 rounded-full bg-white hover:bg-zinc-100 transition-colors flex items-center justify-center shadow-lg shadow-white/10"
                aria-label="Capture photo"
              >
                <div className="w-12 h-12 rounded-full border-2 border-zinc-300" />
              </button>
            )}

            {/* Gallery upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-zinc-400 hover:text-emerald-400 text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Upload from gallery
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      )}

      {/* ── PROCESSING MODE ── */}
      {mode === "processing" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-32 h-20 object-cover rounded-xl border border-zinc-700"
            />
          )}
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-300 text-sm text-center">{progress || "Processing…"}</p>
            <p className="text-zinc-600 text-xs text-center">Powered by Gemini Vision</p>
          </div>
        </div>
      )}

      {/* ── RESULTS MODE ── */}
      {mode === "results" && (
        <div className="flex-1 flex flex-col px-5 pb-6 overflow-y-auto">
          {/* Thumbnail */}
          {capturedImage && (
            <div className="flex justify-center mb-6 mt-2">
              <img
                src={capturedImage}
                alt="Scanned"
                className="w-28 h-18 object-cover rounded-xl border border-zinc-700"
              />
            </div>
          )}

          {matches.length > 0 ? (
            <>
              <p className="text-zinc-500 text-xs text-center mb-4">
                {matches.length} match{matches.length !== 1 ? "es" : ""} found — tap one to search
              </p>
              <div className="flex flex-col gap-3">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => {
                      onResult(match.brand_name);
                      onClose();
                    }}
                    className="w-full bg-emerald-400/10 border border-emerald-400/30 hover:bg-emerald-400/20 hover:border-emerald-400 text-emerald-400 px-5 py-3.5 rounded-xl text-left font-medium transition-all"
                  >
                    {match.brand_name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-zinc-400 text-sm">No medicines matched.</p>
              <p className="text-zinc-600 text-xs max-w-xs">
                Try again with better lighting, or hold the camera closer to the medicine name.
              </p>
            </div>
          )}

          <button
            onClick={handleReset}
            className="mt-6 w-full border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white py-3 rounded-xl text-sm transition-colors"
          >
            Scan again
          </button>
        </div>
      )}

      {/* Scan line animation style */}
      <style jsx>{`
        @keyframes scan {
          0% { top: 0; opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
}