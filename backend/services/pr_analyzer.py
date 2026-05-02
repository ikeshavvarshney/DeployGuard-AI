"""
services/pr_analyzer.py

PR Risk Scorer — Pre-Merge Intelligence Pipeline
  parse PR URL → fetch metadata (3 concurrent GitHub API calls)
  → deterministic analysis (file criticality, stats)
  → LLM risk classification (structured summary only, never raw code)
  → build PRRiskReport
"""

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import Optional

import aiohttp

from services.ollama_client import get_completion

# ─── GitHub API Helpers ───────────────────────────────────────────────────────

GITHUB_API = "https://api.github.com"
UA_HEADERS = {"Accept": "application/vnd.github+json", "User-Agent": "DeployGuard/1.0"}


def parse_pr_url(url: str) -> tuple[str, str, int]:
    """Parse owner, repo, pr_number from a GitHub PR URL."""
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", url.strip())
    if not m:
        raise ValueError(f"Invalid GitHub PR URL: {url}")
    return m.group(1), m.group(2), int(m.group(3))


def _build_headers(token: Optional[str] = None) -> dict:
    headers = dict(UA_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _gh_get(session: aiohttp.ClientSession, url: str, headers: dict):
    async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        if resp.status != 200:
            text = await resp.text()
            raise RuntimeError(f"GitHub API {resp.status}: {text[:200]}")
        return await resp.json()


# ─── File Criticality Scoring ─────────────────────────────────────────────────

CRITICAL_PATTERNS = [
    r"auth", r"login", r"oauth", r"jwt", r"session",
    r"password", r"secret", r"key", r"token",
    r"db", r"database", r"migration", r"schema",
    r"config", r"env", r"settings",
    r"payment", r"billing", r"stripe",
    r"admin", r"permission", r"role",
]


def score_file_criticality(filename: str) -> int:
    score = 0
    lower = filename.lower()
    for pattern in CRITICAL_PATTERNS:
        if re.search(pattern, lower):
            score += 2
    if lower.endswith((".env", ".key", ".pem")):
        score += 5
    return min(score, 10)


def _is_test_file(filename: str) -> bool:
    lower = filename.lower()
    return bool(re.search(r"(test|spec|__tests__|\.test\.|\.spec\.)", lower))


def _is_config_file(filename: str) -> bool:
    lower = filename.lower()
    cfg = (".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".env")
    names = ("dockerfile", "makefile", ".dockerignore", ".gitignore", ".eslintrc")
    return lower.endswith(cfg) or any(lower.endswith(n) for n in names)


def _is_binary(filename: str) -> bool:
    return filename.lower().endswith((
        ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
        ".woff", ".woff2", ".ttf", ".eot", ".otf",
        ".zip", ".tar", ".gz", ".pdf", ".exe", ".dll",
    ))


# ─── Deterministic Analysis ──────────────────────────────────────────────────

def compute_deterministic_summary(pr_data: dict, files_data: list, commits_data: list) -> dict:
    files_changed = len(files_data)
    lines_added = sum(f.get("additions", 0) for f in files_data)
    lines_deleted = sum(f.get("deletions", 0) for f in files_data)

    test_files = [f for f in files_data if _is_test_file(f["filename"])]
    source_files = [f for f in files_data if not _is_test_file(f["filename"])]
    config_files = [f for f in files_data if _is_config_file(f["filename"])]
    binary_files = [f for f in files_data if _is_binary(f["filename"])]

    critical_files = []
    critical_score = 0
    for f in files_data:
        cs = score_file_criticality(f["filename"])
        if cs > 0:
            critical_files.append(f["filename"])
            critical_score += cs

    # Unique contributors
    contributors = list({
        c.get("author", {}).get("login", c.get("commit", {}).get("author", {}).get("name", "unknown"))
        for c in commits_data if c.get("author") or c.get("commit", {}).get("author")
    })

    # New/removed deps from package.json or requirements.txt diffs
    new_deps, removed_deps = [], []
    for f in files_data:
        if f["filename"] in ("package.json", "requirements.txt") and f.get("patch"):
            for line in f["patch"].split("\n"):
                if line.startswith("+") and not line.startswith("+++"):
                    dep = re.search(r'"([^"]+)":\s*"', line) or re.search(r'^[+]\s*([a-zA-Z0-9_-]+)', line)
                    if dep:
                        new_deps.append(dep.group(1))
                elif line.startswith("-") and not line.startswith("---"):
                    dep = re.search(r'"([^"]+)":\s*"', line) or re.search(r'^[-]\s*([a-zA-Z0-9_-]+)', line)
                    if dep:
                        removed_deps.append(dep.group(1))

    has_lockfile = any(f["filename"].endswith((".lock", "package-lock.json", "yarn.lock")) for f in files_data)
    largest_delta = max((f.get("changes", 0) for f in files_data), default=0)

    file_types: dict[str, int] = {}
    for f in files_data:
        ext = os.path.splitext(f["filename"])[1] or "(none)"
        file_types[ext] = file_types.get(ext, 0) + 1

    test_ratio = len(test_files) / max(files_changed, 1)

    return {
        "files_changed": files_changed,
        "lines_added": lines_added,
        "lines_deleted": lines_deleted,
        "net_lines": lines_added - lines_deleted,
        "commits_count": len(commits_data),
        "contributors": contributors,
        "test_files_changed": len(test_files),
        "source_files_changed": len(source_files),
        "test_coverage_ratio": round(test_ratio, 2),
        "new_dependencies": new_deps[:20],
        "removed_dependencies": removed_deps[:20],
        "critical_files_touched": critical_files[:30],
        "critical_files_score": critical_score,
        "config_files_changed": len(config_files),
        "has_lockfile_change": has_lockfile,
        "largest_file_delta": largest_delta,
        "binary_files_changed": len(binary_files),
        "file_types": file_types,
    }


# ─── LLM Risk Classification ─────────────────────────────────────────────────

async def classify_risk(summary: dict) -> dict:
    prompt = f"""You are a senior code reviewer. Assess merge risk based purely on change metrics.

PR Analysis Summary:
{json.dumps(summary, indent=2)}

Classify merge risk and respond ONLY with JSON (no markdown):
{{
  "score": <0-100 integer>,
  "verdict": "safe_to_merge" | "needs_review" | "high_risk" | "block_merge",
  "confidence": "high" | "medium" | "low",
  "reasons": ["reason1", "reason2", "reason3"],
  "risk_factors": [
    {{"factor": "name", "severity": "critical|high|medium|low", "detail": "one sentence"}}
  ],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2"]
}}"""

    try:
        response = await get_completion(prompt, model_key="reasoning", max_tokens=1024, temperature=0.1)
        clean = re.sub(r"```[a-z]*\n?", "", response).strip().strip("`").strip()
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
            # Validate required fields
            score = int(parsed.get("score", 50))
            score = max(0, min(100, score))
            return {
                "score": score,
                "verdict": parsed.get("verdict", _verdict_from_score(score)),
                "confidence": parsed.get("confidence", "medium"),
                "reasons": parsed.get("reasons", [])[:5],
                "risk_factors": parsed.get("risk_factors", [])[:10],
                "suggestions": parsed.get("suggestions", [])[:5],
            }
    except Exception as e:
        print(f"[PR ANALYZER] LLM classification failed: {e}")

    # Fallback: heuristic scoring
    score = _heuristic_score(summary)
    return {
        "score": score,
        "verdict": _verdict_from_score(score),
        "confidence": "low",
        "reasons": ["LLM classification unavailable — using heuristic scoring"],
        "risk_factors": [],
        "suggestions": ["Review the PR manually"],
    }


def _verdict_from_score(score: int) -> str:
    if score <= 25: return "safe_to_merge"
    if score <= 50: return "needs_review"
    if score <= 75: return "high_risk"
    return "block_merge"


def _heuristic_score(summary: dict) -> int:
    score = 20  # baseline
    if summary["files_changed"] > 20: score += 15
    if summary["lines_added"] > 500: score += 10
    if summary["critical_files_score"] > 5: score += 15
    if summary["test_coverage_ratio"] < 0.1: score += 10
    if summary["config_files_changed"] > 2: score += 5
    if len(summary["new_dependencies"]) > 3: score += 10
    if summary["largest_file_delta"] > 300: score += 5
    return min(score, 100)


# ─── Build Report ─────────────────────────────────────────────────────────────

def build_report(
    pr_url: str, pr_data: dict, files_data: list,
    commits_data: list, risk: dict, summary: dict,
) -> dict:
    owner, repo, pr_number = parse_pr_url(pr_url)
    author_data = pr_data.get("user", {})

    # Build contributor stats
    contrib_map: dict[str, dict] = {}
    for c in commits_data:
        login = (c.get("author") or {}).get("login", c.get("commit", {}).get("author", {}).get("name", "unknown"))
        avatar = (c.get("author") or {}).get("avatar_url", "")
        if login not in contrib_map:
            contrib_map[login] = {"login": login, "avatar_url": avatar, "commits": 0, "additions": 0, "deletions": 0}
        contrib_map[login]["commits"] += 1
    # We don't have per-commit additions from the commits endpoint, approximate from files
    if len(contrib_map) == 1:
        sole = list(contrib_map.values())[0]
        sole["additions"] = summary["lines_added"]
        sole["deletions"] = summary["lines_deleted"]

    files = []
    for f in files_data:
        patch = f.get("patch", "")
        files.append({
            "filename": f["filename"],
            "status": f.get("status", "modified"),
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
            "changes": f.get("changes", 0),
            "criticality_score": score_file_criticality(f["filename"]),
            "patch_preview": patch[:300] if patch else "",
        })

    commits = []
    for c in commits_data[:50]:
        commits.append({
            "sha": c.get("sha", "")[:7],
            "message": (c.get("commit", {}).get("message", "") or "")[:100],
            "author": (c.get("author") or {}).get("login", c.get("commit", {}).get("author", {}).get("name", "unknown")),
            "date": c.get("commit", {}).get("author", {}).get("date", ""),
        })

    return {
        "pr_url": pr_url,
        "pr_number": pr_number,
        "pr_title": pr_data.get("title", ""),
        "pr_body": (pr_data.get("body") or "")[:500],
        "pr_state": pr_data.get("state", "unknown"),
        "base_branch": pr_data.get("base", {}).get("ref", ""),
        "head_branch": pr_data.get("head", {}).get("ref", ""),
        "created_at": pr_data.get("created_at", ""),
        "updated_at": pr_data.get("updated_at", ""),
        "is_draft": pr_data.get("draft", False),
        "mergeable": pr_data.get("mergeable"),
        "author": {
            "login": author_data.get("login", "unknown"),
            "avatar_url": author_data.get("avatar_url", ""),
            "commits": len(commits_data),
            "additions": summary["lines_added"],
            "deletions": summary["lines_deleted"],
        },
        "reviewers": [r.get("login", "") for r in pr_data.get("requested_reviewers", [])],
        "assignees": [a.get("login", "") for a in pr_data.get("assignees", [])],
        "files_changed": summary["files_changed"],
        "lines_added": summary["lines_added"],
        "lines_deleted": summary["lines_deleted"],
        "commits_count": summary["commits_count"],
        "comments_count": pr_data.get("comments", 0) + pr_data.get("review_comments", 0),
        "files": files,
        "commits": commits,
        "contributors": list(contrib_map.values()),
        "critical_files": summary["critical_files_touched"],
        "new_dependencies": summary["new_dependencies"],
        "test_coverage_ratio": summary["test_coverage_ratio"],
        "risk_score": risk["score"],
        "verdict": risk["verdict"],
        "confidence": risk["confidence"],
        "reasons": risk["reasons"],
        "risk_factors": risk.get("risk_factors", []),
        "suggestions": risk.get("suggestions", []),
        "merge_url": f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}/merge",
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── Main Pipeline ────────────────────────────────────────────────────────────

async def analyze_pr(pr_url: str, github_token: Optional[str] = None, status_cb=None) -> dict:
    def _update(s: str):
        if status_cb: status_cb(s)

    owner, repo, pr_number = parse_pr_url(pr_url)
    headers = _build_headers(github_token)

    _update("fetching")
    async with aiohttp.ClientSession() as session:
        pr_data, files_data, commits_data = await asyncio.gather(
            _gh_get(session, f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}", headers),
            _gh_get(session, f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}/files", headers),
            _gh_get(session, f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}/commits", headers),
        )

    _update("analyzing")
    summary = compute_deterministic_summary(pr_data, files_data, commits_data)
    print(f"[PR ANALYZER] {summary['files_changed']} files, +{summary['lines_added']}/-{summary['lines_deleted']}")

    risk = await classify_risk(summary)
    print(f"[PR ANALYZER] Score: {risk['score']}, Verdict: {risk['verdict']}")

    _update("completed")
    return build_report(pr_url, pr_data, files_data, commits_data, risk, summary)
