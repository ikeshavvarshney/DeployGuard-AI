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
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 relative overflow-hidden transition-all duration-200">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ff88] blur-[80px] opacity-5" />
      <h2 className="text-xs font-bold mb-5 text-[#888888] uppercase tracking-wider">Mutation Score</h2>
      
      <div className="flex items-center justify-around text-center">
        {/* Before Donut */}
        <div className="relative flex flex-col items-center">
          <div className="text-[#444444] text-[10px] mb-2 uppercase tracking-wider font-mono">Before AI</div>
          {scoreBefore !== null ? (
            <div className="relative w-20 h-20">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#1a1a1a" strokeWidth="8" />
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#888888" strokeWidth="8" 
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffsetBefore} strokeLinecap="round" className="transition-all duration-300" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-mono font-bold text-white">{animBefore}%</span>
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 flex items-center justify-center bg-[#1a1a1a] rounded-full animate-pulse">
              <span className="text-[#444444] font-mono">--</span>
            </div>
          )}
        </div>

        <div className="text-[#00ff88] text-2xl font-light">→</div>

        {/* After Donut */}
        <div className="relative flex flex-col items-center">
          <div className="text-[#444444] text-[10px] mb-2 uppercase tracking-wider font-mono">After AI</div>
          {scoreAfter !== null ? (
            <div className="relative w-20 h-20">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#1a1a1a" strokeWidth="8" />
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#00ff88" strokeWidth="8" 
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffsetAfter} strokeLinecap="round" className="transition-all duration-300" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-mono font-bold text-[#00ff88]">{animAfter}%</span>
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 flex items-center justify-center bg-[#1a1a1a] rounded-full animate-pulse">
              <span className="text-[#444444] font-mono">--</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
