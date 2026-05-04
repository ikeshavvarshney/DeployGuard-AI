"use client";
import React, { useEffect, useRef } from "react";

export default function LogStream({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl flex-1 flex flex-col overflow-hidden transition-all duration-200">
      <div className="bg-[#111111] px-4 py-2 border-b border-[#1a1a1a] flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff4444]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#ffaa00]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#00ff88]" />
        <span className="ml-2 text-[10px] font-mono text-[#444444] tracking-wider">deployguard-pty</span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-0.5 h-full min-h-[200px] custom-scroll">
        {logs.length === 0 && (
          <div className="text-[#444444] italic text-xs">Waiting for logs...</div>
        )}
        {logs.map((log, i) => {
          const isError = log.includes("ERROR") || log.includes("failed") || log.includes("Failed");
          return (
            <div 
              key={i} 
              className={`leading-relaxed ${isError ? "text-[#ff4444]" : "text-[#00ff88]/80"}`}
            >
              <span className="text-[#333333] mr-2 select-none">~</span>
              {log}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
