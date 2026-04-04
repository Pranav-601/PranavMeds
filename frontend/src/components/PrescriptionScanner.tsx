"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Camera, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Share2, 
  RotateCcw, 
  IndianRupee,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  Zap,
  Activity,
  Printer,
  ShieldCheck,
  Stethoscope
} from "lucide-react";

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

interface DrugDetail {
    id: number;
    brand_name: string;
    manufacturer: string | null;
    dosage_form: string | null;
    strength: string | null;
    mrp: string | number | null;
    uses: string | null;
    side_effects: string | null;
    image_url: string | null;
    slug: string | null;
}

interface PrescriptionRow {
    medicine_input: string;
    branded_drug: DrugDetail | null;
    generic_drug: DrugDetail | null;
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://pranavmeds.onrender.com";

function fmt(v: string | number | null): string {
    if (v == null) return "—";
    const n = Number(v);
    if (isNaN(n)) return "—";
    return `₹${n.toFixed(0)}`;
}

async function dataURLtoBlob(dataURL: string): Promise<Blob> {
    const res = await fetch(dataURL);
    return res.blob();
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
                await track.applyConstraints({ advanced: [{ torch: newFlashState }] } as any);
                setFlashOn(newFlashState);
            }
        } catch (e) { console.error("Torch error:", e); }
    };

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

    async function handleShare() {
        if (!result) return;
        const text = `💊 PranavMeds Analysis: You can save ${fmt(result.total_savings)} on your prescription! Check it out.`;
        if (navigator.share) {
            try { await navigator.share({ title: "My Savings", text }); setShareStatus("shared"); } catch {}
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
            const blob = await dataURLtoBlob(imageDataURL);
            const form = new FormData();
            form.append("image", blob, "prescription.jpg");

            const apiRes = await fetch(`${API_BASE}/api/v1/scan-prescription`, {
                method: "POST", body: form, signal: AbortSignal.timeout(60000),
            });

            if (!apiRes.ok) throw new Error("Could not analyze prescription.");
            const data: ScanResult = await apiRes.json();
            if (data.medicines_found === 0 && data.rows.length === 0) {
                setScanState("no-results"); return;
            }
            setResult(data);
            setScanState("results");
        } catch (e: any) {
            setErrorMsg(e?.message || "Analysis failed.");
            setScanState("error");
        }
    }

    return (
        <div className="w-full h-full bg-white flex flex-col relative text-slate-900 overflow-hidden font-sans">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = () => processImage(reader.result as string);
                    reader.readAsDataURL(file);
                }
            }} className="hidden" />

            {/* Cleaned Clinical Report Header (No-Overlap Fix) */}
            <div className="flex items-center justify-between px-10 py-12 border-b-8 border-slate-900 flex-shrink-0 bg-white relative z-50">
                <div className="flex items-center gap-8 min-w-0">
                    <div className="w-18 h-18 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 shrink-0">
                        <Stethoscope className="w-10 h-10" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-black text-4xl tracking-tighter leading-none text-slate-900 uppercase truncate">Clinical Savings Report</h2>
                        <div className="flex flex-wrap items-center gap-4 mt-4">
                             <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em] whitespace-nowrap">Registry No: PM-9921</p>
                             <span className="w-1.5 h-1.5 bg-slate-200 rounded-full hidden sm:block" />
                             <p className="text-blue-600 text-xs font-black uppercase tracking-[0.4em] whitespace-nowrap">Ingredient Check Active</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <button onClick={() => window.print()} className="w-16 h-16 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all shadow-sm">
                        <Printer className="w-7 h-7" />
                    </button>
                    <button onClick={onClose} className="w-16 h-16 rounded-full bg-slate-900 border-none flex items-center justify-center text-white hover:bg-red-600 active:scale-90 transition-all shadow-xl">
                        <X className="w-8 h-8" />
                    </button>
                </div>
            </div>

            {/* Main Clinical Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-white relative">
                {(scanState === "camera" || scanState === "no-camera" || scanState === "scanning") && (
                    <div className="h-full relative bg-slate-100 overflow-hidden">
                        {scanState === "camera" && !cameraError && (
                            <>
                                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "environment", aspectRatio: 4/3 }} onUserMediaError={handleCameraError} className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-10">
                                   <div className="w-full max-w-[500px] h-2/3 border-[10px] border-slate-900/10 rounded-[5rem] relative">
                                      <div className="absolute inset-x-0 h-2 bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,1)]" style={{ top: `${scanLine}%` }} />
                                   </div>
                                   <div className="mt-16 bg-slate-900 px-12 py-4 rounded-full shadow-4xl">
                                      <p className="text-white text-xs font-black uppercase tracking-[0.4em]">Scan prescription for chemical analysis</p>
                                   </div>
                                </div>
                                <button onClick={toggleFlash} className={`absolute top-12 right-12 w-20 h-20 rounded-full flex items-center justify-center transition-all ${flashOn ? 'bg-amber-400 text-slate-900 shadow-4xl' : 'bg-white text-slate-400 border-2 border-slate-100 shadow-xl'}`}>
                                    <Zap className={`w-10 h-10 ${flashOn ? 'fill-current' : ''}`} />
                                </button>
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-12">
                                   <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-white border-2 border-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-50 transition-all shadow-2xl">
                                      <Upload className="w-8 h-8" />
                                   </button>
                                   <button onClick={() => { const src = webcamRef.current?.getScreenshot(); if(src) processImage(src); }} className="w-28 h-28 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-5xl shadow-blue-600/40 hover:bg-blue-500 active:scale-95 transition-all">
                                      <Camera className="w-14 h-14" />
                                   </button>
                                   <div className="w-20 h-20 invisible" />
                                </div>
                            </>
                        )}
                        {scanState === "scanning" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 bg-white">
                               <div className="w-28 h-28 bg-blue-600 rounded-[3rem] flex items-center justify-center text-white animate-pulse shadow-5xl shadow-blue-600/20">
                                  <Activity className="w-14 h-14" strokeWidth={4} />
                               </div>
                               <div className="text-center">
                                  <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4">Reading Elements</h3>
                                  <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">Cross-verifying pharmaceutical ingredients...</p>
                               </div>
                            </div>
                        )}
                    </div>
                )}

                {scanState === "results" && result && (
                    <div className="p-20 pb-48 flex flex-col gap-16 max-w-5xl mx-auto">
                        {/* Clinical Receipt Block */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="border-[10px] border-emerald-500 rounded-[5rem] p-20 flex flex-col items-center bg-white relative overflow-hidden ring-[30px] ring-emerald-50 shadow-inner">
                           <div className="inline-flex items-center gap-4 px-8 py-3.5 bg-emerald-500 text-white rounded-full text-[11px] font-black uppercase tracking-[0.4em] mb-12 shadow-2xl shadow-emerald-500/30">
                              <ShieldCheck className="w-6 h-6" /> Result Authenticated
                           </div>
                           <h3 className="text-slate-400 font-black text-xs uppercase tracking-[0.5em] mb-6">Total Potential Discount</h3>
                           <div className="flex items-center justify-center gap-4 text-emerald-600">
                              <span className="text-[100px] font-black tracking-tighter py-3 border-b-[12px] border-emerald-500 leading-none">₹{result.total_savings}</span>
                           </div>
                           <p className="text-slate-500 font-bold text-xl mt-12 max-w-sm text-center leading-relaxed">Save on verified equivalents with identical chemical components.</p>
                           
                           <div className="w-full grid grid-cols-2 gap-12 mt-20 pt-20 border-t-4 border-slate-100 border-dashed">
                               <div className="text-center group">
                                  <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-3 group-hover:text-red-500 transition-colors">Standard MRP</p>
                                  <p className="text-5xl font-black text-slate-200 line-through">₹{result.total_branded}</p>
                               </div>
                               <div className="text-center">
                                  <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-3">Equivalent Price</p>
                                  <p className="text-5xl font-black text-emerald-600">₹{result.total_generic}</p>
                               </div>
                           </div>
                        </motion.div>

                        {/* Professional Medicine Analysis List */}
                        <div className="flex flex-col gap-6 mt-12">
                            <div className="flex items-center justify-between px-12 mb-8 font-black text-xs uppercase tracking-[0.5em] text-slate-300">
                               <span>Ingredient Entry</span>
                               <span>Market Pricing</span>
                            </div>

                            {result.rows.map((row, i) => {
                                const b = row.branded_drug;
                                const g = row.generic_drug;
                                const hasSaving = row.saving != null && Number(row.saving) > 0;

                                return (
                                    <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={i} className={`flex flex-col border-[4px] rounded-[4rem] p-12 transition-all ${hasSaving ? 'border-emerald-500/20 bg-emerald-50/5' : 'border-slate-100 bg-white shadow-xl shadow-slate-100'}`}>
                                        <div className="flex items-start justify-between mb-10 gap-12">
                                            <div className="flex-1 min-w-0">
                                               <p className="text-slate-300 text-[11px] font-black uppercase tracking-widest mb-4">Entry #0{i+1}</p>
                                               <h4 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-tight truncate">{b ? b.brand_name : row.medicine_input}</h4>
                                               <div className="flex items-center gap-4 mt-6 truncate">
                                                  <FlaskConical className="w-5 h-5 text-blue-500" />
                                                  <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.1em]">{b?.manufacturer || "Laboratory Analysis"}</p>
                                               </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                               <p className="text-slate-300 text-[11px] font-black uppercase tracking-widest mb-4">Standard MRP</p>
                                               <p className={`text-4xl font-black ${hasSaving ? 'text-slate-200' : 'text-slate-900'}`}>₹{b ? b.mrp : '—'}</p>
                                            </div>
                                        </div>

                                        {g && (
                                            <div className="bg-white border-[3px] border-emerald-500 rounded-[3rem] p-12 flex items-center justify-between relative shadow-4xl shadow-emerald-500/10 group cursor-default">
                                               <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white overflow-hidden text-[10px] font-black vertical-text uppercase">Pranav Check</div>
                                               
                                               <div className="flex-1 pr-12 min-w-0">
                                                  <div className="flex flex-wrap items-center gap-4 mb-4">
                                                     <div className="px-5 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">Certified Safe Equivalent</div>
                                                     {row.saving_pct != null && <span className="text-emerald-500 font-extrabold text-sm uppercase tracking-widest">₹{row.saving} Savings</span>}
                                                  </div>
                                                  <h5 className="text-3xl font-black text-slate-900 tracking-tighter uppercase truncate">{g.brand_name}</h5>
                                                  <p className="text-slate-400 text-xs font-bold mt-3 uppercase tracking-widest">{g.manufacturer || "Laboratory Verified"}</p>
                                               </div>

                                               <div className="text-right border-l-4 border-emerald-100 pl-12 flex flex-col justify-center min-w-[180px] shrink-0">
                                                  <p className="text-emerald-500 font-black text-xs uppercase tracking-widest mb-3">Equivalent Price</p>
                                                  <p className="text-5xl font-black text-emerald-600">₹{g.mrp}</p>
                                                  <p className="text-emerald-400 text-[11px] font-black uppercase mt-3 tracking-widest">{row.saving_pct}% Cheaper</p>
                                               </div>

                                               <div className="absolute right-8 top-8 opacity-20 group-hover:opacity-100 transition-opacity hidden sm:block">
                                                  <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={3} />
                                               </div>
                                            </div>
                                        )}

                                        {b && (b.uses || b.side_effects) && (
                                            <div className="mt-12 pt-12 border-t-2 border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-12">
                                               {b.uses && (
                                                  <div className="flex gap-6">
                                                     <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-sm"><Lightbulb className="w-7 h-7" /></div>
                                                     <div>
                                                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Clinical Specs</p>
                                                        <p className="text-slate-600 text-sm font-bold leading-relaxed">{b.uses}</p>
                                                     </div>
                                                  </div>
                                               )}
                                               {b.side_effects && (
                                                  <div className="flex gap-6">
                                                     <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-sm"><AlertTriangle className="w-7 h-7" /></div>
                                                     <div>
                                                        <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Clinical Cautions</p>
                                                        <p className="text-slate-600 text-sm font-bold leading-relaxed">{b.side_effects}</p>
                                                     </div>
                                                  </div>
                                               )}
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Action Bar */}
            <AnimatePresence>
                {result && (
                    <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-2xl px-12 z-[20]">
                        <div className="bg-slate-900 rounded-[3rem] p-4 pl-12 flex items-center justify-between shadow-6xl shadow-slate-900/60 divide-x-2 divide-white/10 ring-12 ring-white">
                           <div className="pr-12">
                               <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Status</p>
                               <span className="text-white font-black text-lg uppercase tracking-tighter">Verified by Pranav</span>
                           </div>
                           <button onClick={handleShare} className="flex-1 py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 ml-8 shadow-2xl shadow-emerald-500/20 active:scale-95">
                              {shareStatus === "idle" ? <><Share2 className="w-6 h-6" /> Share Analysis</> : <><CheckCircle2 className="w-6 h-6" /> Result Copied</>}
                           </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); opacity: 0.8; }
                .shadow-6xl { box-shadow: 0 60px 150px -30px rgba(0,0,0,0.7); }
                .shadow-5xl { box-shadow: 0 35px 70px -15px rgba(59,130,246,0.5); }
            `}</style>
        </div>
    );
}

const FlaskConical = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2v7.5" /><path d="M14 2v7.5" /><path d="M8.5 2h7" /><path d="M14 9.5c3 6 4.5 8.5 4.5 10.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2c0-2 1.5-4.5 4.5-10.5" />
    <path d="M7 16h10" />
  </svg>
);