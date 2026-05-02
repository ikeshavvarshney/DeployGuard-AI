"use client";
import React, { useState } from "react";

export default function MutantInspector({ mutants = [] }: { mutants: any[] }) {
  const [filter, setFilter] = useState("All");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getRiskLevel = (score: number) => {
    if (score >= 0.8) return { label: "HIGH", color: "text-[var(--danger-color)] bg-[var(--danger-color)]/10 border-[var(--danger-color)]" };
    if (score >= 0.5) return { label: "MEDIUM", color: "text-[var(--warning-color)] bg-[var(--warning-color)]/10 border-[var(--warning-color)]" };
    return { label: "LOW", color: "text-[var(--accent-color)] bg-[var(--accent-color)]/10 border-[var(--accent-color)]" };
  };

  const filteredMutants = mutants.filter(m => {
    if (filter === "All") return true;
    if (filter === "Killed") return m.status === "killed";
    if (filter === "Survived") return m.status === "survived";
    if (filter === "High Risk") return (m.risk_score || 0) >= 0.8;
    return true;
  }).slice(0, 20); // Capped at 20

  return (
    <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-6 shadow-xl flex flex-col h-full transition-all duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-[var(--text-primary-color)] font-mono">Mutant Inspector</h2>
        
        {/* Filter Bar */}
        <div className="flex gap-2">
          {["All", "Killed", "Survived", "High Risk"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                filter === f 
                  ? "bg-[var(--primary-color)] text-[var(--text-primary-color)] border-[var(--primary-color)]" 
                  : "bg-transparent text-[var(--text-muted-color)] border-[var(--border-color)] hover:border-[var(--primary-hover-color)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {filteredMutants.length === 0 ? (
          <div className="text-center text-[var(--text-muted-color)] py-8 font-mono text-sm">
            No mutants found matching criteria.
          </div>
        ) : (
          filteredMutants.map((mutant, i) => {
            const risk = getRiskLevel(mutant.risk_score || 0);
            const isExpanded = expandedCards[mutant.id || i];
            
            return (
              <div 
                key={mutant.id || i} 
                className="bg-[var(--surface-2-color)] border border-[var(--border-color)] rounded-lg overflow-hidden animate-in slide-in-from-left-4 fade-in"
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
              >
                {/* Card Header (Always visible) */}
                <div 
                  className="p-4 cursor-pointer hover:bg-[var(--surface-color)] transition-colors flex justify-between items-center"
                  onClick={() => toggleExpand(mutant.id || i)}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-[var(--text-primary-color)]">{mutant.fileName || "unknown.ts"}:{mutant.location?.start?.line || 0}</span>
                      <span className="text-xs bg-[var(--code-bg-color)] px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted-color)]">
                        {mutant.mutatorName || "UnknownMutator"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${risk.color}`}>
                        {risk.label} RISK
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                        mutant.status === 'killed' ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10 border-[var(--accent-color)]' :
                        mutant.status === 'survived' ? 'text-[var(--warning-color)] bg-[var(--warning-color)]/10 border-[var(--warning-color)]' :
                        'text-[var(--text-muted-color)] bg-[var(--surface-color)] border-[var(--border-color)]'
                      }`}>
                        {mutant.status ? mutant.status.toUpperCase() : "PENDING"}
                      </span>
                    </div>
                  </div>
                  <div className="text-[var(--text-muted-color)]">
                    {isExpanded ? "▲" : "▼"}
                  </div>
                </div>

                {/* Expanded Content (Diff) */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-color)] p-4 bg-[var(--code-bg-color)] font-mono text-xs overflow-x-auto">
                    <div className="flex flex-col gap-1">
                      <div className="text-[var(--danger-color)] bg-[var(--danger-color)]/5 px-2 py-1 rounded">
                        <span className="select-none opacity-50 mr-2">-</span>
                        <span className="line-through opacity-80">{mutant.replacement ? 'original code line' : mutant.original_code || '/* Original Code */'}</span>
                      </div>
                      <div className="text-[var(--accent-color)] bg-[var(--accent-color)]/5 px-2 py-1 rounded">
                        <span className="select-none opacity-50 mr-2">+</span>
                        <span>{mutant.replacement || mutant.mutated_code || '/* Mutated Code */'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
