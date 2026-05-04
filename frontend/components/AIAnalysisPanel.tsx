"use client";
import React from "react";

interface AIAnalysisProps {
  analysis: {
    ai_analysis: string;
    health_score: string;
    tests_run: number;
    passed: number;
    failed: number;
  } | null;
}

export default function AIAnalysisPanel({ analysis }: AIAnalysisProps) {
  if (!analysis) {
    return (
      <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-6 shadow-xl flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 border-b border-[var(--border-color)] pb-3">
          <span className="text-[var(--primary-color)] text-lg">🤖</span>
          <h2 className="text-lg font-bold text-[var(--text-primary-color)] font-mono">AI Test Analysis</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--primary-color)] rounded-full animate-spin" />
          <p className="text-[var(--text-muted-color)] text-sm font-mono">Waiting for Gemma 1B analysis...</p>
        </div>
      </div>
    );
  }

  const { ai_analysis, health_score, tests_run, passed, failed } = analysis;
  const scoreNum = parseInt(health_score?.split("/")[0] || "0", 10);
  const scoreColor =
    scoreNum >= 8 ? "text-[var(--accent-color)]" :
    scoreNum >= 5 ? "text-[var(--warning-color)]" :
    "text-[var(--danger-color)]";

  // Parse bullet points from the analysis
  const lines = (ai_analysis || "").split("\n").filter(l => l.trim().length > 0);
  const bullets = lines.filter(l => l.trim().startsWith("•") || l.trim().startsWith("-") || l.trim().startsWith("*") || /^\d+\./.test(l.trim()));
  const healthLine = lines.find(l => l.toLowerCase().includes("test health score"));
  const otherLines = lines.filter(l => l !== healthLine && !bullets.includes(l));

  return (
    <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-6 shadow-xl flex flex-col h-full transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--primary-color)] text-lg">🤖</span>
          <h2 className="text-lg font-bold text-[var(--text-primary-color)] font-mono">AI Test Analysis</h2>
        </div>
        <span className="text-xs font-mono text-[var(--text-muted-color)] bg-[var(--surface-2-color)] px-2 py-1 rounded border border-[var(--border-color)]">
          gemma3:1b
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total", value: tests_run, color: "text-[var(--text-primary-color)]" },
          { label: "Passed", value: passed, color: "text-[var(--accent-color)]" },
          { label: "Failed", value: failed, color: failed > 0 ? "text-[var(--danger-color)]" : "text-[var(--text-muted-color)]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--surface-2-color)] border border-[var(--border-color)] rounded-lg p-3 text-center">
            <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-xs text-[var(--text-muted-color)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Health score */}
      {health_score && health_score !== "?/10" && (
        <div className="mb-4 bg-[var(--surface-2-color)] border border-[var(--border-color)] rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-mono text-[var(--text-muted-color)]">Test Health Score</span>
          <span className={`text-2xl font-bold font-mono ${scoreColor}`}>{health_score}</span>
        </div>
      )}

      {/* LLM analysis */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {ai_analysis ? (
          <div className="space-y-2">
            {/* Bullet points */}
            {bullets.length > 0 ? (
              bullets.map((line, i) => (
                <div key={i} className="flex gap-2 p-2 rounded-lg bg-[var(--surface-2-color)] border border-[var(--border-color)] text-sm text-[var(--text-primary-color)] font-mono animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
                  <span className="text-[var(--primary-color)] shrink-0 mt-0.5">▸</span>
                  <span className="leading-relaxed">{line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, "")}</span>
                </div>
              ))
            ) : (
              /* Fallback: show whole analysis as preformatted text */
              <div className="p-3 bg-[var(--surface-2-color)] border border-[var(--border-color)] rounded-lg font-mono text-xs text-[var(--text-primary-color)] whitespace-pre-wrap leading-relaxed">
                {ai_analysis}
              </div>
            )}

            {/* Health line if not already in bullets */}
            {healthLine && !bullets.includes(healthLine) && (
              <div className="mt-3 p-2 rounded-lg bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/30 text-xs font-mono text-[var(--primary-color)]">
                {healthLine}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[var(--text-muted-color)] py-6 text-sm font-mono">
            No analysis available yet.
          </div>
        )}
      </div>
    </div>
  );
}
