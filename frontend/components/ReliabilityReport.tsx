"use client";
import React from "react";

export default function ReliabilityReport({ report, isComplete }: { report: any, isComplete: boolean }) {
  if (!isComplete) {
    return (
      <div className="bg-gradient-to-br from-[var(--surface-color)] to-[var(--bg-color)] border border-[var(--border-color)] rounded-xl p-6 shadow-xl relative overflow-hidden">
         <h2 className="text-xl font-bold mb-6 text-[var(--text-muted-color)] flex items-center gap-2">
          <span className="text-[var(--text-muted-color)]">★</span> Final Report
        </h2>
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
             <span className="text-[var(--text-muted-color)]">Reliability Grade</span>
             <div className="w-16 h-8 bg-[var(--surface-2-color)] rounded animate-pulse"></div>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
             <span className="text-[var(--text-muted-color)]">Final Score</span>
             <div className="w-12 h-6 bg-[var(--surface-2-color)] rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  // Formula provided by user: final_score = 0.5 * mutation_score + 0.3 * test_effectiveness + 0.2 * deployment_success
  // Let's assume the report comes with these, or we calculate them here:
  const mutationScore = report.mutation_score || report.initial_mutation_score || 0;
  const testEffectiveness = report.tests_generated > 0 ? (report.tests_verified / report.tests_generated) * 100 : 0;
  const deploymentSuccess = report.deployment_live ? 100 : 0;
  
  const finalScoreRaw = (0.5 * mutationScore) + (0.3 * testEffectiveness) + (0.2 * deploymentSuccess);
  const finalScore = isNaN(finalScoreRaw) ? 0 : Math.round(finalScoreRaw);
  
  const scoreDecimal = finalScore / 100;
  
  let confidenceLevel = "LOW";
  let confidenceColor = "text-[var(--danger-color)]";
  
  if (scoreDecimal >= 0.8) {
    confidenceLevel = "HIGH";
    confidenceColor = "text-[var(--accent-color)]";
  } else if (scoreDecimal >= 0.6) {
    confidenceLevel = "MEDIUM";
    confidenceColor = "text-[var(--warning-color)]";
  }

  return (
    <div className="bg-gradient-to-br from-[var(--surface-color)] to-[var(--bg-color)] border border-[var(--primary-color)]/30 rounded-xl p-6 shadow-[0_0_30px_rgba(108,99,255,0.1)] transition-all duration-500 animate-in fade-in zoom-in-95">
      <h2 className="text-xl font-bold mb-6 text-[var(--text-primary-color)] flex items-center gap-2">
        <span className="text-[var(--primary-color)]">★</span> Final Report
      </h2>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
          <span className="text-[var(--text-muted-color)]">Reliability Grade</span>
          <span className={`text-2xl font-bold ${confidenceColor} animate-pulse`}>{confidenceLevel}</span>
        </div>
        
        <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
          <span className="text-[var(--text-muted-color)]">Final Score</span>
          <span className="text-2xl font-mono text-[var(--text-primary-color)]">{finalScore}%</span>
        </div>

        <div className="pt-2">
          <span className="text-[var(--text-muted-color)] block mb-2 text-sm">Deployment URL</span>
          <a 
            href={report.deployment_url || "#"} 
            target="_blank" 
            rel="noreferrer"
            className="block w-full p-3 bg-[var(--code-bg-color)] border border-[var(--border-color)] rounded text-[var(--primary-color)] font-mono text-sm hover:border-[var(--primary-color)] hover:shadow-[0_0_10px_rgba(108,99,255,0.2)] transition-all truncate"
          >
            {report.deployment_url || "Deployment Failed or Unavailable"}
          </a>
        </div>
      </div>
    </div>
  );
}
