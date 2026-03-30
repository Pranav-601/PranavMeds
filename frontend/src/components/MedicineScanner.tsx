"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";

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

// Models tried in order — if one is deprecated/404, the next is used automatically
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const NOISE_WORDS =
  /\b(\d+\s?mg|\d+\s?ml|\d+\s?mcg|tablet|capsule|syrup|injection|cream|gel|drops|ointment|solution|suspension|batch|mfg|exp|ip|bp|usp|strip|pack|rx|℞)\b/gi;

// Safely extract a DrugMatch[] regardless of API response shape
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
      setScanLine((prev) => (prev >= 100 ? 0 : prev + 0.8));
    }, 16);
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

  // OCR: try backend, then fall back to direct Gemini with model cycling
  async function runOCR(blob: Blob): Promise<string> {
    // 1. Backend
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
      } else {
        const errText = await res.text().catch(() => "");
        console.warn("Backend OCR failed:", res.status, errText.slice(0, 200));
      }
    } catch (e) {
      console.warn("Backend OCR network error:", e);
    }

    // 2. Direct Gemini fallback with automatic model cycling
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error(
        "OCR failed. GEMINI_API_KEY is not set on Render. " +
        "Go to Render Dashboard → pranavmeds → Environment → add GEMINI_API_KEY."
      );
    }

    const b64 = await blobToBase64(blob);
    const prompt =
      "This is a photo of an Indian medicine box, strip, or blister pack. " +
      "Extract ONLY the brand name of the medicine (the largest or most prominent text). " +
      "Do NOT include dosage (mg/ml), form (tablet/capsule/syrup), manufacturer name, " +
      "batch number, expiry date, or any other text. " +
      "Reply with just the medicine brand name, nothing else. " +
      "If you cannot find a medicine name, reply with an empty string.";

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
              generationConfig: { temperature: 0.1, maxOutputTokens: 50 },
            }),
            signal: AbortSignal.timeout(20000),
          }
        );

        if (res.status === 404 || res.status === 400) {
          console.warn(`Model ${model} unavailable (${res.status}), trying next…`);
          continue;
        }
        if (res.status === 429) {
          throw new Error(
            "Gemini rate limit reached. Your free quota may be exhausted. " +
            "Wait a few minutes and try again, or enable billing at aistudio.google.com."
          );
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn(`Model ${model} failed (${res.status}):`, errText.slice(0, 100));
          continue;
        }

        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      } catch (e: any) {
        if (e?.message?.includes("rate limit") || e?.message?.includes("quota")) throw e;
        console.warn(`Model ${model} threw:`, e?.message);
      }
    }

    throw new Error(
      "All Gemini models failed or are unavailable. " +
      "Check your API key at aistudio.google.com and try again."
    );
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

      if (!rawText.trim()) {
        setErrorMsg("No medicine name found. Try holding the box closer and ensure good lighting.");
        setScanState("error");
        return;
      }

      const cleaned = rawText.replace(NOISE_WORDS, "").replace(/\s+/g, " ").trim();
      const searchTerm = cleaned || rawText.trim();
      setOcrText(searchTerm);

      let drugs: DrugMatch[] = [];
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/search?q=${encodeURIComponent(searchTerm)}&limit=6`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const json = await res.json();
          drugs = extractDrugsArray(json); // never throws, always returns array
        } else {
          console.warn("Search API error:", res.status);
        }
      } catch (e) {
        console.warn("Search fetch error:", e);
        // fall through to no-match rather than crashing
      }

      if (drugs.length === 0) {
        setScanState("no-match");
      } else {
        setMatches(drugs);
        setScanState("results");
      }
    } catch (e: any) {
      console.error("Scanner error:", e);
      setErrorMsg(e?.message || "Unexpected error. Please try again.");
      setScanState("error");
    }
  }

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) processImage(imageSrc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => processImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleReset = () => {
    setCapturedImage(null);
    setMatches([]);
    setErrorMsg("");
    setOcrText("");
    setScanState(cameraError ? "no-camera" : "camera");
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.8)",
          zIndex: 9998,
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        boxSizing: "border-box",
      }}>
        <div style={{
          background: "#0f172a",
          borderRadius: "clamp(0px, 3vw, 20px)",
          overflow: "hidden",
          width: "min(480px, 100vw)",
          maxHeight: "min(800px, 100dvh)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
        }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>💊</span>
              <div>
                <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>
                  Medicine Scanner
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>Powered by Gemini Vision</div>
              </div>
            </div>
            <button onClick={onClose} style={closeBtnStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            >×</button>
          </div>

          {/* Camera / image area */}
          <div style={{ position: "relative", flex: "1 1 0", minHeight: 240, background: "#000", overflow: "hidden" }}>

            {/* Live camera */}
            {scanState === "camera" && !cameraError && (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.92}
                  videoConstraints={{ facingMode: { ideal: "environment" }, aspectRatio: 1 }}
                  onUserMediaError={handleCameraError}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)" }} />
                  <div style={{ position: "relative", width: "72%", paddingBottom: "72%" }}>
                    <div style={{ position: "absolute", inset: 0 }}>
                      {[
                        { top: 0, left: 0, borderTop: "3px solid #10b981", borderLeft: "3px solid #10b981", borderRadius: "4px 0 0 0" },
                        { top: 0, right: 0, borderTop: "3px solid #10b981", borderRight: "3px solid #10b981", borderRadius: "0 4px 0 0" },
                        { bottom: 0, left: 0, borderBottom: "3px solid #10b981", borderLeft: "3px solid #10b981", borderRadius: "0 0 0 4px" },
                        { bottom: 0, right: 0, borderBottom: "3px solid #10b981", borderRight: "3px solid #10b981", borderRadius: "0 0 4px 0" },
                      ].map((s, i) => (
                        <div key={i} style={{ position: "absolute", width: 28, height: 28, ...s }} />
                      ))}
                      <div style={{
                        position: "absolute", left: 4, right: 4, top: `${scanLine}%`, height: 2,
                        background: "linear-gradient(90deg, transparent, #10b981, #34d399, #10b981, transparent)",
                        boxShadow: "0 0 12px 2px rgba(16,185,129,0.6)",
                      }} />
                    </div>
                  </div>
                </div>
                <div style={{
                  position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                  color: "#e2e8f0", fontSize: 12, fontWeight: 500,
                  padding: "5px 12px", borderRadius: 20, whiteSpace: "nowrap",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  Point camera at medicine box or strip
                </div>
              </>
            )}

            {/* No camera */}
            {scanState === "no-camera" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, minHeight: 240, color: "#94a3b8", textAlign: "center" }}>
                <div style={{ fontSize: 48 }}>📷</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#cbd5e1" }}>Camera access denied</div>
                <div style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}>
                  Enable camera permissions in your browser, or upload a photo from your gallery below.
                </div>
              </div>
            )}

            {/* Captured / uploaded image */}
            {capturedImage && scanState !== "camera" && scanState !== "no-camera" && (
              <img src={capturedImage} alt="Captured" style={{
                width: "100%", height: "100%", objectFit: "cover", display: "block",
                filter: scanState === "scanning" ? "brightness(0.4)" : "none",
                transition: "filter 0.3s",
              }} />
            )}

            {/* Scanning overlay */}
            {scanState === "scanning" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <div style={{ position: "relative", width: 56, height: 56 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid rgba(16,185,129,0.2)", borderTop: "3px solid #10b981", animation: "spin 0.8s linear infinite" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🔍</div>
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 600 }}>Analysing image…</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>Gemini Vision is reading the label</div>
              </div>
            )}
          </div>

          {/* Bottom panel */}
          <div style={{ flexShrink: 0, padding: "14px 16px 16px", background: "#0f172a" }}>

            {(scanState === "camera" || scanState === "no-camera") && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={uploadBtnStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                >
                  <span style={{ fontSize: 18 }}>🖼️</span> Upload photo
                </button>
                {scanState === "camera" && (
                  <button
                    onClick={handleCapture}
                    style={captureBtnStyle}
                    onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.94)"; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                    onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.94)"; }}
                    onTouchEnd={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                    title="Capture"
                  >
                    📸
                  </button>
                )}
              </div>
            )}

            {scanState === "scanning" && (
              <div style={{ textAlign: "center", color: "#64748b", fontSize: 13 }}>
                This usually takes 2–5 seconds…
              </div>
            )}

            {scanState === "results" && (
              <div>
                {ocrText && (
                  <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#64748b", fontSize: 12 }}>Detected:</span>
                    <span style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {ocrText}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {matches.map((drug) => (
                    <button key={drug.id}
                      onClick={() => { onResult(drug.brand_name); onClose(); }}
                      style={matchBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(16,185,129,0.22)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.55)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(16,185,129,0.1)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}
                    >
                      {drug.brand_name}
                      {drug.generic_name && (
                        <span style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 400, marginTop: 1 }}>{drug.generic_name}</span>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={handleReset} style={secondaryBtnStyle}>🔄 Scan again</button>
              </div>
            )}

            {scanState === "no-match" && (
              <div>
                <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, color: "#fbbf24", fontSize: 13 }}>
                  <strong>"{ocrText}"</strong> — no matching drugs found in our database.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleReset} style={secondaryBtnStyle}>🔄 Try again</button>
                  <button onClick={() => fileInputRef.current?.click()} style={{ ...secondaryBtnStyle, flex: "0 0 auto" }}>🖼️ Upload instead</button>
                </div>
              </div>
            )}

            {scanState === "error" && (
              <div>
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, color: "#fca5a5", fontSize: 12, lineHeight: 1.6, wordBreak: "break-word" }}>
                  {errorMsg || "Something went wrong. Please try again."}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleReset} style={secondaryBtnStyle}>🔄 Try again</button>
                  <button onClick={() => fileInputRef.current?.click()} style={{ ...secondaryBtnStyle, flex: "0 0 auto" }}>🖼️ Upload instead</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const closeBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "50%",
  width: 34, height: 34, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#94a3b8", fontSize: 18, lineHeight: 1, transition: "background 0.15s",
};
const uploadBtnStyle: React.CSSProperties = {
  flex: "0 0 auto", height: 52, padding: "0 20px",
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14, color: "#cbd5e1", fontSize: 13, fontWeight: 600,
  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
  transition: "background 0.15s", whiteSpace: "nowrap",
};
const captureBtnStyle: React.CSSProperties = {
  flex: "0 0 auto", width: 68, height: 68, borderRadius: "50%",
  background: "#10b981", border: "4px solid rgba(255,255,255,0.15)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 26, boxShadow: "0 0 0 2px #10b981, 0 6px 20px rgba(16,185,129,0.4)",
  transition: "transform 0.1s",
};
const matchBtnStyle: React.CSSProperties = {
  background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
  borderRadius: 10, color: "#e2e8f0", padding: "8px 14px",
  cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left",
  transition: "background 0.15s, border-color 0.15s",
};
const secondaryBtnStyle: React.CSSProperties = {
  flex: 1, height: 44,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12, color: "#cbd5e1", fontSize: 13, fontWeight: 600,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  gap: 6, transition: "background 0.15s",
};