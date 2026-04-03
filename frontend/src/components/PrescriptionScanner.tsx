"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";

interface PrescriptionScannerProps {
    onClose: () => void;
}

type ScanState =
    | "camera"
    | "no-camera"
    | "scanning"
    | "results"
    | "no-results"
    | "error";

interface PrescriptionRow {
    medicine_input: string;
    branded_name: string | null;
    branded_mrp: string | number | null;
    generic_name: string | null;
    generic_mrp: string | number | null;
    saving: string | number | null;
    saving_pct: number | null;
}

interface ScanResult {
    rows: PrescriptionRow[];
    total_branded: string | number;
    total_generic: string | number;
    total_savings: string | number;
    medicines_found: number;
    medicines_not_found: number;
}

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "https://pranavmeds.onrender.com";

function fmt(v: string | number | null): string {
    if (v == null) return "—";
    const n = Number(v);
    if (isNaN(n)) return "—";
    return `₹${n.toFixed(0)}`;
}

// ✅ Fix: reliably convert a data URL to a typed Blob (preserves MIME type on mobile)
function dataURLtoTypedBlob(dataURL: string): Blob {
    const [header, base64] = dataURL.split(",");
    const mimeType = header.match(/data:([^;]+);/)?.[1] || "image/jpeg";
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mimeType });
}

