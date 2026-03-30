"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";

interface MedicineScannerProps {
  onResult: (drugName: string) => void;
  onClose: () => void;
}

type ScanState =
  | "camera"
  | "preview"
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

// Noise words to strip from OCR result before searching
const NOISE_WORDS =
  /\b(\d+\s?mg|\d+\s?ml|\d+\s?mcg|tablet|capsule|syrup|injection|cream|gel|drops|ointment|solution|suspension|batch|mfg|exp|ip|bp|usp|strip|pack|rx|℞)\b/gi;

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

  // Animate scan line
  useEffect(() => {
    if (scanState !== "camera" && scanState !== "preview") return;
    const interval = setInterval(() => {
      setScanLine((prev) => (prev >= 100 ? 0 : prev + 0.8));
    }, 16);
    return () => clearInterval(interval);
  }, [scanState]);

  const handleCameraError = useCallback(() => {
    setCameraError(true);
    setScanState("no-camera");
  }, []);

  // ── OCR via backend (with direct Gemini fallback) ──────────────────────────
  async function runOCR(blob: Blob): Promise<string> {
    // Try backend first
    try {
      const form = new FormData();
      form.append("image", blob, "scan.jpg");
      const res = await fetch(`${API_BASE}/api/v1/ocr`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) return data.text;
      } else {
        const errText = await res.text();
        console.warn("Backend OCR failed:", res.status, errText);
      }
    } catch (e) {
      console.warn("Backend OCR network error:", e);
    }

    // Direct Gemini fallback (needs NEXT_PUBLIC_GEMINI_API_KEY on Netlify)
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (geminiKey) {
      const b64 = await blobToBase64(blob);
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: blob.type || "image/jpeg",
                  data: b64,
                },
              },
              {
                text:
                  "This is a photo of an Indian medicine box, strip, or blister pack. " +
                  "Extract ONLY the brand name of the medicine (the largest or most prominent text). " +
                  "Do NOT include dosage (mg/ml), form (tablet/capsule/syrup), manufacturer name, " +
                  "batch number, expiry date, or any other text. " +
                  "Reply with just the medicine brand name, nothing else. " +
                  "If you cannot find a medicine name, reply with an empty string.",
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 50 },
      };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (res.ok) {
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      }
      throw new Error(`Gemini direct call failed: ${res.status}`);
    }

    throw new Error(
      "OCR failed. Make sure GEMINI_API_KEY is set on Render (or NEXT_PUBLIC_GEMINI_API_KEY on Netlify for fallback)."
    );
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function dataURLtoBlob(dataURL: string): Promise<Blob> {
    const res = await fetch(dataURL);
    return res.blob();
  }

  // ── Process image (capture or upload) ─────────────────────────────────────
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
        setErrorMsg("No medicine name found in the image. Try holding the box closer.");
        setScanState("error");
        return;
      }

      const cleaned = rawText.replace(NOISE_WORDS, "").replace(/\s+/g, " ").trim();
      setOcrText(cleaned || rawText.trim());

      const searchTerm = cleaned || rawText.trim();
      const res = await fetch(
        `${API_BASE}/api/v1/search?q=${encodeURIComponent(searchTerm)}&limit=6`
      );
      const drugs: DrugMatch[] = await res.json();

      if (!drugs || drugs.length === 0) {
        setMatches([]);
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

  // ── Capture from webcam ────────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    processImage(imageSrc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upload from gallery ────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;
      processImage(dataURL);
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const handleReset = () => {
    setCapturedImage(null);
    setMatches([]);
    setErrorMsg("");
    setOcrText("");
    setScanState(cameraError ? "no-camera" : "camera");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={undefined}
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 9998,
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          zIndex: 9999,
          // Mobile: full screen. Desktop: centered card
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        }}
      >
        <div
          style={{
            background: "#0f172a",
            borderRadius: "clamp(0px, 3vw, 20px)",
            overflow: "hidden",
            width: "min(480px, 100vw)",
            maxHeight: "min(780px, 100dvh)",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
            position: "relative",
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>💊</span>
              <div>
                <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>
                  Medicine Scanner
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  Powered by Gemini Vision
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "none",
                borderRadius: "50%",
                width: 34,
                height: 34,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: 18,
                lineHeight: 1,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            >
              ×
            </button>
          </div>

          {/* ── Camera / Content Area ── */}
          <div style={{ position: "relative", flex: 1, minHeight: 0, background: "#000" }}>
            {/* Camera feed */}
            {(scanState === "camera" || scanState === "preview") && !cameraError && (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.92}
                  videoConstraints={{
                    facingMode: { ideal: "environment" },
                    aspectRatio: 1,
                  }}
                  onUserMediaError={handleCameraError}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />

                {/* Scan frame overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  {/* Dark vignette */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)",
                  }} />

                  {/* Frame box */}
                  <div style={{ position: "relative", width: "72%", paddingBottom: "72%" }}>
                    <div style={{ position: "absolute", inset: 0 }}>
                      {/* Corners */}
                      {[
                        { top: 0, left: 0, borderTop: "3px solid #10b981", borderLeft: "3px solid #10b981", borderRadius: "4px 0 0 0" },
                        { top: 0, right: 0, borderTop: "3px solid #10b981", borderRight: "3px solid #10b981", borderRadius: "0 4px 0 0" },
                        { bottom: 0, left: 0, borderBottom: "3px solid #10b981", borderLeft: "3px solid #10b981", borderRadius: "0 0 0 4px" },
                        { bottom: 0, right: 0, borderBottom: "3px solid #10b981", borderRight: "3px solid #10b981", borderRadius: "0 0 4px 0" },
                      ].map((s, i) => (
                        <div key={i} style={{ position: "absolute", width: 28, height: 28, ...s }} />
                      ))}

                      {/* Animated scan line */}
                      <div
                        style={{
                          position: "absolute",
                          left: 4,
                          right: 4,
                          top: `${scanLine}%`,
                          height: 2,
                          background: "linear-gradient(90deg, transparent, #10b981, #34d399, #10b981, transparent)",
                          boxShadow: "0 0 12px 2px rgba(16,185,129,0.6)",
                          transition: "top 16ms linear",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Instruction label */}
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(8px)",
                    color: "#e2e8f0",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "5px 12px",
                    borderRadius: 20,
                    whiteSpace: "nowrap",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Point camera at medicine box or strip
                </div>
              </>
            )}

            {/* No camera — upload only */}
            {scanState === "no-camera" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: 32,
                  minHeight: 220,
                  color: "#94a3b8",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 48 }}>📷</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#cbd5e1" }}>
                  Camera access denied
                </div>
                <div style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
                  Enable camera permissions in your browser settings, or upload an image from your gallery.
                </div>
              </div>
            )}

            {/* Preview of captured/uploaded image */}
            {(scanState === "scanning" || scanState === "results" || scanState === "no-match" || scanState === "error") &&
              capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    filter: scanState === "scanning" ? "brightness(0.5)" : "none",
                    transition: "filter 0.3s",
                  }}
                />
              )}

            {/* Scanning overlay */}
            {scanState === "scanning" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                }}
              >
                <div style={{ position: "relative", width: 56, height: 56 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    border: "3px solid rgba(16,185,129,0.2)",
                    borderTop: "3px solid #10b981",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>
                    🔍
                  </div>
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 600 }}>
                  Analysing image…
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  Gemini Vision is reading the label
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom panel ── */}
          <div style={{ flexShrink: 0, padding: "14px 16px 16px", background: "#0f172a" }}>
            {/* CAMERA STATE — capture + upload buttons */}
            {(scanState === "camera" || scanState === "no-camera") && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
                {/* Upload from gallery */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: "0 0 auto",
                    height: 52,
                    padding: "0 20px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                    color: "#cbd5e1",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "background 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                >
                  <span style={{ fontSize: 18 }}>🖼️</span>
                  Upload photo
                </button>

                {/* Capture button */}
                {scanState === "camera" && (
                  <button
                    onClick={handleCapture}
                    style={{
                      flex: "0 0 auto",
                      width: 68,
                      height: 68,
                      borderRadius: "50%",
                      background: "#10b981",
                      border: "4px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      boxShadow: "0 0 0 2px #10b981, 0 6px 20px rgba(16,185,129,0.4)",
                      transition: "transform 0.1s, box-shadow 0.1s",
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = "scale(0.94)";
                      e.currentTarget.style.boxShadow = "0 0 0 2px #10b981, 0 2px 10px rgba(16,185,129,0.3)";
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "0 0 0 2px #10b981, 0 6px 20px rgba(16,185,129,0.4)";
                    }}
                    title="Capture"
                  >
                    📸
                  </button>
                )}
              </div>
            )}

            {/* SCANNING STATE */}
            {scanState === "scanning" && (
              <div style={{ textAlign: "center", color: "#64748b", fontSize: 13 }}>
                This usually takes 2–4 seconds…
              </div>
            )}

            {/* RESULTS STATE */}
            {scanState === "results" && (
              <div>
                {ocrText && (
                  <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#64748b", fontSize: 12 }}>Detected:</span>
                    <span
                      style={{
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(16,185,129,0.25)",
                        color: "#34d399",
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {ocrText}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {matches.map((drug) => (
                    <button
                      key={drug.id}
                      onClick={() => {
                        onResult(drug.brand_name);
                        onClose();
                      }}
                      style={{
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        borderRadius: 10,
                        color: "#e2e8f0",
                        padding: "8px 14px",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: "left",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(16,185,129,0.22)";
                        e.currentTarget.style.borderColor = "rgba(16,185,129,0.55)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(16,185,129,0.1)";
                        e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)";
                      }}
                    >
                      {drug.brand_name}
                      {drug.generic_name && (
                        <span style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 400, marginTop: 1 }}>
                          {drug.generic_name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={handleReset} style={secondaryBtnStyle}>
                  🔄 Scan again
                </button>
              </div>
            )}

            {/* NO MATCH STATE */}
            {scanState === "no-match" && (
              <div>
                <div
                  style={{
                    background: "rgba(251,191,36,0.08)",
                    border: "1px solid rgba(251,191,36,0.2)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 12,
                    color: "#fbbf24",
                    fontSize: 13,
                  }}
                >
                  <strong>"{ocrText}"</strong> — no matching drugs found in the database.
                </div>
                <button onClick={handleReset} style={secondaryBtnStyle}>
                  🔄 Try again
                </button>
              </div>
            )}

            {/* ERROR STATE */}
            {scanState === "error" && (
              <div>
                <div
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 12,
                    color: "#fca5a5",
                    fontSize: 12,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {errorMsg || "Something went wrong. Please try again."}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleReset} style={secondaryBtnStyle}>
                    🔄 Try again
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ ...secondaryBtnStyle, flex: "0 0 auto" }}
                  >
                    🖼️ Upload instead
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  height: 44,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  transition: "background 0.15s",
};