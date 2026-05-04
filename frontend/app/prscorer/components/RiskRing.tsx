"use client";
import { useState, useEffect } from "react";
import { scoreColor } from "./types";

export function RiskRing({score}:{score:number}) {
  const [cur,setCur]=useState(0);
  const r=54, circ=2*Math.PI*r;
  useEffect(()=>{let f=0;const id=requestAnimationFrame(function a(){f++;const p=Math.min(f/60,1);const e=1-Math.pow(1-p,3);setCur(Math.round(score*e));if(p<1)requestAnimationFrame(a)});return()=>cancelAnimationFrame(id)},[score]);
  const offset=circ-(cur/100)*circ;
  return(
    <div className="flex flex-col items-center gap-3">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#1e293b" strokeWidth="10"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={scoreColor(cur)} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-100"/>
      </svg>
      <div className="absolute mt-8 flex flex-col items-center">
        <span className="text-4xl font-bold font-mono" style={{color:scoreColor(cur)}}>{cur}</span>
        <span className="text-xs text-slate-500">/100</span>
      </div>
    </div>
  );
}

const STEPS = [
  { icon:"🔗", text:"Fetching PR metadata..." },
  { icon:"📊", text:"Analyzing diff statistics..." },
  { icon:"🧠", text:"Scoring merge risk with AI..." },
  { icon:"📋", text:"Building report..." },
];

export function LoadingView({step}:{step:number}) {
  return(
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative w-14 h-14"><div className="absolute inset-0 rounded-full border-2 border-slate-800"/><div className="absolute inset-0 rounded-full border-2 border-t-slate-400 border-r-transparent border-b-transparent border-l-transparent animate-spin"/></div>
      <div className="w-full max-w-sm space-y-2">{STEPS.map((s,i)=>(
        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${i===step?"bg-slate-800/60 text-slate-200":i<step?"text-slate-600":"text-slate-700"}`}>
          <span className="text-base w-5 text-center">{s.icon}</span><span className="text-sm font-medium">{s.text}</span>
          {i<step&&<svg className="w-3.5 h-3.5 text-emerald-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          {i===step&&<span className="ml-auto flex gap-0.5">{[0,1,2].map(d=><span key={d} className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:`${d*150}ms`}}/>)}</span>}
        </div>
      ))}</div>
    </div>
  );
}
