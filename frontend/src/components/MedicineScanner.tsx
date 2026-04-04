"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { X, Camera, Image, Search, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";

interface MedicineScannerProps {
  onResult: (drugName: string) => void;
  onClose: () => void;
}

type ScanState =
  | "camera"
  | "scanning"
  | "results"
  | "no-match"
  | "error"
  | "no-camera";

interface DrugMatch {
  id: number;
  brand_name: string;
  generic_name?: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://pranavmeds.onrender.com";

const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const NOISE_WORDS =
  /\b(\d+\s?mg|\d+\s?ml|\d+\s?mcg|tablet|capsule|syrup|injection|cream|gel|drops|ointment|solution|suspension|batch|mfg|exp|ip|bp|usp|strip|pack|rx|℞)\b/gi;

function extractDrugsArray(data: unknown): DrugMatch[] {
  if (Array.isArray(data)) return data as DrugMatch[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["results", "drugs", "data", "items", "medicines"]) {
      if (Array.isArray(obj[key])) return obj[key] as DrugMatch[];
    }
  }
  return [];
}

export default function MedicineScanner({ onResult, onClose }: MedicineScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scanState, setScanState] = useState<ScanState>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matches, setMatches] = useState<DrugMatch[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [scanLine, setScanLine] = useState(0);

  useEffect(() => {
    if (scanState !== "camera") return;
    const interval = setInterval(() => {
      setScanLine((prev) => (prev >= 100 ? 0 : prev + 1));
    }, 20);
    return () => clearInterval(interval);
  }, [scanState]);

  const handleCameraError = useCallback(() => {
    setCameraError(true);
    setScanState("no-camera");
  }, []);

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function dataURLtoBlob(dataURL: string): Promise<Blob> {
    const res = await fetch(dataURL);
    return res.blob();
  }

  async function runOCR(blob: Blob): Promise<string> {
    try {
      const form = new FormData();
      form.append("image", blob, "scan.jpg");
      const res = await fetch(`${API_BASE}/api/v1/ocr`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.text === "string" && data.text.trim()) return data.text.trim();
      }
    } catch (e) {
      console.warn("Backend OCR error:", e);
    }

    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiKey) throw new Error("OCR failure (API_KEY missing)");

    const b64 = await blobToBase64(blob);
    const prompt = "Extract the brand name only from this Indian medicine box photo. One or two words. No junk text.";

    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  { inlineData: { mimeType: blob.type || "image/jpeg", data: b64 } },
                  { text: prompt },
                ],
              }],
            }),
            signal: AbortSignal.timeout(20000),
          }
        );
        if (!res.ok) continue;
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      } catch { continue; }
    }
    throw new Error("Could not read medicine name. Please try again.");
  }

  async function processImage(imageDataURL: string) {
    setCapturedImage(imageDataURL);
    setScanState("scanning");
    setErrorMsg("");
    setOcrText("");
    setMatches([]);

    try {
      const blob = await dataURLtoBlob(imageDataURL);
      const rawText = await runOCR(blob);
      if (!rawText.trim()) throw new Error("No medicine name found.");

      const cleaned = rawText.replace(NOISE_WORDS, "").replace(/\s+/g, " ").trim();
      const searchTerm = cleaned || rawText.trim();
      setOcrText(searchTerm);

      const res = await fetch(`${API_BASE}/api/v1/search?q=${encodeURIComponent(searchTerm)}&limit=6`);
      if (!res.ok) throw new Error("Search feature unavailable.");
      const json = await res.json();
      const drugs = extractDrugsArray(json);

      if (drugs.length === 0) setScanState("no-match");
      else {
        setMatches(drugs);
        setScanState("results");
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Something went wrong.");
      setScanState("error");
    }
  }

  return (
    <div className="w-full h-full bg-white flex flex-col relative text-slate-900 overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => processImage(reader.result as string);
          reader.readAsDataURL(file);
        }
      }} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-black text-xl tracking-tight leading-none text-slate-900">Scan Medicine Box</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1.5">Smart Optical Sensor</p>
          </div>
        </div>
        <button onClick={onClose} className="w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
          <X className="w-7 h-7" />
        </button>
      </div>

      {/* Camera Area */}
      <div className="flex-1 relative bg-slate-50 overflow-hidden">
        {scanState === "camera" && !cameraError && (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment", aspectRatio: 1 }}
              onUserMediaError={handleCameraError}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-10">
               <div className="w-full aspect-square max-w-[400px] border-4 border-dashed border-emerald-500/40 rounded-[3rem] relative">
                  {/* Animated Scan Line */}
                  <div 
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_15px_rgba(16,185,129,1)]" 
                    style={{ top: `${scanLine}%` }}
                  />
               </div>
               <p className="mt-10 px-6 py-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                 Align box labels inside the frame
               </p>
            </div>
          </>
        )}

        {scanState === "no-camera" && (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-10 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300">
              <Camera className="w-10 h-10" />
            </div>
            <div>
               <h3 className="text-xl font-black text-slate-900 tracking-tight">Camera Restricted</h3>
               <p className="text-slate-500 text-sm font-medium mt-2">Please enable camera permissions or upload a photo from your gallery instead.</p>
            </div>
          </div>
        )}

        {(scanState === "scanning" || scanState === "results" || scanState === "error" || scanState === "no-match") && capturedImage && (
          <div className="relative w-full h-full">
             <img src={capturedImage} alt="Scanned" className={`w-full h-full object-cover transition-all duration-700 ${scanState === 'scanning' ? 'blur-sm scale-105 brightness-50' : ''}`} />
             {scanState === "scanning" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                   <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg" />
                   <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-emerald-100 shadow-xl">
                      <p className="text-emerald-700 font-black text-xs uppercase tracking-widest">Identifying Medicine...</p>
                   </div>
                </div>
             )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-8 border-t border-slate-100 flex-shrink-0 bg-white">
        {(scanState === "camera" || scanState === "no-camera") && (
          <div className="flex gap-4 items-center justify-center">
            <button onClick={() => fileInputRef.current?.click()} className="flex-[1] flex items-center justify-center gap-3 py-5 px-6 rounded-2xl border-2 border-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
              <Image className="w-5 h-5" />
              Upload
            </button>
            <button onClick={() => {
               const src = webcamRef.current?.getScreenshot();
               if(src) processImage(src);
            }} className="flex-[2] flex items-center justify-center gap-4 py-5 px-10 rounded-[2rem] bg-emerald-500 text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all">
               <Camera className="w-6 h-6" />
               Snap Photo
            </button>
          </div>
        )}

        {scanState === "results" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4 px-5 py-4 bg-emerald-50 rounded-2xl border border-emerald-100">
               <CheckCircle2 className="w-6 h-6 text-emerald-500" />
               <div>
                  <p className="text-emerald-800 font-black text-xs uppercase tracking-widest">Identify Complete</p>
                  <p className="text-slate-600 font-extrabold text-lg tracking-tight">&quot;{ocrText}&quot;</p>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {matches.map((m) => (
                <button key={m.id} onClick={() => { onResult(m.brand_name); onClose(); }} className="p-5 bg-white border-2 border-slate-100 rounded-2xl text-left hover:border-emerald-500 transition-all shadow-sm">
                   <p className="font-black text-slate-900 group-hover:text-emerald-600 transition-colors leading-tight">{m.brand_name}</p>
                   {m.generic_name && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 truncate">{m.generic_name}</p>}
                </button>
              ))}
            </div>
            <button onClick={() => setScanState("camera")} className="w-full flex items-center justify-center gap-3 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-all">
              <RotateCcw className="w-4 h-4" />
              Retake Photo
            </button>
          </div>
        )}

        {(scanState === "error" || scanState === "no-match") && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4 px-5 py-4 bg-red-50 rounded-2xl border border-red-100">
               <AlertTriangle className="w-6 h-6 text-red-500" />
               <p className="text-red-700 font-extrabold text-sm leading-tight">
                 {scanState === "no-match" ? `Could not find "${ocrText}" in our database.` : errorMsg}
               </p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setScanState("camera")} className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                Try Again
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-5 rounded-2xl border-2 border-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                Gallery
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}