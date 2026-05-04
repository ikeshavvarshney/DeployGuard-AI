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
  generating: "Running Tests",
  verifying: "AI Analysis",
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
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 transition-all duration-200">
      <h2 className="text-xs font-bold mb-4 text-[#888888] uppercase tracking-wider">Pipeline Progress</h2>
      <div className="space-y-3">
        {displayStages.map((stageId, idx) => {
          const s = stages[stageId] || { status: "pending" };
          const isActive = s.status === "active";
          const isDone = s.status === "done";
          const isFailed = stageId === "failed" || s.status === "failed";
          
          return (
            <div 
              key={stageId} 
              className="flex items-center gap-3"
            >
              <div className="w-6 flex justify-center">
                {isDone && !isFailed ? (
                  <div className="w-5 h-5 rounded-full bg-[#00ff88]/15 border border-[#00ff88]/40 flex items-center justify-center text-[#00ff88] text-[10px]">✓</div>
                ) : isFailed ? (
                  <div className="w-5 h-5 rounded-full bg-[#ff4444]/15 border border-[#ff4444]/40 flex items-center justify-center text-[#ff4444] text-[10px]">✕</div>
                ) : isActive ? (
                  <div className="w-5 h-5 rounded-full border-2 border-[#00ff88] border-t-transparent animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-[#1a1a1a] bg-[#0a0a0a]" />
                )}
              </div>
              <div className="flex-1">
                <div className={`text-sm font-medium transition-colors duration-200 ${isActive || isDone ? "text-white" : "text-[#444444]"}`}>
                  {STAGE_LABELS[stageId] || stageId}
                </div>
              </div>
              <div className="text-[10px] font-mono text-[#444444]">
                {s.timestamp || ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
