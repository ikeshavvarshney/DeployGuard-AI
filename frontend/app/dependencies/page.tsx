"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Urgency = "critical" | "high" | "medium" | "low";

interface Dependency {
  name: string;
  current_version: string;
  latest_version: string;
  urgency: Urgency;
  reason: string;
  sub_dependencies?: Dependency[];
  update_command?: string;
}

interface AnalysisReport {
  repo_url: string;
  frontend: Dependency[];
  backend: Dependency[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<
  Urgency,
  { label: string; color: string; bg: string; ring: string; dot: string }
> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/30",
    dot: "bg-red-500",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    ring: "ring-orange-500/30",
    dot: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    ring: "ring-yellow-500/30",
    dot: "bg-yellow-500",
  },
  low: {
    label: "Low",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
};

const LOADING_STEPS = [
  { icon: "⬇", text: "Cloning repository..." },
  { icon: "🔍", text: "Detecting dependencies..." },
  { icon: "🌐", text: "Fetching latest versions..." },
  { icon: "🧠", text: "Classifying urgency with AI..." },
  { icon: "⚡", text: "Generating update commands..." },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function VersionBadge({
  current,
  latest,
}: {
  current: string;
  latest: string;
}) {
  const isOutdated =
    latest !== "unknown" && current !== latest && latest !== current;
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
        {current}
      </span>
      {isOutdated && (
        <>
          <span className="text-slate-600">→</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {latest}
          </span>
        </>
      )}
      {!isOutdated && latest !== "unknown" && (
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500/70 border border-emerald-500/20 text-[10px]">
          up to date
        </span>
      )}
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function DependencyRow({ dep, depth = 0 }: { dep: Dependency; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = dep.sub_dependencies && dep.sub_dependencies.length > 0;

  return (
    <div
      className={`transition-all duration-200 ${depth > 0 ? "border-l border-slate-700/60 ml-4 pl-4" : ""}`}
    >
      <div
        className={`group flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all duration-150 cursor-default
          ${depth === 0 ? "hover:bg-slate-800/60" : "hover:bg-slate-800/30"}
          ${expanded ? "bg-slate-800/40" : ""}
        `}
      >
        {/* Expand button */}
        <button
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className={`w-5 h-5 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0
            ${hasChildren ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-transparent cursor-default"}`}
          tabIndex={hasChildren ? 0 : -1}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Package name */}
        <span
          className={`font-mono font-semibold flex-1 min-w-0 truncate ${depth === 0 ? "text-slate-100 text-sm" : "text-slate-300 text-xs"}`}
        >
          {dep.name}
          {hasChildren && (
            <span className="ml-2 text-[10px] text-slate-500 font-normal">
              {dep.sub_dependencies!.length} sub-deps
            </span>
          )}
        </span>

        {/* Version badges */}
        <div className="hidden sm:block">
          <VersionBadge current={dep.current_version} latest={dep.latest_version} />
        </div>

        {/* Urgency */}
        <UrgencyBadge urgency={dep.urgency} />
      </div>

      {/* Reason tooltip row */}
      {dep.reason && (
        <div className="px-12 pb-2 text-[11px] text-slate-500 leading-relaxed">
          {dep.reason}
        </div>
      )}

      {/* Sub-dependencies */}
      {expanded && hasChildren && (
        <div className="mt-1 mb-2 animate-in slide-in-from-top-2 duration-200">
          {dep.sub_dependencies!.map((sub) => (
            <DependencyRow key={sub.name} dep={sub} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DependencyList({ deps }: { deps: Dependency[] }) {
  if (deps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-600">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
        <p className="text-sm">No dependencies detected</p>
      </div>
    );
  }

  const sorted = [...deps].sort((a, b) => {
    const order: Urgency[] = ["critical", "high", "medium", "low"];
    return order.indexOf(a.urgency) - order.indexOf(b.urgency);
  });

  return (
    <div className="space-y-1">
      {sorted.map((dep) => (
        <DependencyRow key={dep.name} dep={dep} />
      ))}
    </div>
  );
}

function UpdateCommandsModal({
  deps,
  ecosystem,
  onClose,
}: {
  deps: Dependency[];
  ecosystem: "frontend" | "backend";
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const allCommands = deps
    .filter((d) => d.update_command)
    .map((d) => d.update_command!)
    .join("\n");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const urgencyGroups: Urgency[] = ["critical", "high", "medium", "low"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[80vh] bg-[#0d1117] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-900/60">
          <div>
            <h3 className="text-base font-semibold text-slate-100 font-mono">
              Update Commands
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ecosystem === "frontend" ? "npm" : "pip"} ·{" "}
              {deps.filter((d) => d.update_command).length} packages
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(allCommands, "all")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all duration-150"
            >
              {copied === "all" ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy All
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Commands grouped by urgency */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4 space-y-4 custom-scroll">
          {urgencyGroups.map((urgency) => {
            const group = deps.filter(
              (d) => d.urgency === urgency && d.update_command
            );
            if (group.length === 0) return null;
            const cfg = URGENCY_CONFIG[urgency];
            const groupCmds = group.map((d) => d.update_command!).join("\n");

            return (
              <div key={urgency}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-widest ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <button
                    onClick={() => copyToClipboard(groupCmds, urgency)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {copied === urgency ? "✓ copied" : "copy group"}
                  </button>
                </div>
                <div className={`rounded-xl border ${cfg.ring} overflow-hidden`}>
                  {group.map((dep, i) => (
                    <div
                      key={dep.name}
                      className={`flex items-center justify-between px-4 py-2.5 gap-3 group/cmd
                        ${i < group.length - 1 ? "border-b border-slate-800" : ""}
                        hover:bg-slate-800/40 transition-colors`}
                    >
                      <code className="font-mono text-xs text-slate-300 flex-1 min-w-0 truncate">
                        {dep.update_command}
                      </code>
                      <button
                        onClick={() => copyToClipboard(dep.update_command!, dep.name)}
                        className="flex-shrink-0 opacity-0 group-hover/cmd:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                      >
                        {copied === dep.name ? (
                          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Report View ──────────────────────────────────────────────────────────────

function ReportView({
  report,
  onReset,
}: {
  report: AnalysisReport;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"frontend" | "backend">("frontend");
  const [showModal, setShowModal] = useState(false);
  const activeDeps = tab === "frontend" ? report.frontend : report.backend;

  const statItems = [
    { value: report.summary.critical, ...URGENCY_CONFIG.critical },
    { value: report.summary.high, ...URGENCY_CONFIG.high },
    { value: report.summary.medium, ...URGENCY_CONFIG.medium },
    { value: report.summary.low, ...URGENCY_CONFIG.low },
  ];

  return (
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-[#080c12]/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              New Analysis
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-xs text-slate-500 font-mono truncate max-w-xs">
              {report.repo_url}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {statItems.map((s) => (
              <span key={s.label} className={`hidden sm:flex items-center gap-1 text-xs ${s.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {statItems.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl p-4 ring-1 ${s.bg} ${s.ring} flex flex-col gap-1`}
            >
              <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
              <span className="text-xs text-slate-400 font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 mb-6 bg-slate-900/60 p-1 rounded-xl w-fit border border-slate-800">
          {(["frontend", "backend"] as const).map((t) => {
            const count = t === "frontend" ? report.frontend.length : report.backend.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                  ${tab === t
                    ? "bg-slate-700 text-slate-100 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                {t === "frontend" ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                )}
                <span className="capitalize">{t}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono
                  ${tab === t ? "bg-slate-600 text-slate-300" : "bg-slate-800 text-slate-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Deps table */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden mb-8">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/60">
            <span className="w-5" />
            <span className="flex-1 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Package</span>
            <span className="hidden sm:block text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Version</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest pr-1">Priority</span>
          </div>

          <div className="divide-y divide-slate-800/40 p-2">
            <DependencyList deps={activeDeps} />
          </div>
        </div>

        {/* Update commands CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowModal(true)}
            className="group relative flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-sm
              bg-gradient-to-r from-slate-800 to-slate-700
              hover:from-slate-700 hover:to-slate-600
              border border-slate-600/50 hover:border-slate-500
              text-slate-200 hover:text-white
              shadow-lg hover:shadow-slate-700/20
              transition-all duration-300 hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View Update Commands
            <span className="ml-1 text-xs text-slate-500 font-normal">
              ({activeDeps.filter((d) => d.update_command).length} packages)
            </span>
          </button>
        </div>
      </div>

      {showModal && (
        <UpdateCommandsModal
          deps={activeDeps}
          ecosystem={tab}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── Loading View ─────────────────────────────────────────────────────────────

function LoadingView({ step }: { step: number }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Spinner */}
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
        <div className="absolute inset-0 rounded-full border-2 border-t-slate-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-2 rounded-full border border-slate-700/50 border-t-slate-600 animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
      </div>

      {/* Steps */}
      <div className="w-full space-y-2">
        {LOADING_STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500
              ${i === step ? "bg-slate-800/60 text-slate-200" : ""}
              ${i < step ? "text-slate-600" : ""}
              ${i > step ? "text-slate-700" : ""}
            `}
          >
            <span className="text-base w-5 text-center">{s.icon}</span>
            <span className="text-sm font-medium">{s.text}</span>
            {i < step && (
              <svg className="w-3.5 h-3.5 text-emerald-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {i === step && (
              <span className="ml-auto flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1 h-1 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DependenciesPage() {
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Step cycling
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  // Polling
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/proxy/deps/status/${jobId}`);
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();
        if (data.status === "completed") {
          setReport(data.result);
          setLoading(false);
          clearInterval(poll);
        } else if (data.status === "failed") {
          setError("Analysis failed. Check the repo URL and try again.");
          setLoading(false);
          clearInterval(poll);
        }
      } catch {
        // silent — keep polling
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId]);

  const handleAnalyze = async () => {
    if (!repo.trim()) {
      setError("Please enter a GitHub URL");
      return;
    }
    setLoading(true);
    setError("");
    setJobId(null);
    setReport(null);
    setLoadingStep(0);

    try {
      const res = await fetch("/api/proxy/deps/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repo }),
      });
      if (!res.ok) throw new Error("Failed to start analysis");
      const data = await res.json();
      if (!data?.job_id) throw new Error("Invalid response: missing job_id");
      setJobId(data.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server error");
      setLoading(false);
    }
  };

  if (report) return <ReportView report={report} onReset={() => { setReport(null); setRepo(""); }} />;

  return (
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans flex flex-col items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-400 mb-5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            AI-Powered · Live Registry Checks
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 mb-2 font-mono">
            Dependency Analyzer
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Clones your repo, checks npm + PyPI for latest versions,<br />
            and classifies update urgency with AI.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="p-6">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4 animate-in fade-in duration-200">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            {loading ? (
              <LoadingView step={loadingStep} />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    GitHub Repository URL
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={repo}
                      onChange={(e) => { setRepo(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                      placeholder="https://github.com/user/repo"
                      className="w-full bg-slate-800/60 border border-slate-700 hover:border-slate-600 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3.5 text-slate-200 placeholder-slate-600 font-mono text-sm focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  className="w-full relative overflow-hidden group py-3.5 rounded-xl font-semibold text-sm
                    bg-gradient-to-r from-slate-700 to-slate-600
                    hover:from-slate-600 hover:to-slate-500
                    border border-slate-600 hover:border-slate-500
                    text-slate-100 shadow-lg
                    transition-all duration-300 hover:shadow-slate-700/30 hover:-translate-y-0.5
                    active:translate-y-0"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Analyze Dependencies
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Footer strip */}
          {!loading && (
            <div className="border-t border-slate-800/60 px-6 py-3 flex items-center gap-4 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                npm + pip
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                AI urgency classification
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Update commands
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}