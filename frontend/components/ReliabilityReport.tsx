"use client";
import React from "react";

export default function ReliabilityReport({ report, isComplete }: { report: any, isComplete: boolean }) {
  if (!isComplete) {
    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 relative overflow-hidden">
         <h2 className="text-xs font-bold mb-5 text-[#888888] uppercase tracking-wider flex items-center gap-2">
          <span className="text-[#444444]">★</span> Final Report
        </h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#1a1a1a]">
             <span className="text-[#888888] text-sm">Reliability Grade</span>
             <div className="w-16 h-6 bg-[#1a1a1a] rounded animate-pulse" />
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-[#1a1a1a]">
             <span className="text-[#888888] text-sm">Final Score</span>
             <div className="w-12 h-5 bg-[#1a1a1a] rounded animate-pulse" />
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
  let confidenceColor = "text-[#ff4444]";
  
  if (scoreDecimal >= 0.8) {
    confidenceLevel = "HIGH";
    confidenceColor = "text-[#00ff88]";
  } else if (scoreDecimal >= 0.6) {
    confidenceLevel = "MEDIUM";
    confidenceColor = "text-[#ffaa00]";
  }

  return (
    <div className="bg-[#111111] border border-[#00ff88]/20 rounded-xl p-5 transition-all duration-200 animate-fadeInUp">
      <h2 className="text-xs font-bold mb-5 text-white uppercase tracking-wider flex items-center gap-2">
        <span className="text-[#00ff88]">★</span> Final Report
      </h2>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center pb-3 border-b border-[#1a1a1a]">
          <span className="text-[#888888] text-sm">Reliability Grade</span>
          <span className={`text-xl font-bold ${confidenceColor}`}>{confidenceLevel}</span>
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-[#1a1a1a]">
          <span className="text-[#888888] text-sm">Final Score</span>
          <span className="text-xl font-mono text-white">{finalScore}%</span>
        </div>

        <div className="pt-1">
          <span className="text-[#888888] block mb-2 text-xs uppercase tracking-wider">Deployment URL</span>
          <a 
            href={report.deployment_url || "#"} 
            target="_blank" 
            rel="noreferrer"
            className="block w-full p-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-[#00ff88] font-mono text-xs hover:border-[#00ff88] transition-all duration-200 truncate"
          >
            {report.deployment_url || "Deployment Failed or Unavailable"}
          </a>
        </div>
      </div>
    </div>
  );
}
