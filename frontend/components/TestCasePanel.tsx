"use client";
import React, { useState } from "react";

export default function TestCasePanel({ tests = [] }: { tests: any[] }) {
  const [tab, setTab] = useState("All Tests");

  const filteredTests = tests.filter(t => {
    if (tab === "All Tests") return true;
    if (tab === "Verified") return t.verified === true;
    if (tab === "Failed") return t.verified === false;
    return true;
  });

  return (
    <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-6 shadow-xl flex flex-col h-full transition-all duration-300">
      <div className="flex justify-between items-center mb-6 border-b border-[var(--border-color)] pb-2">
        <h2 className="text-lg font-bold text-[var(--text-primary-color)] font-mono">AI Test Cases</h2>
        
        {/* Tabs */}
        <div className="flex gap-4">
          {["All Tests", "Verified", "Failed"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm font-mono pb-2 border-b-2 transition-colors ${
                tab === t 
                  ? "text-[var(--primary-color)] border-[var(--primary-color)]" 
                  : "text-[var(--text-muted-color)] border-transparent hover:text-[var(--text-primary-color)]"
              }`}
            >
              {t} {t === "All Tests" ? `(${tests.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {filteredTests.length === 0 ? (
          <div className="text-center text-[var(--text-muted-color)] py-8 font-mono text-sm">
            No test cases found.
          </div>
        ) : (
          filteredTests.map((test, i) => (
            <div 
              key={i} 
              className="bg-[var(--surface-2-color)] border border-[var(--border-color)] rounded-lg overflow-hidden animate-in zoom-in-95 fade-in"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
            >
              <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-start bg-[var(--surface-color)]">
                <div>
                  <div className="font-mono text-sm text-[var(--text-primary-color)] mb-2">
                    Target Mutant: <span className="text-[var(--primary-hover-color)]">{test.mutant_id || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-muted-color)]">Confidence:</span>
                    <div className="w-24 h-1.5 bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--border-color)]">
                      <div 
                        className="h-full bg-[var(--primary-color)] shadow-[0_0_5px_var(--primary-color)]" 
                        style={{ width: `${(test.confidence || Math.random()) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {test.verified === true ? (
                    <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-color)]/10 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]"></span> VERIFIED
                    </span>
                  ) : test.verified === false ? (
                    <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--danger-color)] text-[var(--danger-color)] bg-[var(--danger-color)]/10 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger-color)]"></span> FAILED
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--warning-color)] text-[var(--warning-color)] bg-[var(--warning-color)]/10 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning-color)] animate-ping"></span> PENDING
                    </span>
                  )}

                  {test.kills_mutant && (
                    <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--primary-color)] text-[var(--primary-color)] bg-[var(--primary-color)]/10 font-bold">
                      KILLS MUTANT
                    </span>
                  )}
                </div>
              </div>
              
              {/* Code Snippet */}
              <div className="p-4 bg-[var(--code-bg-color)] font-mono text-xs overflow-x-auto text-[var(--text-primary-color)]">
                <pre className="m-0">
                  <code>{test.code || test.test_code || `test('should handle edge case', () => {\n  expect(true).toBe(true);\n});`}</code>
                </pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
