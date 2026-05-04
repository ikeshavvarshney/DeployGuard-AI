"use client";
import { PRListItem, relTime } from "./types";

interface Props {
  prs: PRListItem[];
  selectedPR: number|null;
  analyzedPRs: Map<number,number>; // pr_number -> risk_score
  onSelectPR: (pr:PRListItem)=>void;
}

const stateDot:Record<string,string> = { open:"bg-emerald-500", merged:"bg-purple-500", closed:"bg-slate-500" };
const stateLabel:Record<string,string> = { open:"Open", merged:"Merged", closed:"Closed" };

export function PRNavbar({ prs, selectedPR, analyzedPRs, onSelectPR }:Props) {
  // Group by state: open first, merged, closed
  const grouped:{state:string; items:PRListItem[]}[] = [];
  for(const st of ["open","merged","closed"]) {
    const items = prs.filter(p=>p.state===st);
    if(items.length) grouped.push({state:st, items});
  }

  return(
    <div className="w-full h-full overflow-y-auto custom-scroll space-y-1 pr-1">
      {grouped.map(g=>(
        <div key={g.state}>
          <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-[#080c12]/95 backdrop-blur-sm z-10">
            <span className={`w-2 h-2 rounded-full ${stateDot[g.state]}`}/>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stateLabel[g.state]} ({g.items.length})</span>
          </div>
          {g.items.map((pr,i)=>{
            const isSelected = selectedPR===pr.pr_number;
            const cachedScore = analyzedPRs.get(pr.pr_number);
            return(
              <button
                key={pr.pr_number}
                onClick={()=>onSelectPR(pr)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group ${isSelected?"bg-slate-800/80 ring-1 ring-slate-600":"hover:bg-slate-800/40"}`}
                style={{animationDelay:`${i*30}ms`,animationFillMode:"both"}}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${stateDot[pr.state]}`}/>
                  <span className="text-xs font-bold text-slate-400 font-mono">#{pr.pr_number}</span>
                  {pr.is_draft&&<span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">DRAFT</span>}
                  {cachedScore!==undefined&&(
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold font-mono" style={{
                      background: cachedScore<=25?"rgba(34,197,94,0.15)":cachedScore<=50?"rgba(234,179,8,0.15)":cachedScore<=75?"rgba(249,115,22,0.15)":"rgba(239,68,68,0.15)",
                      color: cachedScore<=25?"#22c55e":cachedScore<=50?"#eab308":cachedScore<=75?"#f97316":"#ef4444",
                    }}>{cachedScore}</span>
                  )}
                </div>
                <div className="text-sm text-slate-200 truncate leading-snug mb-1">{pr.title.length>40?pr.title.slice(0,40)+"...":pr.title}</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                  <span>@{pr.author}</span>
                  {pr.changed_files>0&&<span>{pr.changed_files} files</span>}
                  {(pr.additions>0||pr.deletions>0)&&<span className="font-mono"><span className="text-emerald-600">+{pr.additions}</span> <span className="text-red-600">-{pr.deletions}</span></span>}
                  <span className="ml-auto">{relTime(pr.updated_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
      {prs.length===0&&<div className="text-center text-sm text-slate-600 py-8">No PRs found</div>}
    </div>
  );
}
