"use client";

import { useState, useMemo } from "react";

/* ---------- TYPES (FIXES YOUR BUG) ---------- */

type Urgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UP_TO_DATE";

type Dependency = {
  name: string;
  urgency?: string;
  is_outdated: boolean;
  is_dev: boolean;
  installed_version: string;
  latest_version: string;
  sub_dependencies?: string[];
  reason?: string;
};

/* ---------- CONSTANTS ---------- */

const URGENCY_COLORS: Record<Urgency, string> = {
  CRITICAL: "bg-[#FF4D6D]/10 text-[#FF4D6D] border-[#FF4D6D]/30",
  HIGH: "bg-[#FFB347]/10 text-[#FFB347] border-[#FFB347]/30",
  MEDIUM: "bg-[#F0C040]/10 text-[#F0C040] border-[#F0C040]/30",
  LOW: "bg-[#8888AA]/10 text-[#8888AA] border-[#8888AA]/30",
  UP_TO_DATE: "bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/30",
};

const URGENCY_ORDER: Record<Urgency, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  UP_TO_DATE: 5,
};

const FILTERS = ["ALL", "OUTDATED", "UP_TO_DATE", "CRITICAL", "HIGH", "DEV"];

/* ---------- UTILS (CRITICAL FIX) ---------- */

const normalizeUrgency = (u?: string): Urgency => {
  if (!u) return "MEDIUM";
  const normalized = u.toUpperCase().replace(/\s/g, "_") as Urgency;
  return URGENCY_ORDER[normalized] ? normalized : "MEDIUM";
};

/* ---------- ROW COMPONENT ---------- */

function DependencyRow({ dep, index }: { dep: Dependency; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const urgencyKey = normalizeUrgency(dep.urgency);
  const urgencyStyle = URGENCY_COLORS[urgencyKey];

  return (
    <div
      className="bg-[#12121A] border border-[#2A2A3F] rounded-xl mb-3 overflow-hidden transition-all duration-300"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1A1A26] transition"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-4 flex-1">
          {/* CHEVRON */}
          <div
            className={`w-8 h-8 flex items-center justify-center transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="m6 9 6 6 6-6" stroke="#8888AA" strokeWidth="2" fill="none" />
            </svg>
          </div>

          {/* NAME */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-lg">
                {dep.name}
              </span>

              {dep.is_dev && (
                <span className="text-[10px] uppercase bg-[#1A1A26] text-[#8888AA] px-1.5 py-0.5 rounded">
                  DEV
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm font-mono mt-1">
              <span className="text-[#8888AA]">
                {dep.installed_version}
              </span>

              {dep.is_outdated && (
                <>
                  <span className="text-[#2A2A3F]">→</span>
                  <span className="text-[#00D4AA]">
                    {dep.latest_version}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* BADGE */}
        <div
          className={`px-3 py-1 rounded-full border text-xs font-bold ${urgencyStyle}`}
          title={dep.reason}
        >
          {urgencyKey.replace("_", " ")}
        </div>
      </div>

      {/* EXPAND */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 border-t border-[#2A2A3F] bg-[#0D0D1A]">
          <h4 className="text-sm text-[#8888AA] mb-3">
            Sub-dependencies
          </h4>

          {dep.sub_dependencies?.length ? (
            <div className="flex flex-wrap gap-2">
              {dep.sub_dependencies.map((sub, i) => (
                <span
                  key={i}
                  className="text-xs font-mono bg-[#1A1A26] px-2 py-1 rounded border border-[#2A2A3F]"
                >
                  {sub}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-[#8888AA] italic">
              No sub-dependencies
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- MAIN TABLE ---------- */

export default function DependencyTable({ deps }: { deps: Dependency[] }) {
  const [filter, setFilter] = useState("ALL");

  /* ---------- SORT ---------- */
  const sortedDeps = useMemo(() => {
    return [...deps].sort((a, b) => {
      const aKey = normalizeUrgency(a.urgency);
      const bKey = normalizeUrgency(b.urgency);

      return (URGENCY_ORDER[aKey] ?? 99) - (URGENCY_ORDER[bKey] ?? 99);
    });
  }, [deps]);

  /* ---------- FILTER ---------- */
  const filteredDeps = useMemo(() => {
    switch (filter) {
      case "OUTDATED":
        return sortedDeps.filter((d) => d.is_outdated);
      case "UP_TO_DATE":
        return sortedDeps.filter((d) => !d.is_outdated);
      case "CRITICAL":
        return sortedDeps.filter(
          (d) => normalizeUrgency(d.urgency) === "CRITICAL"
        );
      case "HIGH":
        return sortedDeps.filter(
          (d) => normalizeUrgency(d.urgency) === "HIGH"
        );
      case "DEV":
        return sortedDeps.filter((d) => d.is_dev);
      default:
        return sortedDeps;
    }
  }, [filter, sortedDeps]);

  return (
    <div>
      {/* FILTER BAR */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              filter === f
                ? "bg-[#6C63FF] text-white"
                : "bg-[#12121A] border border-[#2A2A3F] text-[#8888AA] hover:bg-[#1A1A26]"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* EMPTY */}
      {filteredDeps.length === 0 ? (
        <div className="text-center py-12 bg-[#12121A] border border-[#2A2A3F] rounded-xl">
          <p className="text-[#8888AA]">
            No dependencies match this filter.
          </p>
        </div>
      ) : (
        filteredDeps.map((dep, idx) => (
          <DependencyRow key={dep.name} dep={dep} index={idx} />
        ))
      )}
    </div>
  );
}