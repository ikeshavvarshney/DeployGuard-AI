"use client";
import React, { useEffect, useState } from "react";

export default function MutationScore({ scoreBefore, scoreAfter }: { scoreBefore: number | null; scoreAfter: number | null }) {
  const [animBefore, setAnimBefore] = useState(0);
  const [animAfter, setAnimAfter] = useState(0);

  useEffect(() => {
    if (scoreBefore !== null) {
      let start = 0;
      const step = scoreBefore / 30; // animate over 30 frames
      const interval = setInterval(() => {
        start += step;
        if (start >= scoreBefore) {
          setAnimBefore(scoreBefore);
          clearInterval(interval);
        } else {
          setAnimBefore(Math.floor(start));
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [scoreBefore]);

  useEffect(() => {
    if (scoreAfter !== null) {
      let start = 0;
      const step = scoreAfter / 30;
      const interval = setInterval(() => {
        start += step;
        if (start >= scoreAfter) {
          setAnimAfter(scoreAfter);
          clearInterval(interval);
        } else {
          setAnimAfter(Math.floor(start));
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [scoreAfter]);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  
  const strokeDashoffsetBefore = circumference - ((animBefore || 0) / 100) * circumference;
  const strokeDashoffsetAfter = circumference - ((animAfter || 0) / 100) * circumference;

  return (
    <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary-color)] blur-[100px] opacity-10"></div>
      <h2 className="text-lg font-bold mb-6 text-[var(--text-muted-color)] font-mono">Mutation Score</h2>
      
      <div className="flex items-center justify-around text-center">
        {/* Before Donut */}
        <div className="relative flex flex-col items-center">
          <div className="text-[var(--text-muted-color)] text-xs mb-2 uppercase tracking-wider font-mono">Before AI</div>
          {scoreBefore !== null ? (
            <div className="relative w-24 h-24">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--surface-2-color)" strokeWidth="8" />
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--text-muted-color)" strokeWidth="8" 
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffsetBefore} strokeLinecap="round" className="transition-all duration-300" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-mono font-bold text-[var(--text-primary-color)]">{animBefore}%</span>
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 flex items-center justify-center bg-[var(--surface-2-color)] rounded-full animate-pulse">
              <span className="text-[var(--text-muted-color)] font-mono">--</span>
            </div>
          )}
        </div>

        <div className="text-[var(--primary-color)] text-3xl font-light">→</div>

        {/* After Donut */}
        <div className="relative flex flex-col items-center">
          <div className="text-[var(--text-muted-color)] text-xs mb-2 uppercase tracking-wider font-mono">After AI</div>
          {scoreAfter !== null ? (
            <div className="relative w-24 h-24">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--surface-2-color)" strokeWidth="8" />
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--accent-color)" strokeWidth="8" 
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffsetAfter} strokeLinecap="round" className="transition-all duration-300 shadow-[0_0_15px_var(--accent-color)]" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-mono font-bold text-[var(--accent-color)]">{animAfter}%</span>
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 flex items-center justify-center bg-[var(--surface-2-color)] rounded-full animate-pulse">
              <span className="text-[var(--text-muted-color)] font-mono">--</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
