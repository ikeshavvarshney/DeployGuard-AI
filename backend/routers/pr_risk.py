"""
routers/pr_risk.py

Routes:
  POST /api/pr/analyze         → start PR analysis job, return job_id
  GET  /api/pr/status/{job_id} → poll job status + result
  POST /api/pr/merge           → merge PR via GitHub API (requires token)
"""

import asyncio
import uuid
import re
import aiohttp
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.pr_analyzer import analyze_pr

router = APIRouter()
_jobs: dict = {}


class PRRequest(BaseModel):
    pr_url: str
    github_token: Optional[str] = None


class MergeRequest(BaseModel):
    pr_url: str
    github_token: str
    commit_message: Optional[str] = None


@router.post("/analyze")
async def start_analysis(body: PRRequest):
    # Validate PR URL format
    if not re.match(r"https://github\.com/[^/]+/[^/]+/pull/\d+", body.pr_url):
        raise HTTPException(status_code=400, detail="Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/123")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "result": None, "error": None}

    asyncio.get_running_loop().call_soon(
        lambda: asyncio.create_task(_run_job(job_id, body.pr_url, body.github_token))
    )
    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def get_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


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


async def _run_job(job_id: str, pr_url: str, github_token: Optional[str]):
    try:
        def _update_status(s: str):
            if job_id in _jobs:
                _jobs[job_id]["status"] = s

        report = await analyze_pr(pr_url, github_token=github_token, status_cb=_update_status)
        _jobs[job_id] = {"status": "completed", "error": None, "result": report}

    except Exception as e:
        print(f"[PR ROUTER] Job {job_id} failed: {e}")
        _jobs[job_id] = {"status": "failed", "error": str(e), "result": None}
