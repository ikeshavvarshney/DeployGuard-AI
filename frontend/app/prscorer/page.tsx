"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface RiskFactor { factor:string; severity:string; detail:string }
interface PRFile { filename:string; status:string; additions:number; deletions:number; changes:number; criticality_score:number; patch_preview:string }
interface PRCommit { sha:string; message:string; author:string; date:string }
interface Contributor { login:string; avatar_url:string; commits:number; additions:number; deletions:number }
interface Report {
  pr_url:string; pr_number:number; pr_title:string; pr_body:string; pr_state:string;
  base_branch:string; head_branch:string; created_at:string; updated_at:string;
  is_draft:boolean; mergeable:boolean|null; author:Contributor; reviewers:string[];
  assignees:string[]; files_changed:number; lines_added:number; lines_deleted:number;
  commits_count:number; comments_count:number; files:PRFile[]; commits:PRCommit[];
  contributors:Contributor[]; critical_files:string[]; new_dependencies:string[];
  test_coverage_ratio:number; risk_score:number; verdict:string; confidence:string;
  reasons:string[]; risk_factors:RiskFactor[]; suggestions:string[];
  merge_url:string; analyzed_at:string;
}

const STEPS = [
  { icon:"🔗", text:"Fetching PR metadata..." },
  { icon:"📊", text:"Analyzing diff statistics..." },
  { icon:"🧠", text:"Scoring merge risk with AI..." },
  { icon:"📋", text:"Building report..." },
];

const SEV:Record<string,{dot:string;color:string}> = {
  critical:{dot:"bg-red-500",color:"text-red-400"}, high:{dot:"bg-orange-500",color:"text-orange-400"},
  medium:{dot:"bg-yellow-500",color:"text-yellow-400"}, low:{dot:"bg-emerald-500",color:"text-emerald-400"},
};

