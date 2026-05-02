"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Finding {
  file: string; line: number; column: number; match_preview: string;
  pattern_name: string; entropy: number; classification: string;
  reason: string; rotate_immediately: boolean;
}
interface Report {
  repo_url: string; scanned_files: number; total_findings: number;
  real_secrets: number; false_positives: number; needs_review: number;
  exposure_risk: string; analyzed_at: string; env_example: string;
  remediation_checklist: string; findings: Finding[];
}

const STEPS = [
  { icon: "🔍", text: "Cloning repository..." },
  { icon: "⚡", text: "Running parallel scanners..." },
  { icon: "🧠", text: "AI classifying findings..." },
  { icon: "📝", text: "Generating .env.example..." },
  { icon: "✅", text: "Building remediation plan..." },
];

const RISK_CFG: Record<string,{border:string;bg:string;text:string;msg:string}> = {
  CRITICAL: { border:"border-red-500 animate-pulse", bg:"bg-red-500/10", text:"text-red-400", msg:"⚠️ CRITICAL: Rotate exposed credentials immediately" },
  HIGH: { border:"border-orange-500", bg:"bg-orange-500/10", text:"text-orange-400", msg:"⚠️ HIGH RISK: Secrets detected — action required" },
  MEDIUM: { border:"border-yellow-500", bg:"bg-yellow-500/10", text:"text-yellow-400", msg:"⚡ MEDIUM: Some findings need review" },
  LOW: { border:"border-emerald-500", bg:"bg-emerald-500/10", text:"text-emerald-400", msg:"✅ No critical secrets found" },
};

const CLS_CFG: Record<string,{dot:string;color:string;label:string}> = {
  REAL_SECRET: { dot:"bg-red-500", color:"text-red-400", label:"Real Secret" },
  NEEDS_REVIEW: { dot:"bg-yellow-500", color:"text-yellow-400", label:"Needs Review" },
  FALSE_POSITIVE: { dot:"bg-emerald-500", color:"text-emerald-400", label:"False Positive" },
};

const BADGE_COLORS: Record<string,string> = {
  aws_access_key:"bg-orange-500/15 text-orange-400 ring-orange-500/30",
  aws_secret_key:"bg-orange-500/15 text-orange-400 ring-orange-500/30",
  github_token:"bg-purple-500/15 text-purple-400 ring-purple-500/30",
  openai_key:"bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  stripe_key:"bg-violet-500/15 text-violet-400 ring-violet-500/30",
  google_api_key:"bg-blue-500/15 text-blue-400 ring-blue-500/30",
  jwt_secret:"bg-cyan-500/15 text-cyan-400 ring-cyan-500/30",
  private_key_block:"bg-red-500/15 text-red-400 ring-red-500/30",
  hardcoded_password:"bg-red-500/15 text-red-400 ring-red-500/30",
  hardcoded_token:"bg-amber-500/15 text-amber-400 ring-amber-500/30",
  db_connection:"bg-pink-500/15 text-pink-400 ring-pink-500/30",
  high_entropy:"bg-slate-500/15 text-slate-400 ring-slate-500/30",
};

function redact(s: string) { return s.length > 6 ? s.slice(0,6) + "••••••" : "••••••"; }

function AnimatedCounter({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let cur = 0;
    const step = Math.max(1, Math.floor(target / 20));
    const iv = setInterval(() => { cur = Math.min(cur + step, target); setVal(cur); if (cur >= target) clearInterval(iv); }, 40);
    return () => clearInterval(iv);
  }, [target]);
  return <>{val}</>;
}

