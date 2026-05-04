"""
routers/pr_risk.py

Routes:
  POST /api/pr/repo/prs          → fetch all PRs for a repo (fast, no LLM)
  POST /api/pr/analyze            → start PR analysis job, return job_id
  GET  /api/pr/status/{job_id}    → poll job status + result
  POST /api/pr/merge              → merge PR via GitHub API (requires token)
"""

import asyncio
import traceback
import uuid
import re
import aiohttp
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from services.pr_analyzer import analyze_pr, fetch_all_prs

router = APIRouter()
_jobs: dict = {}


class RepoRequest(BaseModel):
    repo_url: str
    github_token: Optional[str] = None


class PRAnalyzeRequest(BaseModel):
    pr_url: str
    github_token: Optional[str] = None


class MergeRequest(BaseModel):
    pr_url: str
    github_token: str
    commit_message: Optional[str] = None


# ─── Fetch all PRs for a repo (fast, no LLM) ─────────────────────────────────

@router.post("/repo/prs")
async def get_repo_prs(request: Request):
    """Returns list of all PRs for navbar display. No job needed — fast GitHub API call only."""
    raw = await request.json()
    print(f"[PR ROUTER] /repo/prs body: {raw}")

    repo_url = raw.get("repo_url")
    if not repo_url:
        raise HTTPException(
            status_code=400,
            detail=f"Missing 'repo_url' field. Received keys: {list(raw.keys())}"
        )

    repo_url = repo_url.strip()
    github_token = raw.get("github_token")

    # Validate repo URL
    if not re.match(r"https://github\.com/[\w\-\.]+/[\w\-\.]+", repo_url):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid repo URL. Expected: https://github.com/owner/repo. Got: {repo_url}"
        )

    try:
        prs = await fetch_all_prs(repo_url, github_token)
        return {"prs": prs, "repo_url": repo_url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Start PR analysis job ────────────────────────────────────────────────────

@router.post("/analyze")
async def start_analysis(request: Request):
    raw = await request.json()
    print(f"[PR ROUTER] /analyze body: {raw}")

    pr_url = raw.get("pr_url")
    if not pr_url:
        raise HTTPException(
            status_code=400,
            detail=f"Missing 'pr_url' field. Received keys: {list(raw.keys())}. "
                   f"Expected: {{\"pr_url\": \"https://github.com/owner/repo/pull/123\"}}"
        )

    pr_url = pr_url.strip()
    github_token = raw.get("github_token")

    # Validate PR URL format
    pattern = r"https://github\.com/[\w\-\.]+/[\w\-\.]+/pull/\d+"
    if not re.match(pattern, pr_url):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid PR URL format. Expected: https://github.com/owner/repo/pull/123. Got: {pr_url}"
        )

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "result": None, "error": None}

    asyncio.get_running_loop().call_soon(
        lambda: asyncio.create_task(_run_job(job_id, pr_url, github_token))
    )

    print(f"[PR ROUTER] Job created: {job_id}")
    return {"job_id": job_id}


# ─── Poll job status ──────────────────────────────────────────────────────────

@router.get("/status/{job_id}")
async def get_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ─── Merge PR ─────────────────────────────────────────────────────────────────

@router.post("/merge")
async def merge_pr(body: MergeRequest):
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", body.pr_url)
    if not m:
        raise HTTPException(status_code=400, detail="Invalid PR URL")

    owner, repo, pr_number = m.group(1), m.group(2), m.group(3)
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/merge"

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "DeployGuard/1.0",
        "Authorization": f"Bearer {body.github_token}",
    }
    payload = {"merge_method": "merge"}
    if body.commit_message:
        payload["commit_message"] = body.commit_message

    try:
        async with aiohttp.ClientSession() as session:
            async with session.put(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                data = await resp.json()
                if resp.status == 200:
                    return {"merged": True, "message": data.get("message", "Merged"), "sha": data.get("sha", "")}
                else:
                    return {"merged": False, "message": data.get("message", "Merge failed"), "sha": ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Background job runner ───────────────────────────────────────────────────

async def _run_job(job_id: str, pr_url: str, github_token: Optional[str] = None):
    try:
        def _update_status(s: str):
            if job_id in _jobs:
                _jobs[job_id]["status"] = s

        _update_status("fetching")
        print(f"[PR ROUTER] Job {job_id} started — fetching {pr_url}")
        report = await analyze_pr(pr_url, github_token=github_token, status_cb=_update_status)
        _jobs[job_id] = {"status": "completed", "error": None, "result": report}
        print(f"[PR ROUTER] Job {job_id} completed successfully")

    except Exception as e:
        traceback.print_exc()
        print(f"[PR ROUTER] Job {job_id} FAILED: {e}")
        _jobs[job_id] = {"status": "failed", "error": str(e), "result": None}