export default function PrescriptionScanner({ onClose }: PrescriptionScannerProps) {
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [scanState, setScanState] = useState<ScanState>("camera");
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [cameraError, setCameraError] = useState(false);
    const [scanLine, setScanLine] = useState(0);
    const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");
    const [flashOn, setFlashOn] = useState(false);

    const toggleFlash = async () => {
        if (!webcamRef.current) return;
        const stream = (webcamRef.current.video as any)?.srcObject as MediaStream;
        if (!stream) return;
        const tracks = stream.getVideoTracks();
        if (tracks.length === 0) return;
        const track = tracks[0];

        try {
            const capabilities = track.getCapabilities() as any;
            if (capabilities.torch) {
                const newFlashState = !flashOn;
                await track.applyConstraints({
                    advanced: [{ torch: newFlashState }]
                } as any);
                setFlashOn(newFlashState);
            } else {
                alert("Flashlight not supported on this device/browser.");
            }
        } catch (e) {
            console.error("Torch error:", e);
        }
    };

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

    function buildShareText(r: ScanResult): string {
        const rows = r.rows
            .filter((row) => row.branded_name)
            .map(
                (row) =>
                    `${row.branded_name}: ${fmt(row.branded_mrp)} → ${fmt(row.generic_mrp)} (${row.saving_pct != null ? Math.round(row.saving_pct) + "% cheaper" : ""})`
            )
            .join("\n");
        return (
            `💊 PranavMeds — Prescription Savings\n\n` +
            `${rows}\n\n` +
            `Branded total: ${fmt(r.total_branded)}\n` +
            `Generic total: ${fmt(r.total_generic)}\n` +
            `You save: ${fmt(r.total_savings)} 💚\n\n` +
            `Find affordable medicine alternatives at pranavmeds.com`
        );
    }

    async function handleShare() {
        if (!result) return;
        const text = buildShareText(result);
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share({ title: "PranavMeds Prescription Savings", text });
                setShareStatus("shared");
            } catch {
                /* user dismissed */
            }
        } else {
            await navigator.clipboard.writeText(text);
            setShareStatus("copied");
            setTimeout(() => setShareStatus("idle"), 2500);
        }
    }

    async function processImage(imageDataURL: string) {
        setCapturedImage(imageDataURL);
        setScanState("scanning");
        setErrorMsg("");
        setResult(null);

        try {
            // ✅ Fix: use dataURLtoTypedBlob instead of fetch(dataURL).blob()
            // fetch().blob() loses the MIME type on many mobile browsers, causing
            // the backend to receive content_type=None and Gemini to reject the image.
            const blob = dataURLtoTypedBlob(imageDataURL);

            const form = new FormData();
            form.append("image", blob, "prescription.jpg");

            const apiRes = await fetch(`${API_BASE}/api/v1/scan-prescription`, {
                method: "POST",
                body: form,
                signal: AbortSignal.timeout(40000),
            });

            if (!apiRes.ok) {
                const errText = await apiRes.text().catch(() => "");
                throw new Error(
                    errText
                        ? `Server error ${apiRes.status}: ${errText.slice(0, 200)}`
                        : `Server error ${apiRes.status}`
                );
            }

            const data: ScanResult = await apiRes.json();

            if (data.medicines_found === 0 && data.rows.length === 0) {
                setScanState("no-results");
                return;
            }

            setResult(data);
            setScanState("results");
        } catch (e: any) {
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
        setResult(null);
        setErrorMsg("");
        setShareStatus("idle");
        setScanState(cameraError ? "no-camera" : "camera");
    };

    const savings = result ? Number(result.total_savings) : 0;
    const branded = result ? Number(result.total_branded) : 0;
    const generic = result ? Number(result.total_generic) : 0;
    const overallPct = branded > 0 ? Math.round(((branded - generic) / branded) * 100) : 0;

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
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.85)",
                    zIndex: 9998,
                    backdropFilter: "blur(8px)",
                }}
            />

            {/* Modal */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding:
                        "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        background: "#0f0a1a",
                        borderRadius: "clamp(0px, 3vw, 20px)",
                        overflow: "hidden",
                        width: "min(520px, 100vw)",
                        maxHeight: "min(860px, 100dvh)",
                        display: "flex",
                        flexDirection: "column",
                        boxShadow:
                            "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(168,85,247,0.2)",
                    }}
                >
                    {/* ── Header ── */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "14px 16px 12px",
                            borderBottom: "1px solid rgba(168,85,247,0.15)",
                            flexShrink: 0,
                            background:
                                "linear-gradient(90deg, rgba(168,85,247,0.08) 0%, transparent 100%)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 20 }}>📋</span>
                            <div>
                                <div
                                    style={{
                                        color: "#f8fafc",
                                        fontWeight: 700,
                                        fontSize: 15,
                                        letterSpacing: "-0.2px",
                                    }}
                                >
                                    Prescription Scanner
                                </div>
                                <div style={{ color: "#7c3aed", fontSize: 12 }}>
                                    Powered by Gemini Vision · Jan Aushadhi savings
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            style={closeBtnStyle}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.background = "rgba(168,85,247,0.18)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
                            }
                        >
                            ×
                        </button>
                    </div>

                    {/* ── Dynamic Main Area (Camera or Results) ── */}
                    {(scanState === "camera" ||
                        scanState === "no-camera" ||
                        scanState === "scanning") ? (
                        <div
                            style={{
                                position: "relative",
                                flex: "1 1 0",
                                minHeight: 340,
                                background: "#000",
                                overflow: "hidden",
                            }}
                        >
                            {scanState === "camera" && !cameraError && (
                                <>
                                    <Webcam
                                        ref={webcamRef}
                                        audio={false}
                                        screenshotFormat="image/jpeg"
                                        screenshotQuality={0.92}
                                        videoConstraints={{
                                            facingMode: { ideal: "environment" },
                                            aspectRatio: 4 / 3,
                                        }}
                                        onUserMediaError={handleCameraError}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                    />
                                    {/* Scanning reticle */}
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
                                        <div
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                background:
                                                    "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
                                            }}
                                        />
                                        {/* Scan line */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: "12%",
                                                right: "12%",
                                                top: `${20 + scanLine * 0.6}%`,
                                                height: 2,
                                                background:
                                                    "linear-gradient(90deg, transparent, #a855f7, #c084fc, #a855f7, transparent)",
                                                boxShadow: "0 0 12px 2px rgba(168,85,247,0.6)",
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 12,
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            background: "rgba(0,0,0,0.65)",
                                            backdropFilter: "blur(8px)",
                                            color: "#e2e8f0",
                                            fontSize: 12,
                                            fontWeight: 500,
                                            padding: "5px 14px",
                                            borderRadius: 20,
                                            whiteSpace: "nowrap",
                                            border: "1px solid rgba(168,85,247,0.25)",
                                        }}
                                    >
                                        Point camera at your prescription
                                    </div>
                                    {/* Flash toggle */}
                                    <button
                                        onClick={toggleFlash}
                                        style={{
                                            position: "absolute",
                                            top: 12,
                                            right: 12,
                                            background: flashOn ? "rgba(251,191,36,0.25)" : "rgba(0,0,0,0.65)",
                                            border: flashOn ? "1px solid #fbbf24" : "1px solid rgba(255,255,255,0.25)",
                                            color: flashOn ? "#fbbf24" : "#e2e8f0",
                                            width: 36,
                                            height: 36,
                                            borderRadius: "50%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 16,
                                            cursor: "pointer",
                                            backdropFilter: "blur(8px)",
                                        }}
                                        title="Toggle Flashlight"
                                    >
                                        {flashOn ? "🔦" : "💡"}
                                    </button>

                                    {/* Capture button overlay */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            bottom: 20,
                                            left: 0,
                                            right: 0,
                                            display: "flex",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <button
                                            onClick={handleCapture}
                                            style={captureBtnStyle}
                                            onMouseDown={(e) => {
                                                e.currentTarget.style.transform = "scale(0.94)";
                                            }}
                                            onMouseUp={(e) => {
                                                e.currentTarget.style.transform = "scale(1)";
                                            }}
                                            onTouchStart={(e) => {
                                                e.currentTarget.style.transform = "scale(0.94)";
                                            }}
                                            onTouchEnd={(e) => {
                                                e.currentTarget.style.transform = "scale(1)";
                                            }}
                                            title="Capture"
                                        >
                                            📸
                                        </button>
                                    </div>
                                </>
                            )}

                            {scanState === "no-camera" && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 12,
                                        padding: 32,
                                        height: "100%",
                                        color: "#94a3b8",
                                        textAlign: "center",
                                    }}
                                >
                                    <div style={{ fontSize: 48 }}>📷</div>
                                    <div
                                        style={{ fontSize: 15, fontWeight: 600, color: "#cbd5e1" }}
                                    >
                                        Camera access denied
                                    </div>
                                    <div
                                        style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}
                                    >
                                        Upload a photo of your prescription instead.
                                    </div>
                                </div>
                            )}

                            {scanState === "scanning" && (
                                <>
                                    {capturedImage && (
                                        <img
                                            src={capturedImage}
                                            alt="Prescription"
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: "block",
                                                filter: "brightness(0.3)",
                                            }}
                                        />
                                    )}
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
                                            <div
                                                style={{
                                                    width: 56,
                                                    height: 56,
                                                    borderRadius: "50%",
                                                    border: "3px solid rgba(168,85,247,0.2)",
                                                    borderTop: "3px solid #a855f7",
                                                    animation: "spin 0.8s linear infinite",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: 22,
                                                }}
                                            >
                                                🔍
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                color: "#e2e8f0",
                                                fontSize: 15,
                                                fontWeight: 600,
                                            }}
                                        >
                                            Reading prescription…
                                        </div>
                                        <div style={{ color: "#7c3aed", fontSize: 12 }}>
                                            Gemini Vision is extracting medicines
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div
                            style={{
                                flex: "1 1 0",
                                overflowY: "auto",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            {/* ── Results ── */}
                            {scanState === "results" && result && (
                                <div style={{ padding: "0 0 16px" }}>
                                    {/* Savings hero */}
                                    <div
                                        style={{
                                            margin: "16px 16px 0",
                                            background:
                                                "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,78,59,0.06) 100%)",
                                            border: "1px solid rgba(16,185,129,0.25)",
                                            borderRadius: 16,
                                            padding: "16px 20px",
                                            textAlign: "center",
                                        }}
                                    >
                                        <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                                            Your doctor prescribed{" "}
                                            <span style={{ color: "#f87171", fontWeight: 700 }}>
                                                {fmt(result.total_branded)}
                                            </span>
                                            . Same medicines cost{" "}
                                            <span style={{ color: "#34d399", fontWeight: 700 }}>
                                                {fmt(result.total_generic)}
                                            </span>
                                            .
                                        </p>
                                        <p
                                            style={{
                                                color: "#10b981",
                                                fontSize: 36,
                                                fontWeight: 800,
                                                margin: "10px 0 4px",
                                                letterSpacing: "-1px",
                                            }}
                                        >
                                            {fmt(result.total_savings)}
                                        </p>
                                        <p
                                            style={{
                                                color: "#34d399",
                                                fontSize: 14,
                                                fontWeight: 600,
                                                margin: 0,
                                            }}
                                        >
                                            You could save this month 💚
                                            {overallPct > 0 && (
                                                <span
                                                    style={{
                                                        marginLeft: 8,
                                                        background: "rgba(16,185,129,0.15)",
                                                        border: "1px solid rgba(16,185,129,0.3)",
                                                        color: "#10b981",
                                                        fontSize: 12,
                                                        padding: "1px 8px",
                                                        borderRadius: 20,
                                                    }}
                                                >
                                                    {overallPct}% cheaper
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Medicine table */}
                                    <div style={{ margin: "14px 16px 0" }}>
                                        {/* Table header */}
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 72px 72px 64px",
                                                gap: 4,
                                                padding: "6px 10px",
                                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                                            }}
                                        >
                                            {["Medicine", "Branded", "Generic", "Saving"].map((h) => (
                                                <span
                                                    key={h}
                                                    style={{
                                                        color: "#475569",
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        textAlign: h !== "Medicine" ? "center" : "left",
                                                    }}
                                                >
                                                    {h}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Rows */}
                                        {result.rows.map((row, i) => {
                                            const hasSaving =
                                                row.saving != null && Number(row.saving) > 0;
                                            const pct =
                                                row.saving_pct != null
                                                    ? Math.round(row.saving_pct)
                                                    : null;
                                            return (
                                                <div
                                                    key={i}
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr 72px 72px 64px",
                                                        gap: 4,
                                                        padding: "10px 10px",
                                                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <div>
                                                        <p
                                                            style={{
                                                                color: "#e2e8f0",
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                margin: 0,
                                                                lineHeight: 1.3,
                                                            }}
                                                        >
                                                            {row.branded_name || row.medicine_input}
                                                        </p>
                                                        {!row.branded_name && (
                                                            <p
                                                                style={{
                                                                    color: "#475569",
                                                                    fontSize: 11,
                                                                    margin: "2px 0 0",
                                                                }}
                                                            >
                                                                Not in database
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p
                                                        style={{
                                                            color: "#f87171",
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            textAlign: "center",
                                                            margin: 0,
                                                        }}
                                                    >
                                                        {fmt(row.branded_mrp)}
                                                    </p>
                                                    <p
                                                        style={{
                                                            color: "#34d399",
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            textAlign: "center",
                                                            margin: 0,
                                                        }}
                                                    >
                                                        {fmt(row.generic_mrp)}
                                                    </p>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        {hasSaving && pct != null ? (
                                                            <span
                                                                style={{
                                                                    background: "rgba(16,185,129,0.12)",
                                                                    border: "1px solid rgba(16,185,129,0.25)",
                                                                    color: "#10b981",
                                                                    fontSize: 11,
                                                                    fontWeight: 700,
                                                                    padding: "2px 6px",
                                                                    borderRadius: 20,
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                {pct}%
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "#475569", fontSize: 13 }}>
                                                                —
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Stats footer */}
                                    {result.medicines_not_found > 0 && (
                                        <p
                                            style={{
                                                margin: "10px 16px 0",
                                                color: "#64748b",
                                                fontSize: 12,
                                            }}
                                        >
                                            ⚠ {result.medicines_not_found} medicine
                                            {result.medicines_not_found > 1 ? "s" : ""} not found in
                                            our database — savings may be higher in reality.
                                        </p>
                                    )}

                                    {/* Action buttons */}
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 10,
                                            padding: "14px 16px 16px",
                                        }}
                                    >
                                        <button
                                            onClick={handleShare}
                                            style={{
                                                ...shareBtnStyle,
                                                background:
                                                    shareStatus === "idle"
                                                        ? "linear-gradient(135deg, #059669, #10b981)"
                                                        : shareStatus === "copied"
                                                            ? "#1e3a2f"
                                                            : "#1e3a2f",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (shareStatus === "idle")
                                                    e.currentTarget.style.filter = "brightness(1.1)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.filter = "none";
                                            }}
                                        >
                                            {shareStatus === "idle"
                                                ? "📤 Share savings"
                                                : shareStatus === "copied"
                                                    ? "✓ Copied!"
                                                    : "✓ Shared!"}
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            style={secondaryBtnStyle}
                                            onMouseEnter={(e) =>
                                            (e.currentTarget.style.background =
                                                "rgba(255,255,255,0.11)")
                                            }
                                            onMouseLeave={(e) =>
                                            (e.currentTarget.style.background =
                                                "rgba(255,255,255,0.07)")
                                            }
                                        >
                                            🔄 Scan another
                                        </button>
                                    </div>

                                    <p
                                        style={{
                                            margin: "0 16px 14px",
                                            color: "#374151",
                                            fontSize: 11,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        For informational purposes only. Always consult your doctor
                                        or pharmacist before switching medicines.
                                    </p>
                                </div>
                            )}

                            {/* No results */}
                            {scanState === "no-results" && (
                                <div style={{ padding: "20px 16px" }}>
                                    <div
                                        style={{
                                            background: "rgba(251,191,36,0.08)",
                                            border: "1px solid rgba(251,191,36,0.2)",
                                            borderRadius: 12,
                                            padding: "14px 16px",
                                            marginBottom: 12,
                                            color: "#fbbf24",
                                            fontSize: 14,
                                            lineHeight: 1.6,
                                        }}
                                    >
                                        🔍 No medicines detected on this prescription.
                                        <br />
                                        <span style={{ color: "#64748b", fontSize: 12 }}>
                                            Try a clearer photo with good lighting. Printed
                                            prescriptions work better than handwritten ones.
                                        </span>
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

                            {/* Error */}
                            {scanState === "error" && (
                                <div style={{ padding: "20px 16px" }}>
                                    <div
                                        style={{
                                            background: "rgba(239,68,68,0.08)",
                                            border: "1px solid rgba(239,68,68,0.2)",
                                            borderRadius: 12,
                                            padding: "12px 16px",
                                            marginBottom: 12,
                                            color: "#fca5a5",
                                            fontSize: 12,
                                            lineHeight: 1.6,
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
                    )}

                    {/* ── Fixed Bottom Actions (Upload, etc.) ── */}
                    {(scanState === "camera" || scanState === "no-camera") && (
                        <div
                            style={{
                                flexShrink: 0,
                                padding: "14px 16px 16px",
                                background: "#0f0a1a",
                            }}
                        >
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{ ...uploadBtnStyle, width: "100%", justifyContent: "center" }}
                                onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                    "rgba(255,255,255,0.13)")
                                }
                                onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                    "rgba(255,255,255,0.07)")
                                }
                            >
                                <span style={{ fontSize: 18 }}>🖼️</span> Upload photo
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}

const closeBtnStyle: React.CSSProperties = {
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
};
const uploadBtnStyle: React.CSSProperties = {
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
};
const captureBtnStyle: React.CSSProperties = {
    flex: "0 0 auto",
    width: 68,
    height: 68,
    borderRadius: "50%",
    background: "#a855f7",
    border: "4px solid rgba(255,255,255,0.15)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    boxShadow: "0 0 0 2px #a855f7, 0 6px 20px rgba(168,85,247,0.4)",
    transition: "transform 0.1s",
};
const shareBtnStyle: React.CSSProperties = {
    flex: 1,
    height: 46,
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "filter 0.15s, background 0.3s",
};
const secondaryBtnStyle: React.CSSProperties = {
    flex: 1,
    height: 46,
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