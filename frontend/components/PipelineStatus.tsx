"use client";
import React from "react";

const STAGE_ORDER = [
  "analyzing", "deploying", "mutating", "ranking", 
  "generating", "verifying", "fixing", "scoring", "completed"
];

const STAGE_LABELS: Record<string, string> = {
  analyzing: "Analyzing Repo",
  deploying: "Initial Deployment",
  mutating: "Running Mutations",
  ranking: "Ranking Mutants",
  generating: "Generating Tests",
  verifying: "Verifying Tests",
  fixing: "Fixing Issues",
  scoring: "Scoring Reliability",
  completed: "Pipeline Complete",
  failed: "Pipeline Failed"
};

export default function PipelineStatus({ stages }: { stages: Record<string, { status: string; timestamp?: string }> }) {
  // If failed is active/done, we should show it instead of completed
  const hasFailed = stages["failed"]?.status === "active" || stages["failed"]?.status === "done";
  
  const displayStages = hasFailed 
    ? [...STAGE_ORDER.slice(0, STAGE_ORDER.length - 1), "failed"]
    : STAGE_ORDER;

  return (
    <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-6 shadow-xl transition-all duration-300 hover:scale-[1.01]">
      <h2 className="text-lg font-bold mb-4 text-[var(--text-muted-color)] font-mono">Pipeline Progress</h2>
      <div className="space-y-4">
        {displayStages.map((stageId, idx) => {
          const s = stages[stageId] || { status: "pending" };
          const isActive = s.status === "active";
          const isDone = s.status === "done";
          const isFailed = stageId === "failed" || s.status === "failed";
          
          return (
            <div 
              key={stageId} 
              className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            >
              <div className="w-8 flex justify-center">
                {isDone && !isFailed ? (
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-color)]/20 border border-[var(--accent-color)] flex items-center justify-center text-[var(--accent-color)] text-xs shadow-[0_0_10px_var(--accent-color)]">✓</div>
                ) : isFailed ? (
                  <div className="w-6 h-6 rounded-full bg-[var(--danger-color)]/20 border border-[var(--danger-color)] flex items-center justify-center text-[var(--danger-color)] text-xs shadow-[0_0_10px_var(--danger-color)]">✕</div>
                ) : isActive ? (
                  <div className="w-6 h-6 rounded-full border-2 border-[var(--primary-color)] border-t-transparent animate-spin shadow-[0_0_10px_var(--primary-color)]"></div>
                ) : (
                  <div className="w-6 h-6 rounded-full border border-[var(--border-color)] bg-[var(--surface-2-color)]"></div>
                )}
              </div>
              <div className="flex-1">
                <div className={`font-medium transition-colors duration-300 ${isActive || isDone ? "text-[var(--text-primary-color)]" : "text-[var(--text-muted-color)]"}`}>
                  {STAGE_LABELS[stageId] || stageId}
                </div>
              </div>
              <div className="text-xs font-mono text-[var(--text-muted-color)]">
                {s.timestamp || "---"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
