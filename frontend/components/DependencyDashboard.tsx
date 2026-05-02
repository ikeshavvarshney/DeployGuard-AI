"use client";

import { useState, useMemo } from "react";
import DependencyTable from "./DependencyTable";
import UpdateCommandsModal from "./UpdateCommandsModal";

/* ---------- Clean Animated Count (no interval spam) ---------- */
function AnimatedCount({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      {value}
    </span>
  );
}

/* ---------- Urgency Card ---------- */
function StatCard({
  label,
  value,
  color,
  highlight = false,
}: {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-[#12121A] border rounded-xl p-4 relative overflow-hidden ${
        highlight ? `border-[${color}]/40` : "border-[#2A2A3F]"
      }`}
    >
      {highlight && (
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: color }}
        />
      )}

      <div className="text-sm text-[#8888AA] mb-1 relative z-10">
        {label}
      </div>

      <div
        className="text-3xl font-bold relative z-10"
        style={{ color }}
      >
        <AnimatedCount value={value} />
      </div>
    </div>
  );
}

export default function DependencyDashboard({
  report,
  onReset,
}: {
  report: any;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"frontend" | "backend">("frontend");
  const [showModal, setShowModal] = useState(false);

  /* ---------- Derived values (no recalculation on every render) ---------- */
  const {
    frontend_deps,
    backend_deps,
    critical_count,
    high_count,
    medium_count,
    low_count,
    total_outdated,
    update_commands,
    repo_url,
  } = report;

  const totalPackages = useMemo(
    () => frontend_deps.length + backend_deps.length,
    [frontend_deps, backend_deps]
  );

  const noOutdated = total_outdated === 0;

  /* ---------- Empty state ---------- */
  if (noOutdated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <div className="text-6xl mb-6 text-[#00D4AA]">✓</div>

          <h1 className="text-3xl font-bold mb-3 text-[#00D4AA]">
            All dependencies are up to date
          </h1>

          <p className="text-[#8888AA] mb-6">
            {repo_url}
          </p>

          <button
            onClick={onReset}
            className="bg-[#12121A] border border-[#2A2A3F] px-6 py-3 rounded-lg hover:bg-[#1A1A26] transition"
          >
            Analyze another repo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.4s_ease]">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dependency Report</h1>
          <p className="text-[#8888AA] text-sm">{repo_url}</p>
        </div>

        <button
          onClick={onReset}
          className="text-sm text-[#8888AA] hover:text-white transition"
        >
          Analyze another repo
        </button>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">

        {/* TOTAL */}
        <div className="bg-[#12121A] border border-[#2A2A3F] p-4 rounded-xl">
          <div className="text-sm text-[#8888AA] mb-1">Outdated</div>
          <div className="text-2xl font-bold">
            {total_outdated}
            <span className="text-sm text-[#8888AA] ml-1">
              / {totalPackages}
            </span>
          </div>
        </div>

        <StatCard label="Critical" value={critical_count} color="#FF4D6D" highlight />
        <StatCard label="High" value={high_count} color="#FFB347" highlight />
        <StatCard label="Medium" value={medium_count} color="#F0C040" />
        <StatCard label="Low" value={low_count} color="#8888AA" />

      </div>

      {/* TABS */}
      <div className="flex border-b border-[#2A2A3F] mb-6">
        {["frontend", "backend"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-6 py-3 border-b-2 transition ${
              tab === t
                ? "border-[#6C63FF] text-[#6C63FF]"
                : "border-transparent text-[#8888AA] hover:text-white"
            }`}
          >
            {t === "frontend" ? "Frontend (npm)" : "Backend (pip)"}
            <span className="ml-2 text-xs bg-[#1A1A26] px-2 py-0.5 rounded-full">
              {t === "frontend"
                ? frontend_deps.length
                : backend_deps.length}
            </span>
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="mb-24 min-h-[400px]">
        <DependencyTable
          deps={tab === "frontend" ? frontend_deps : backend_deps}
        />
      </div>

      {/* FLOATING BUTTON */}
      {update_commands?.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20">
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#6C63FF] px-8 py-4 rounded-full shadow-lg hover:bg-[#8B84FF] hover:scale-105 transition-all"
          >
            Generate Update Commands
          </button>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <UpdateCommandsModal
          commands={update_commands}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}