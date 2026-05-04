"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PRListItem, Report, GithubUser } from "./components/types";
import { PRNavbar } from "./components/PRNavbar";
import { ReportView } from "./components/ReportView";
import { LoadingView } from "./components/RiskRing";

type Phase = "input" | "loading_prs" | "pr_list" | "analyzing" | "report";

export default function PRScorerPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Auth state ──────────────────────────────────────────────
  const [githubToken, setGithubToken] = useState<string|null>(null);
  const [githubUser, setGithubUser] = useState<GithubUser|null>(null);

  useEffect(() => {
    const t = localStorage.getItem("github_token");
    const u = localStorage.getItem("github_user");
    if (t) setGithubToken(t);
    if (u) { try { setGithubUser(JSON.parse(u)); } catch {} }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("github_token");
    localStorage.removeItem("github_user");
    setGithubToken(null);
    setGithubUser(null);
  };

  // ─── Core state ──────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("input");
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");

  // PR list
  const [prs, setPrs] = useState<PRListItem[]>([]);
  const [selectedPR, setSelectedPR] = useState<number|null>(null);

  // Analysis
  const [jobId, setJobId] = useState<string|null>(null);
  const [step, setStep] = useState(0);
  const [reports, setReports] = useState<Map<number, Report>>(new Map());

  const currentReport = selectedPR !== null ? reports.get(selectedPR) : undefined;

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ─── Loading step animation ──────────────────────────────────
  useEffect(() => {
    if (phase !== "analyzing") return;
    const iv = setInterval(() => setStep(p => Math.min(p + 1, 3)), 3000);
    return () => clearInterval(iv);
  }, [phase]);

  // ─── Job polling ─────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || phase !== "analyzing") return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/proxy/pr/status/${jobId}`);
        const d = await r.json();
        if (d.status === "completed" && selectedPR !== null) {
          const newReports = new Map(reports);
          newReports.set(selectedPR, d.result);
          setReports(newReports);
          setPhase("report");
          setJobId(null);
          clearInterval(iv);
        } else if (d.status === "failed") {
          setError(d.error || "Analysis failed");
          setPhase("pr_list");
          setJobId(null);
          clearInterval(iv);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [jobId, phase, selectedPR, reports]);

  // ─── Load PRs ────────────────────────────────────────────────
  const loadPRs = async () => {
    if (!repoUrl.trim()) { setError("Enter a repository URL"); return; }
    setError("");
    setPhase("loading_prs");
    try {
      const r = await fetch("/api/proxy/pr/repo/prs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl.trim(), github_token: githubToken }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || d?.error || `Error ${r.status}`);
      setPrs(d.prs || []);
      setPhase("pr_list");
      // Auto-select first open PR
      const firstOpen = (d.prs || []).find((p: PRListItem) => p.state === "open");
      if (firstOpen) setSelectedPR(firstOpen.pr_number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load PRs");
      setPhase("input");
    }
  };

  // ─── Analyze a PR ────────────────────────────────────────────
  const analyzePR = async (pr: PRListItem) => {
    setSelectedPR(pr.pr_number);
    // If already analyzed, just show cached report
    if (reports.has(pr.pr_number)) {
      setPhase("report");
      return;
    }
    setPhase("analyzing");
    setStep(0);
    setError("");
    try {
      const r = await fetch("/api/proxy/pr/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_url: pr.pr_url, github_token: githubToken }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || d?.error || `Error ${r.status}`);
      if (!d?.job_id) throw new Error(d?.detail || "No job_id returned");
      setJobId(d.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setPhase("pr_list");
    }
  };

  // ─── Computed ────────────────────────────────────────────────
  const analyzedScores = new Map<number, number>();
  reports.forEach((r, num) => analyzedScores.set(num, r.risk_score));

  const repoLabel = repoUrl.replace("https://github.com/", "").replace(/\/$/, "");

  // ═══════════════════════════════════════════════════════════════
  // INPUT PHASE
  // ═══════════════════════════════════════════════════════════════
  if (phase === "input" || phase === "loading_prs") {
    return (
      <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans flex flex-col items-center justify-center p-4">
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage:"linear-gradient(#64748b 1px,transparent 1px),linear-gradient(90deg,#64748b 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>
        <div className="relative w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-400 mb-5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"/>PR Risk Scorer · Pre-Merge Intelligence
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-50 mb-2 font-mono">⚡ PR Risk Scorer</h1>
            <p className="text-slate-500 text-sm">Enter a GitHub repository to load all pull requests,<br/>then analyze any PR for merge risk.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-6">
              {error && <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">{error}</div>}
              {phase === "loading_prs" ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="relative w-10 h-10"><div className="absolute inset-0 rounded-full border-2 border-slate-800"/><div className="absolute inset-0 rounded-full border-2 border-t-slate-400 border-r-transparent border-b-transparent border-l-transparent animate-spin"/></div>
                  <p className="text-sm text-slate-400">Loading pull requests...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">GitHub Repository URL</label>
                    <input ref={inputRef} value={repoUrl} onChange={e => { setRepoUrl(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && loadPRs()} placeholder="https://github.com/owner/repo" className="w-full bg-slate-800/60 border border-slate-700 hover:border-slate-600 focus:border-slate-500 rounded-xl px-4 py-3.5 text-slate-200 placeholder-slate-600 font-mono text-sm focus:outline-none transition-colors"/>
                  </div>
                  <button onClick={loadPRs} className="w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-orange-900/40 to-slate-700 hover:from-orange-800/50 hover:to-slate-600 border border-orange-800/30 text-slate-100 shadow-lg transition-all duration-300 hover:-translate-y-0.5">⚡ Load Pull Requests</button>
                </div>
              )}
            </div>
            {phase !== "loading_prs" && <div className="border-t border-slate-800/60 px-6 py-3 flex items-center gap-4 text-[11px] text-slate-600"><span>📊 Diff analysis</span><span>🧠 AI scoring</span><span>🔀 One-click merge</span></div>}
          </div>
          <div className="mt-6 text-center"><button onClick={() => router.push("/")} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">← Back to Home</button></div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PR LIST / ANALYZING / REPORT PHASE (split layout)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#080c12]/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setPhase("input"); setPrs([]); setReports(new Map()); setSelectedPR(null); }} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm">← New Repo</button>
            <span className="text-xs font-mono text-slate-500 truncate max-w-xs">{repoLabel}</span>
            <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">{prs.length} PRs</span>
          </div>
          <div className="flex items-center gap-3">
            {githubUser ? (
              <div className="flex items-center gap-2">
                <img src={githubUser.avatar_url} className="w-6 h-6 rounded-full" alt=""/>
                <span className="text-xs text-slate-400">@{githubUser.login}</span>
                <button onClick={handleSignOut} className="text-[10px] text-slate-600 hover:text-slate-400 ml-1">Sign out</button>
              </div>
            ) : (
              <a href={`http://localhost:8000/api/auth/github?redirect=/prscorer`} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors">Sign in with GitHub</a>
            )}
          </div>
        </div>
      </div>

      {/* Split Layout */}
      <div className="max-w-7xl mx-auto flex" style={{ height: "calc(100vh - 52px)" }}>
        {/* Left: PR Navbar */}
        <div className="w-72 flex-shrink-0 border-r border-slate-800/60 py-3 px-2 overflow-hidden">
          <PRNavbar prs={prs} selectedPR={selectedPR} analyzedPRs={analyzedScores} onSelectPR={analyzePR}/>
        </div>

        {/* Right: Content */}
        <div className="flex-1 overflow-y-auto custom-scroll px-6 py-6">
          {error && <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">{error}<button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-300">×</button></div>}

          {phase === "analyzing" && <LoadingView step={step}/>}

          {phase === "report" && currentReport && (
            <ReportView report={currentReport} githubToken={githubToken} githubUser={githubUser ? { login: githubUser.login, avatar_url: githubUser.avatar_url } : null}/>
          )}

          {phase === "pr_list" && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">👈</div>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">Select a Pull Request</h3>
              <p className="text-sm text-slate-500 max-w-sm">Click any PR from the sidebar to analyze its merge risk with AI-powered scoring.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