function scoreColor(s:number) { return s<=25?"#22c55e":s<=50?"#eab308":s<=75?"#f97316":"#ef4444"; }
function verdictLabel(v:string) { return v.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
function relTime(d:string) { if(!d)return""; const ms=Date.now()-new Date(d).getTime(); const h=Math.floor(ms/36e5); return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`; }

function RiskRing({score}:{score:number}) {
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

function FileRow({f,owner,repo}:{f:PRFile;owner:string;repo:string}) {
  const [open,setOpen]=useState(false);
  const statusBg = f.status==="added"?"bg-emerald-500/15 text-emerald-400":f.status==="removed"?"bg-red-500/15 text-red-400":"bg-blue-500/15 text-blue-400";
  const bars = Array.from({length:10},(_,i)=>i<f.criticality_score);
  return(
    <div>
      <button onClick={()=>setOpen(v=>!v)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-800/60 text-left transition-all">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusBg}`}>{f.status==="added"?"+":f.status==="removed"?"-":"~"}</span>
        <span className="font-mono text-xs text-slate-300 flex-1 truncate">{f.filename}</span>
        <span className="hidden sm:flex gap-0.5">{bars.map((on,i)=><span key={i} className={`w-1.5 h-3 rounded-sm ${on?"bg-red-500/70":"bg-slate-700/50"}`}/>)}</span>
        <span className="text-[10px] font-mono text-emerald-400">+{f.additions}</span>
        <span className="text-[10px] font-mono text-red-400">-{f.deletions}</span>
        <svg className={`w-3 h-3 text-slate-500 transition-transform ${open?"rotate-90":""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>
      {open && f.patch_preview && (
        <pre className="mx-4 mb-2 p-3 rounded-lg bg-[#0d1117] text-[11px] font-mono overflow-x-auto custom-scroll leading-relaxed border border-slate-800/50">
          {f.patch_preview.split("\n").map((l,i)=><div key={i} className={l.startsWith("+")?"text-emerald-400":l.startsWith("-")?"text-red-400":"text-slate-500"}>{l}</div>)}
        </pre>
      )}
    </div>
  );
}

function ReportView({report:r,onReset}:{report:Report;onReset:()=>void}) {
  const [tab,setTab]=useState<"files"|"commits">("files");
  const [bodyOpen,setBodyOpen]=useState(false);
  const [mergeMsg,setMergeMsg]=useState(`Merge pull request #${r.pr_number}: ${r.pr_title}`);
  const [merging,setMerging]=useState(false);
  const [merged,setMerged]=useState<{sha:string}|null>(null);
  const [mergeErr,setMergeErr]=useState("");
  const [confirm,setConfirm]=useState(false);
  const [ghUser,setGhUser]=useState<{login:string;avatar_url:string}|null>(null);
  const token = typeof window!=="undefined"?localStorage.getItem("github_token"):null;
  const m = r.pr_url.match(/github\.com\/([^/]+)\/([^/]+)\/pull/);
  const owner=m?.[1]||"", repo=m?.[2]||"";

  useEffect(()=>{if(!token)return;fetch("https://api.github.com/user",{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(d.login)setGhUser(d)}).catch(()=>{})},[token]);

  const sortedFiles=[...r.files].sort((a,b)=>b.criticality_score-a.criticality_score);
  const vc = scoreColor(r.risk_score);
  const needsConfirm = r.risk_score>50;

  const doMerge=async()=>{
    if(!token)return; setMerging(true); setMergeErr("");
    try{
      const res=await fetch("/api/proxy/pr/merge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pr_url:r.pr_url,github_token:token,commit_message:mergeMsg})});
      const d=await res.json();
      if(d.merged)setMerged({sha:d.sha}); else setMergeErr(d.message||"Merge failed");
    }catch(e){setMergeErr("Network error")}finally{setMerging(false);setConfirm(false)}
  };

  return(
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans">
      <div className="sticky top-0 z-30 bg-[#080c12]/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onReset} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm">← New Analysis</button>
          <span className="text-xs font-mono text-slate-500 truncate max-w-xs">PR #{r.pr_number}</span>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Risk Score Hero */}
        <div className="flex flex-col items-center py-8 animate-in fade-in duration-500">
          <div className="relative"><RiskRing score={r.risk_score}/></div>
          <div className="mt-4"><span className="px-4 py-1.5 rounded-full text-sm font-bold" style={{background:`${vc}20`,color:vc}}>{verdictLabel(r.verdict)}</span></div>
          <div className="mt-4 space-y-1 text-center">{r.reasons.map((reason,i)=><p key={i} className="text-xs text-slate-400">• {reason}</p>)}</div>
        </div>
        {/* PR Header */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-3">
            {r.author.avatar_url&&<img src={r.author.avatar_url} className="w-8 h-8 rounded-full" alt=""/>}
            <div><span className="text-sm font-semibold text-slate-200">@{r.author.login}</span><span className="text-xs text-slate-500 ml-2">opened #{r.pr_number}</span></div>
            <div className="ml-auto flex gap-2">
              {r.is_draft&&<span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-300">DRAFT</span>}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.pr_state==="open"?"bg-emerald-500/20 text-emerald-400":r.pr_state==="merged"?"bg-purple-500/20 text-purple-400":"bg-red-500/20 text-red-400"}`}>{r.pr_state.toUpperCase()}</span>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">{r.pr_title}</h2>
          <div className="text-[11px] text-slate-500 font-mono mb-2">{r.base_branch} ← {r.head_branch} · {relTime(r.created_at)}</div>
          {r.pr_body&&(<><button onClick={()=>setBodyOpen(v=>!v)} className="text-xs text-slate-500 hover:text-slate-300">{bodyOpen?"Hide":"Show"} description</button>{bodyOpen&&<p className="mt-2 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{r.pr_body}</p>}</>)}
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[{l:"Files Changed",v:r.files_changed,c:"text-slate-300"},{l:"Lines",v:`+${r.lines_added} / -${r.lines_deleted}`,c:"text-slate-300"},{l:"Critical Files",v:r.critical_files.length,c:r.critical_files.length>3?"text-red-400":"text-slate-300"},{l:"New Deps",v:r.new_dependencies.length,c:"text-slate-300"}].map(s=>(
            <div key={s.l} className={`rounded-xl p-4 bg-slate-900/40 border border-slate-800/60 ${r.critical_files.length>3&&s.l==="Critical Files"?"ring-1 ring-red-500/30":""}`}>
              <div className={`text-2xl font-bold font-mono ${s.c}`}>{s.v}</div>
              <div className="text-xs text-slate-500 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
        {/* Risk Factors */}
        {r.risk_factors.length>0&&(
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/60 text-sm font-semibold text-slate-200">Risk Factors</div>
            <div className="p-2 space-y-1">{r.risk_factors.map((rf,i)=>{const s=SEV[rf.severity]||SEV.medium;return(
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-800/40 transition-all animate-in fade-in" style={{animationDelay:`${i*50}ms`,animationFillMode:"both"}}>
                <span className={`w-2 h-2 rounded-full mt-1.5 ${s.dot}`}/><div className="flex-1"><span className="text-sm text-slate-200">{rf.factor}</span><p className="text-xs text-slate-400 mt-0.5">{rf.detail}</p></div>
                <span className={`text-[10px] font-bold uppercase ${s.color}`}>{rf.severity}</span>
              </div>
            )})}</div>
          </div>
        )}
        {/* Files + Commits tabs */}
        <div>
          <div className="flex gap-1 mb-4 bg-slate-900/60 p-1 rounded-xl w-fit border border-slate-800">
            {(["files","commits"] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab===t?"bg-slate-700 text-slate-100":"text-slate-400 hover:text-slate-200"}`}>{t==="files"?`📁 Files (${r.files.length})`:`📝 Commits (${r.commits.length})`}</button>)}
          </div>
          {tab==="files"?(
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-800/30 p-2">{sortedFiles.map((f,i)=><FileRow key={f.filename} f={f} owner={owner} repo={repo}/>)}</div>
            </div>
          ):(
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-800/30">
              {r.commits.map(c=>(
                <div key={c.sha} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-all">
                  <a href={`https://github.com/${owner}/${repo}/commit/${c.sha}`} target="_blank" rel="noopener" className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white">{c.sha}</a>
                  <span className="text-sm text-slate-200 flex-1 truncate">{c.message}</span>
                  <span className="text-[11px] text-slate-500">{c.author} · {relTime(c.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Contributors */}
        {r.contributors&&r.contributors.length>0&&(
          <div className="flex gap-4 flex-wrap">{r.contributors.map(c=>(
            <div key={c.login} className="flex items-center gap-3 bg-slate-900/40 border border-slate-800/60 rounded-xl px-4 py-3">
              {c.avatar_url&&<img src={c.avatar_url} className="w-8 h-8 rounded-full" alt=""/>}
              <div><div className="text-sm font-semibold text-slate-200">@{c.login}</div><div className="text-[11px] text-slate-500">{c.commits} commits · <span className="text-emerald-400">+{c.additions}</span> <span className="text-red-400">-{c.deletions}</span></div></div>
            </div>
          ))}</div>
        )}
        {/* Suggestions */}
        {r.suggestions.length>0&&(
          <div className="bg-slate-900/40 border border-blue-500/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-blue-400 mb-3">💡 AI Suggestions</h3>
            <div className="space-y-2">{r.suggestions.map((s,i)=>(
              <div key={i} className="flex items-start gap-3"><span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span><span className="text-sm text-slate-300">{s}</span></div>
            ))}</div>
          </div>
        )}
        {/* Merge Section */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5">
          {merged?(
            <div className="text-center py-4 animate-in fade-in"><div className="text-2xl mb-2">✅</div><p className="text-emerald-400 font-semibold">Successfully merged!</p><p className="text-xs text-slate-500 mt-1 font-mono">SHA: {merged.sha}</p><a href={r.pr_url} target="_blank" className="text-xs text-blue-400 hover:underline mt-2 inline-block">View on GitHub ↗</a></div>
          ):!token?(
            <div className="text-center py-4"><p className="text-sm text-slate-400 mb-3">Sign in with GitHub to merge this PR</p><a href={`/api/proxy/auth/github?redirect=/prscorer`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold text-sm transition-all">Connect GitHub Account</a></div>
          ):(
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">{ghUser&&<img src={ghUser.avatar_url} className="w-5 h-5 rounded-full" alt=""/>}Merging as @{ghUser?.login||"..."}</div>
              <input value={mergeMsg} onChange={e=>setMergeMsg(e.target.value)} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-slate-500"/>
              {mergeErr&&<p className="text-xs text-red-400">{mergeErr}</p>}
              {confirm?(
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                  <p className="text-sm text-red-400 font-semibold">⚠️ Risk Score: {r.risk_score}/100 — {verdictLabel(r.verdict)}</p>
                  <p className="text-xs text-slate-400">This PR has elevated risk. Are you sure?</p>
                  <div className="flex gap-2"><button onClick={()=>setConfirm(false)} className="px-4 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs">Cancel</button><button onClick={doMerge} disabled={merging} className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold">{merging?"Merging...":"Merge Anyway"}</button></div>
                </div>
              ):(
                <button onClick={()=>needsConfirm?setConfirm(true):doMerge()} disabled={merging} className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5" style={{background:`${vc}20`,color:vc,border:`1px solid ${vc}40`}}>{merging?"Merging...":"Merge Pull Request"}</button>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-center"><button onClick={onReset} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">← Analyze another PR</button></div>
      </div>
    </div>
  );
}

function LoadingView({step}:{step:number}) {
  return(
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="relative w-14 h-14"><div className="absolute inset-0 rounded-full border-2 border-slate-800"/><div className="absolute inset-0 rounded-full border-2 border-t-slate-400 border-r-transparent border-b-transparent border-l-transparent animate-spin"/></div>
      <div className="w-full space-y-2">{STEPS.map((s,i)=>(
        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${i===step?"bg-slate-800/60 text-slate-200":i<step?"text-slate-600":"text-slate-700"}`}>
          <span className="text-base w-5 text-center">{s.icon}</span><span className="text-sm font-medium">{s.text}</span>
          {i<step&&<svg className="w-3.5 h-3.5 text-emerald-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          {i===step&&<span className="ml-auto flex gap-0.5">{[0,1,2].map(d=><span key={d} className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:`${d*150}ms`}}/>)}</span>}
        </div>
      ))}</div>
    </div>
  );
}

export default function PRScorerPage() {
  const [url,setUrl]=useState(""); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const [jobId,setJobId]=useState<string|null>(null); const [report,setReport]=useState<Report|null>(null); const [step,setStep]=useState(0);
  const router=useRouter(); const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{ref.current?.focus()},[]);
  useEffect(()=>{if(!loading)return;const iv=setInterval(()=>setStep(p=>Math.min(p+1,STEPS.length-1)),3000);return()=>clearInterval(iv)},[loading]);
  useEffect(()=>{if(!jobId)return;const iv=setInterval(async()=>{try{const r=await fetch(`/api/proxy/pr/status/${jobId}`);const d=await r.json();if(d.status==="completed"){setReport(d.result);setLoading(false);clearInterval(iv)}else if(d.status==="failed"){setError(d.error||"Failed");setLoading(false);clearInterval(iv)}}catch{}},2000);return()=>clearInterval(iv)},[jobId]);

  const analyze=async()=>{
    if(!url.trim()){setError("Enter a PR URL");return}
    setLoading(true);setError("");setJobId(null);setReport(null);setStep(0);
    try{
      const r=await fetch("/api/proxy/pr/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pr_url:url.trim()})});
      const d=await r.json();
      if(!r.ok){throw new Error(d?.detail||d?.error||`Server error ${r.status}`)}
      if(!d?.job_id){throw new Error(d?.detail||"No job_id returned")}
      setJobId(d.job_id)
    }catch(e){setError(e instanceof Error?e.message:"Error");setLoading(false)}
  };

  if(report)return<ReportView report={report} onReset={()=>{setReport(null);setUrl("")}}/>;

  return(
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage:"linear-gradient(#64748b 1px,transparent 1px),linear-gradient(90deg,#64748b 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>
      <div className="relative w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-400 mb-5 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"/>PR Risk Scorer · Pre-Merge Intelligence</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 mb-2 font-mono">⚡ PR Risk Scorer</h1>
          <p className="text-slate-500 text-sm">Analyzes PR metadata, scores file criticality,<br/>and classifies merge risk with AI.</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="p-6">
            {error&&<div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">{error}</div>}
            {loading?<LoadingView step={step}/>:(
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">GitHub Pull Request URL</label>
                  <input ref={ref} value={url} onChange={e=>{setUrl(e.target.value);setError("")}} onKeyDown={e=>e.key==="Enter"&&analyze()} placeholder="https://github.com/owner/repo/pull/123" className="w-full bg-slate-800/60 border border-slate-700 hover:border-slate-600 focus:border-slate-500 rounded-xl px-4 py-3.5 text-slate-200 placeholder-slate-600 font-mono text-sm focus:outline-none transition-colors"/>
                </div>
                <button onClick={analyze} className="w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-orange-900/40 to-slate-700 hover:from-orange-800/50 hover:to-slate-600 border border-orange-800/30 text-slate-100 shadow-lg transition-all duration-300 hover:-translate-y-0.5">⚡ Analyze PR Risk</button>
              </div>
            )}
          </div>
          {!loading&&<div className="border-t border-slate-800/60 px-6 py-3 flex items-center gap-4 text-[11px] text-slate-600"><span>📊 Diff analysis</span><span>🧠 AI scoring</span><span>🔀 One-click merge</span></div>}
        </div>
        <div className="mt-6 text-center"><button onClick={()=>router.push("/")} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">← Back to Home</button></div>
      </div>
    </div>
  );
}