function LoadingView({ step }: { step: number }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
        <div className="absolute inset-0 rounded-full border-2 border-t-slate-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-2 rounded-full border border-slate-700/50 border-t-slate-600 animate-spin" style={{ animationDuration:"1.5s", animationDirection:"reverse" }} />
      </div>
      <div className="w-full space-y-2">
        {STEPS.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${i === step ? "bg-slate-800/60 text-slate-200" : i < step ? "text-slate-600" : "text-slate-700"}`}>
            <span className="text-base w-5 text-center">{s.icon}</span>
            <span className="text-sm font-medium">{s.text}</span>
            {i < step && <svg className="w-3.5 h-3.5 text-emerald-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            {i === step && <span className="ml-auto flex gap-0.5">{[0,1,2].map(d=><span key={d} className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:`${d*150}ms`}}/>)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingRow({ f, idx }: { f: Finding; idx: number }) {
  const [open, setOpen] = useState(false);
  const cls = CLS_CFG[f.classification] || CLS_CFG.NEEDS_REVIEW;
  const badge = BADGE_COLORS[f.pattern_name] || BADGE_COLORS.high_entropy;
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay:`${idx*50}ms`, animationFillMode:"both" }}>
      <button onClick={() => setOpen(v => !v)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 hover:bg-slate-800/60 text-left ${open ? "bg-slate-800/40" : ""}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
        <span className="font-mono text-xs text-slate-300 min-w-0 truncate flex-1">{f.file}<span className="text-slate-600">:{f.line}</span></span>
        <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${badge}`}>{f.pattern_name.replace(/_/g," ")}</span>
        <span className="text-[10px] text-slate-500 font-mono hidden md:block">H={f.entropy.toFixed(1)}</span>
        <code className="text-xs text-slate-500 font-mono hidden lg:block">{redact(f.match_preview)}</code>
        <svg className={`w-3 h-3 text-slate-500 transition-transform ${open?"rotate-90":""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>
      {open && (
        <div className="px-4 pb-3 ml-5 border-l border-slate-700/60 pl-4 space-y-2 animate-in fade-in duration-200">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`font-semibold ${cls.color}`}>{cls.label}</span>
            {f.rotate_immediately && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">ROTATE NOW</span>}
          </div>
          <p className="text-xs text-slate-400">{f.reason}</p>
          <div className="text-[11px] text-slate-500 font-mono">Entropy: {f.entropy.toFixed(3)} · Column: {f.column}</div>
        </div>
      )}
    </div>
  );
}

function ReportView({ report, onReset }: { report: Report; onReset: () => void }) {
  const [tab, setTab] = useState<"env"|"remediation">("env");
  const [copied, setCopied] = useState(false);
  const [checks, setChecks] = useState<Set<number>>(new Set());
  const risk = RISK_CFG[report.exposure_risk] || RISK_CFG.LOW;

  const sorted = [...report.findings].sort((a, b) => {
    const o = ["REAL_SECRET","NEEDS_REVIEW","FALSE_POSITIVE"];
    return o.indexOf(a.classification) - o.indexOf(b.classification);
  });

  const copy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const download = () => { const b = new Blob([report.env_example], { type:"text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = ".env.example"; a.click(); URL.revokeObjectURL(u); };
  const toggleCheck = (i: number) => { const s = new Set(checks); s.has(i) ? s.delete(i) : s.add(i); setChecks(s); };
  const remLines = report.remediation_checklist.split("\n").filter(l => l.trim());

  return (
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-[#080c12]/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onReset} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            New Scan
          </button>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/><AnimatedCounter target={report.real_secrets}/> Real</span>
            <span className="flex items-center gap-1.5 text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"/><AnimatedCounter target={report.needs_review}/> Review</span>
            <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/><AnimatedCounter target={report.false_positives}/> FP</span>
            <span className="hidden sm:flex items-center gap-1.5 text-slate-400"><AnimatedCounter target={report.scanned_files}/> files</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Risk banner */}
        <div className={`rounded-xl p-4 mb-6 border ${risk.border} ${risk.bg} animate-in fade-in duration-500`}>
          <span className={`text-sm font-semibold ${risk.text}`}>{risk.msg}</span>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label:"Real Secrets", value:report.real_secrets, color:"text-red-400", bg:"bg-red-500/10", ring:"ring-red-500/30" },
            { label:"Needs Review", value:report.needs_review, color:"text-yellow-400", bg:"bg-yellow-500/10", ring:"ring-yellow-500/30" },
            { label:"False Positives", value:report.false_positives, color:"text-emerald-400", bg:"bg-emerald-500/10", ring:"ring-emerald-500/30" },
            { label:"Files Scanned", value:report.scanned_files, color:"text-slate-300", bg:"bg-slate-500/10", ring:"ring-slate-500/30" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ring-1 ${s.bg} ${s.ring}`}>
              <span className={`text-2xl font-bold font-mono ${s.color}`}><AnimatedCounter target={s.value}/></span>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Findings table */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Findings ({report.total_findings})</h2>
            <span className="text-[10px] text-slate-500 font-mono">{report.repo_url}</span>
          </div>
          <div className="divide-y divide-slate-800/30 p-2">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-slate-600 text-sm">No findings detected ✨</div>
            ) : sorted.map((f, i) => <FindingRow key={`${f.file}-${f.line}-${i}`} f={f} idx={i} />)}
          </div>
        </div>

        {/* Tabs: .env.example / Remediation */}
        <div className="flex gap-1 mb-4 bg-slate-900/60 p-1 rounded-xl w-fit border border-slate-800">
          {(["env","remediation"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab===t?"bg-slate-700 text-slate-100 shadow-sm":"text-slate-400 hover:text-slate-200"}`}>
              {t === "env" ? "📄 .env.example" : "🔧 Remediation"}
            </button>
          ))}
        </div>

        {tab === "env" ? (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden mb-8 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/60">
              <span className="text-xs text-slate-400 font-mono">.env.example</span>
              <div className="flex gap-2">
                <button onClick={() => copy(report.env_example)} className="px-3 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs transition-all">
                  {copied ? "✓ Copied" : "Copy"}
                </button>
                <button onClick={download} className="px-3 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs transition-all">
                  Download
                </button>
              </div>
            </div>
            <pre className="p-4 text-xs text-emerald-400 font-mono overflow-x-auto custom-scroll leading-relaxed">{report.env_example}</pre>
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden mb-8 animate-in fade-in duration-200">
            <div className="px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/60">
              <span className="text-xs text-slate-400">Remediation Checklist</span>
            </div>
            <div className="p-4 space-y-2">
              {remLines.map((line, i) => (
                <button key={i} onClick={() => toggleCheck(i)} className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-slate-800/40 ${checks.has(i)?"opacity-50":""}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${checks.has(i)?"bg-emerald-500/20 border-emerald-500 text-emerald-400":"border-slate-600"}`}>
                    {checks.has(i) && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                  </span>
                  <span className={`text-sm leading-relaxed ${checks.has(i)?"line-through text-slate-600":"text-slate-300"}`}>{line}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="flex justify-center">
          <button onClick={onReset} className="group flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 border border-slate-600/50 hover:border-slate-500 text-slate-200 hover:text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5">
            🛡️ Scan another repo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EnvSheriffPage() {
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [step, setStep] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setStep(p => Math.min(p + 1, STEPS.length - 1)), 3000);
    return () => clearInterval(iv);
  }, [loading]);

  useEffect(() => {
    if (!jobId) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/proxy/sheriff/status/${jobId}`);
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();
        if (data.status === "completed") { setReport(data.result); setLoading(false); clearInterval(iv); }
        else if (data.status === "failed") { setError(data.error || "Analysis failed"); setLoading(false); clearInterval(iv); }
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [jobId]);

  const handleScan = async () => {
    if (!repo.trim()) { setError("Please enter a GitHub URL"); return; }
    setLoading(true); setError(""); setJobId(null); setReport(null); setStep(0);
    try {
      const res = await fetch("/api/proxy/sheriff/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo_url: repo }) });
      if (!res.ok) throw new Error("Failed to start scan");
      const data = await res.json();
      if (!data?.job_id) throw new Error("Invalid response");
      setJobId(data.job_id);
    } catch (err) { setError(err instanceof Error ? err.message : "Server error"); setLoading(false); }
  };

  if (report) return <ReportView report={report} onReset={() => { setReport(null); setRepo(""); }} />;

  return (
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="relative w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-400 mb-5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            EnvSheriff · Secret Leak Detection
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 mb-2 font-mono">🛡️ EnvSheriff</h1>
          <p className="text-slate-500 text-sm leading-relaxed">Scans your repo for hardcoded secrets, API keys, and credentials<br />using regex + entropy analysis + AI classification.</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="p-6">
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4 animate-in fade-in duration-200">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                {error}
              </div>
            )}
            {loading ? <LoadingView step={step} /> : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">GitHub Repository URL</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    </div>
                    <input ref={inputRef} type="text" value={repo} onChange={e => { setRepo(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleScan()} placeholder="https://github.com/user/repo" className="w-full bg-slate-800/60 border border-slate-700 hover:border-slate-600 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3.5 text-slate-200 placeholder-slate-600 font-mono text-sm focus:outline-none transition-colors" />
                  </div>
                </div>
                <button onClick={handleScan} className="w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-900/60 to-slate-700 hover:from-red-800/60 hover:to-slate-600 border border-red-800/40 hover:border-red-700/50 text-slate-100 shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0">
                  <span className="flex items-center justify-center gap-2">🔍 Scan for Secrets</span>
                </button>
              </div>
            )}
          </div>
          {!loading && (
            <div className="border-t border-slate-800/60 px-6 py-3 flex items-center gap-4 text-[11px] text-slate-600">
              <span>🔒 Regex patterns</span>
              <span>📊 Entropy analysis</span>
              <span>🧠 AI classification</span>
            </div>
          )}
        </div>
        <div className="mt-6 text-center">
          <button onClick={() => router.push("/")} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">← Back to Home</button>
        </div>
      </div>
    </div>
  );
}
