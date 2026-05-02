"use client";
import React, { useEffect, useRef } from "react";

export default function LogStream({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-[var(--code-bg-color)] border border-[var(--border-color)] rounded-xl flex-1 flex flex-col overflow-hidden shadow-2xl transition-all duration-300 hover:scale-[1.01]">
      <div className="bg-[var(--surface-color)] px-4 py-2 border-b border-[var(--border-color)] flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-[var(--danger-color)] hover:opacity-80 transition-opacity"></div>
        <div className="w-3 h-3 rounded-full bg-[var(--warning-color)] hover:opacity-80 transition-opacity"></div>
        <div className="w-3 h-3 rounded-full bg-[var(--accent-color)] hover:opacity-80 transition-opacity"></div>
        <span className="ml-2 text-xs font-mono text-[var(--text-muted-color)] tracking-wider">deployguard-pty</span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto font-mono text-sm space-y-1 h-full min-h-[200px]">
        {logs.length === 0 && (
          <div className="text-[var(--text-muted-color)] italic opacity-50">Waiting for logs...</div>
        )}
        {logs.map((log, i) => {
          const isError = log.includes("ERROR") || log.includes("failed") || log.includes("Failed");
          return (
            <div 
              key={i} 
              className={`animate-in fade-in duration-300 ${isError ? "text-[var(--danger-color)]" : "text-[var(--accent-color)]"}`}
            >
              <span className="text-[var(--text-muted-color)] mr-3 opacity-50 select-none">~</span>
              {log}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
