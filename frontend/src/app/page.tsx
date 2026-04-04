"use client";

import { useState, useRef, lazy, Suspense, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform, AnimatePresence, useSpring } from "framer-motion";
import { 
  Search, 
  Scan, 
  FileText, 
  Plus, 
  Check, 
  X, 
  ChevronRight,
  Activity,
  Heart,
  TrendingDown,
  ShieldCheck,
  Package,
  ExternalLink,
  ClipboardCheck,
  FlaskConical,
  Dna,
  Stethoscope as StethoscopeIcon
} from "lucide-react";

const MedicineScanner = lazy(() => import("../components/MedicineScanner"));
const PrescriptionScanner = lazy(() => import("../components/PrescriptionScanner"));

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

// --- LogoHeader ---
// Cleaned up (no backdrop-blur) to ensure background elements like the bottle are visible.
const LogoHeader = () => (
  <header className="fixed top-0 left-0 w-full p-8 z-[60] flex items-center bg-transparent">
    <motion.a 
      href="/" 
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-3"
    >
      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
        <Heart className="w-7 h-7 text-white fill-white/10" strokeWidth={3} />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">PranavMeds</h1>
        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Drug Intelligence Solutions</p>
      </div>
    </motion.a>
  </header>
);

// --- Fixed Stethoscope Decor ---
const StethoscopeDecor = () => {
    const eyeX = useSpring(0, { damping: 10, stiffness: 40 });
    const eyeY = useSpring(0, { damping: 10, stiffness: 40 });

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            const { innerWidth, innerHeight } = window;
            const x = (e.clientX - innerWidth + 100) / 100;
            const y = (e.clientY - innerHeight + 100) / 100;
            eyeX.set(Math.max(-4, Math.min(4, x * 4)));
            eyeY.set(Math.max(-4, Math.min(4, y * 4)));
        };
        window.addEventListener("mousemove", handleMove);
        return () => window.removeEventListener("mousemove", handleMove);
    }, [eyeX, eyeY]);

    return (
        <div className="fixed bottom-12 right-12 z-[1] pointer-events-none opacity-50 hover:opacity-100 transition-opacity hidden lg:block">
            <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="relative">
                 <svg width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 hover:text-blue-600 transition-colors drop-shadow-2xl">
                    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.3.3 0 1 0 .2.3" />
                    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" strokeWidth="1.8" />
                    <circle cx="20" cy="10" r="2.2" />
                </svg>
                <div className="absolute top-[40%] right-[32.5%] flex gap-2">
                    <div className="w-6 h-6 bg-white rounded-full border-2 border-slate-200 flex items-center justify-center shadow-sm">
                        <motion.div style={{ x: eyeX, y: eyeY }} className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                    </div>
                    <div className="w-6 h-6 bg-white rounded-full border-2 border-slate-200 flex items-center justify-center shadow-sm">
                        <motion.div style={{ x: eyeX, y: eyeY }} className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- SmartSearchCursor ---
const SmartSearchCursor = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [targetType, setTargetType] = useState<"default" | "search" | "action">("default");

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      const target = e.target as HTMLElement;
      if (target.closest("input")) setTargetType("search");
      else if (target.closest("button, a")) setTargetType("action");
      else setTargetType("default");
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999] hidden lg:flex items-center justify-center rounded-full"
      animate={{
        x: mousePos.x - (targetType === "search" ? 22 : 8),
        y: mousePos.y - (targetType === "search" ? 22 : 8),
        width: targetType === "search" ? 44 : 16,
        height: targetType === "search" ? 44 : 16,
        backgroundColor: targetType === "search" ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 1)",
        borderColor: targetType === "search" ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.1)",
        borderWidth: targetType === "search" ? 2 : 4,
        scale: [1, 1.35, 1], 
      }}
      transition={{ scale: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
        width: { type: "spring", damping: 20, stiffness: 300 },
        height: { type: "spring", damping: 20, stiffness: 300 },
        x: { type: "tweeen" }, y: { type: "tween" }
      }}
    >
      <AnimatePresence mode="wait">
        {targetType === "search" && (
          <motion.div key="search-icon" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
            <Search className="w-5 h-5 text-blue-600" strokeWidth={4} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Top-Right Medicine Bottle & Varied Pill Drop ---
const PillDropAnimation = () => {
    const { scrollYProgress } = useScroll();
    
    // Bottle Tilting aggressively (Top-Right position)
    const tilt = useTransform(scrollYProgress, [0, 0.3], [0, -110]);
    const xPos = useTransform(scrollYProgress, [0, 0.3], ["92%", "88%"]);

    // Multiple pill types falling
    const pill1Y = useTransform(scrollYProgress, [0.05, 1], [-100, 2400]);
    const pill2Y = useTransform(scrollYProgress, [0.15, 1], [-120, 2200]);
    const pill3Y = useTransform(scrollYProgress, [0.25, 1], [-80, 2600]);
    const pill4Y = useTransform(scrollYProgress, [0.35, 1], [-150, 2000]);
    const pillRotate = useTransform(scrollYProgress, [0, 1], [0, 1440]);

    const pills = useMemo(() => [
        { y: pill1Y, left: "90%", type: "capsule", primary: "#ef4444", secondary: "#ffffff" }, // Red/White Capsule
        { y: pill2Y, left: "86%", type: "tablet", primary: "#60a5fa", secondary: "" },       // Blue Tablet
        { y: pill3Y, left: "93%", type: "capsule", primary: "#3b82f6", secondary: "#ffffff" }, // Blue/White Capsule
        { y: pill4Y, left: "88%", type: "tablet", primary: "#facc15", secondary: "" },       // Yellow Tablet
    ], [pill1Y, pill2Y, pill3Y, pill4Y]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[10] overflow-hidden">
            {/* The Medicine Bottle (Blue body, Orange cap, White Cross) */}
            <motion.div style={{ rotate: tilt, left: xPos, x: "-50%" }} className="absolute top-4 w-44 h-56 flex flex-col items-center">
                {/* Orange Cap */}
                <div className="w-24 h-8 bg-orange-500 rounded-t-xl border-b-2 border-orange-600 shadow-xl" />
                {/* Blue Body */}
                <div className="w-36 h-48 bg-blue-600 rounded-b-3xl flex flex-col items-center justify-center shadow-2xl relative">
                    <div className="px-4 py-3 bg-white/10 rounded-xl mb-4 border border-white/20">
                         <Plus className="w-12 h-12 text-white" strokeWidth={4} />
                    </div>
                </div>
            </motion.div>

            {/* Varied Falling Pills */}
            {pills.map((pill, i) => (
                <motion.div
                    key={i}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: pill.left,
                        y: pill.y,
                        rotate: pillRotate,
                        width: pill.type === "capsule" ? 40 : 50,
                        height: pill.type === "capsule" ? 90 : 55,
                        borderRadius: pill.type === "capsule" ? 100 : 100,
                        backgroundColor: pill.primary,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    }}
                    className="opacity-100 border-2 border-white/50"
                >
                    {pill.type === "capsule" && (
                        <div 
                          className="w-full h-1/2 absolute bottom-0 rounded-b-full border-t border-black/10" 
                          style={{ backgroundColor: pill.secondary }} 
                        />
                    )}
                </motion.div>
            ))}
        </div>
    );
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<DrugResult[]>([]);
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [showScanner, setShowScanner] = useState(false);
  const [showPrescriptionScanner, setShowPrescriptionScanner] = useState(false);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setRequestStatus("idle");
    setShowRequestPanel(false);
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: debouncedQuery || query }),
      });
    } catch { } setRequestStatus("sent");
  };

  return (
    <main className="min-h-screen bg-white text-slate-900 flex flex-col items-center px-4 py-40 relative">
      <LogoHeader />
      <StethoscopeDecor />
      <SmartSearchCursor />
      <PillDropAnimation />

      {/* Hero Section */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16 z-[20]">
        <div className="inline-flex items-center gap-3 mb-10 px-6 py-2.5 rounded-full bg-blue-50 border border-blue-100 shadow-sm">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <span className="text-xs font-black tracking-widest uppercase text-blue-700">PranavMeds Verification Engine</span>
        </div>
        <h2 className="text-[100px] font-black tracking-tighter mb-10 text-slate-900 leading-[0.9] drop-shadow-sm">
           Compare Ingredients. <br />
           <span className="text-blue-600">Find Cheaper Meds.</span>
        </h2>
        <p className="text-slate-500 text-2xl max-w-2xl mx-auto leading-relaxed font-bold">
           Check if safe to substitute your medicine based on chemical components.
           <span className="block text-slate-400 text-lg mt-3 font-semibold">Save money instantly on verified equivalents.</span>
        </p>
      </motion.div>

      {/* Main Search Action */}
      <div className="w-full max-w-2xl mb-24 relative z-[20]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
          <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 flex items-center p-3 shadow-3xl shadow-blue-500/5 focus-within:border-blue-600 focus-within:shadow-[0_0_0_12px_rgba(59,130,246,0.08)] transition-all">
            <div className="pl-6"><Search className="w-10 h-10 text-slate-200" strokeWidth={3} /></div>
            <input type="text" value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Type drug name here..." className="w-full bg-transparent border-none px-6 py-7 text-slate-900 placeholder-slate-200 focus:outline-none text-3xl font-black tracking-tight" />
            <div className="pr-6">
              <AnimatePresence>{isFetching && <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />}</AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Clinical Tools Navigation */}
      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8 mb-40 z-[20]">
        <motion.button whileHover={{ y: -10 }} whileTap={{ scale: 0.98 }} onClick={() => setShowPrescriptionScanner(true)} className="col-span-1 md:col-span-2 bg-white rounded-[3rem] p-12 text-left border border-slate-100 relative overflow-hidden group shadow-xl shadow-slate-200/50">
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-50 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform duration-700" />
          <div className="relative z-10 flex items-center gap-10">
            <div className="w-24 h-24 rounded-[1.75rem] bg-purple-600 flex items-center justify-center text-white shadow-2xl shadow-purple-600/30"><ClipboardCheck className="w-12 h-12" /></div>
            <div className="flex-1">
              <h3 className="font-black text-3xl text-slate-900 tracking-tight">Scan Prescription</h3>
              <p className="text-slate-500 text-lg mt-2 font-bold leading-relaxed max-w-sm">Analyze every clinical ingredient on your physician&apos;s slip for safety and compare for best prices.</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-purple-600 group-hover:text-white transition-all"><ChevronRight className="w-8 h-8" /></div>
          </div>
        </motion.button>

        <motion.button whileHover={{ y: -10 }} whileTap={{ scale: 0.98 }} onClick={() => setShowScanner(true)} className="bg-white rounded-[3rem] p-10 text-left border border-slate-100 group shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-7 mb-8"><div className="w-18 h-18 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-600/20"><FlaskConical className="w-10 h-10" /></div><h3 className="font-black text-2xl text-slate-900 tracking-tight">Identify Box</h3></div>
          <p className="text-slate-500 text-base font-bold leading-relaxed">Instant deep-scan of medicine components using PranavMeds original tech.</p>
        </motion.button>

        <motion.button whileHover={{ y: -10 }} whileTap={{ scale: 0.98 }} onClick={() => setShowRequestPanel((prev) => !prev)} className="bg-white rounded-[3rem] p-10 text-left border border-slate-100 group shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-7 mb-8"><div className="w-18 h-18 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-2xl shadow-slate-900/20"><Dna className="w-10 h-10" /></div><h3 className="font-black text-2xl text-slate-900 tracking-tight">Request Entry</h3></div>
          <p className="text-slate-500 text-base font-bold leading-relaxed">Missing a drug? Submit its name and we will retrieve it from jan aushadi registry.</p>
        </motion.button>
      </div>

      {/* Search Results Display */}
      <div className="w-full max-w-2xl flex flex-col gap-8 z-[20] pb-40">
        <AnimatePresence mode="popLayout">
          {results.map((drug, index) => (
            <motion.div layout key={drug.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} onClick={() => toggleSelect(drug)} className={`bg-white rounded-[3.5rem] p-12 border-2 transition-all relative overflow-hidden shadow-2xl shadow-slate-100 ${isSelected(drug) ? "border-blue-600 ring-[12px] ring-blue-600/5 bg-blue-50/10" : "border-slate-50"}`}>
               <div className="flex items-center gap-12">
                <div className="w-36 h-36 bg-slate-50 rounded-[2.5rem] shrink-0 flex items-center justify-center border border-slate-100 p-6">{drug.image_url ? (<img src={drug.image_url} alt={drug.brand_name} className="w-full h-full object-contain" />) : (<div className="text-slate-200"><FlaskConical className="w-14 h-14" /></div>)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div><h3 className="font-black text-4xl text-slate-900 tracking-tighter mb-2 leading-none uppercase truncate">{drug.brand_name}</h3><p className="text-blue-600 text-sm font-black uppercase tracking-[0.3em]">{drug.manufacturer || "Registry Laboratory"}</p></div>
                    {drug.mrp && <div className="text-right"><span className="text-5xl font-black text-emerald-600">₹{drug.mrp}</span><p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] mt-2">Retail List</p></div>}
                  </div>
                  <div className="mt-10 pt-10 border-t-2 border-slate-50 flex items-center gap-8"><button onClick={(e) => { e.stopPropagation(); window.location.href=`/drug?id=${drug.id}`; }} className="text-slate-400 hover:text-slate-900 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 transition-all">View Specs <ExternalLink className="w-4 h-4" /></button>{isSelected(drug) && <div className="bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] px-6 py-2.5 rounded-full flex items-center gap-3 shadow-xl shadow-blue-500/30"><Check className="w-5 h-5" strokeWidth={4} /> Match Validated</div>}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Comparison Drawer */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-10 z-[80]">
            <div className="bg-slate-900 shadow-4xl rounded-full p-3 pl-12 flex items-center justify-between border border-white/10 ring-8 ring-white/10">
              <div className="flex items-center gap-8 overflow-hidden"><span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Clinical Scan Of</span><div className="flex gap-3">{selected.map((drug) => (<div key={drug.id} className="bg-white/10 px-5 py-2.5 rounded-full text-white text-[11px] font-black flex items-center gap-4 transition-all">{drug.brand_name}<button onClick={() => toggleSelect(drug)} className="hover:text-red-500 active:scale-95 transition-all"><X className="w-5 h-5" /></button></div>))}</div></div>
              <button disabled={selected.length < 2} onClick={handleCompare} className={`ml-10 px-14 py-5 rounded-full font-black text-sm uppercase tracking-[0.3em] transition-all ${selected.length === 2 ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-2xl shadow-blue-600/40' : 'bg-white/5 text-slate-800'}`}>Compare Safety</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="w-full max-w-2xl text-center py-32 z-[20] mt-20 opacity-80">
        <div className="flex flex-col items-center gap-6">
             <div className="w-20 h-1.5 bg-blue-600 rounded-full mb-4" />
             <p className="text-slate-900 font-extrabold text-2xl tracking-tighter">PRANAVMEDS ORIGINAL</p>
             <p className="text-slate-400 text-xs font-black uppercase tracking-[0.8em]">MADE BY <span className="text-blue-600 underline underline-offset-8 decoration-[4px]">PRANAV</span> WITH 💚</p>
        </div>
      </footer>

      {/* Interactive Overlays */}
      <AnimatePresence>
        {showScanner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-white p-6">
              <div className="w-full h-full max-w-5xl relative bg-white rounded-[4rem] border-2 border-slate-100 shadow-4xl overflow-hidden">
                  <div className="absolute top-8 right-8 z-[110] flex items-center gap-4">
                      <button onClick={() => setShowScanner(false)} className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-xl"><X className="w-8 h-8" /></button>
                  </div>
                  <Suspense fallback={<div className="flex flex-col items-center justify-center h-full gap-4 text-blue-600 animate-pulse"><FlaskConical className="w-16 h-16" /><span className="font-black text-xs uppercase tracking-widest">Booting Clinical Sensors...</span></div>}>
                    <MedicineScanner onResult={(n) => handleQueryChange(n)} onClose={() => setShowScanner(false)} />
                  </Suspense>
              </div>
          </motion.div>
        )}

        {showPrescriptionScanner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-white/10 backdrop-blur-3xl p-6 md:p-12">
              <div className="w-full h-full max-w-6xl relative bg-white rounded-[4.5rem] border-2 border-slate-100 shadow-4xl overflow-hidden">
                <div className="w-full h-full overflow-auto no-scrollbar">
                    <Suspense fallback={<div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 animate-pulse"><ClipboardCheck className="w-16 h-16" /><span className="font-black text-xs uppercase tracking-widest">Generating Original Pranav Report...</span></div>}>
                      <PrescriptionScanner onClose={() => setShowPrescriptionScanner(false)} />
                    </Suspense>
                </div>
              </div>
          </motion.div>
        )}

        {showRequestPanel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-xl p-8">
            <div className="bg-white rounded-[4rem] border-4 border-slate-100 p-20 shadow-4xl max-w-2xl w-full text-center relative overflow-hidden">
               <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mb-12 mx-auto shadow-4xl shadow-blue-600/20"><TrendingDown className="w-12 h-12" /></div>
               <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-6">Request Registry Entry</h2>
               <p className="text-slate-500 text-xl font-bold mb-16 leading-relaxed">If it is missing, Pranav will manually cross-verify ingredients for you.</p>

               {requestStatus !== "sent" ? <div className="flex flex-col gap-6">
                  <input type="text" value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Type drug name here..." className="w-full bg-slate-50 border-4 border-slate-100 rounded-[2rem] px-12 py-10 text-3xl font-black text-slate-900 outline-none focus:border-blue-600 transition-all shadow-inner" />
                  <div className="flex gap-6 mt-4">
                     <button onClick={() => setShowRequestPanel(false)} className="flex-1 py-7 bg-slate-100 rounded-[1.75rem] font-black text-slate-500 hover:bg-slate-200 transition-all text-sm uppercase tracking-widest">Dismiss</button>
                     <button onClick={handleRequestMissing} disabled={!query.trim()} className="flex-[2] py-7 bg-blue-600 rounded-[1.75rem] font-black text-white hover:bg-blue-500 disabled:opacity-30 transition-all shadow-4xl shadow-blue-500/20 text-sm uppercase tracking-widest">Submit Request</button>
                  </div>
               </div> : <div className="bg-emerald-50 border-4 border-emerald-100 rounded-[3rem] p-12 text-green-800"><Check className="w-20 h-20 text-green-500 mx-auto mb-8" strokeWidth={5} /><h4 className="text-4xl font-black tracking-tighter">Request Received</h4><p className="text-lg font-bold mt-4 uppercase">PRANAV IS REVIEWING YOUR REQUEST.</p></div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
