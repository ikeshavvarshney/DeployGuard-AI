export interface RiskFactor { factor:string; severity:string; detail:string }
export interface PRFile { filename:string; status:string; additions:number; deletions:number; changes:number; criticality_score:number; patch_preview:string }
export interface PRCommit { sha:string; message:string; author:string; date:string }
export interface Contributor { login:string; avatar_url:string; commits:number; additions:number; deletions:number }

export interface Report {
  pr_url:string; pr_number:number; pr_title:string; pr_body:string; pr_state:string;
  base_branch:string; head_branch:string; created_at:string; updated_at:string;
  is_draft:boolean; mergeable:boolean|null; author:Contributor; reviewers:string[];
  assignees:string[]; files_changed:number; lines_added:number; lines_deleted:number;
  commits_count:number; comments_count:number; files:PRFile[]; commits:PRCommit[];
  contributors:Contributor[]; critical_files:string[]; new_dependencies:string[];
  test_coverage_ratio:number; risk_score:number; verdict:string; confidence:string;
  reasons:string[]; risk_factors:RiskFactor[]; suggestions:string[];
  raw_llm_output:string; tokens_used:number; prompt_tokens:number; response_tokens:number;
  merge_url:string; analyzed_at:string;
}

export interface PRListItem {
  pr_number:number; title:string; state:string; is_draft:boolean;
  author:string; author_avatar:string; created_at:string; updated_at:string;
  base_branch:string; head_branch:string; pr_url:string;
  comments:number; review_comments:number; commits:number;
  additions:number; deletions:number; changed_files:number;
  mergeable:boolean|null;
}

export interface GithubUser { login:string; avatar_url:string; name:string }

export function scoreColor(s:number) { return s<=25?"#22c55e":s<=50?"#eab308":s<=75?"#f97316":"#ef4444"; }
export function verdictLabel(v:string) { return v.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
export function relTime(d:string) { if(!d)return""; const ms=Date.now()-new Date(d).getTime(); const m=Math.floor(ms/60000); if(m<60)return`${m}m ago`; const h=Math.floor(m/60); return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`; }
