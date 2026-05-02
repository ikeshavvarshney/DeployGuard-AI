"""
routers/env_sheriff.py

Routes:
  POST /api/sheriff/analyze      → start secret scan job, return job_id
  GET  /api/sheriff/status/{job_id} → poll job status + result
"""

import asyncio
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.env_sheriff_agent import run_sheriff_pipeline

router = APIRouter()

# In-memory job store (same pattern as dependencies router)
_jobs: dict = {}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SheriffRequest(BaseModel):
    repo_url: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def start(body: SheriffRequest):
    if not body.repo_url.startswith("https://github.com/"):
        raise HTTPException(status_code=400, detail="Only GitHub URLs supported")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "result": None, "error": None}

    # Fire and forget — same pattern as dependencies router
    asyncio.get_running_loop().call_soon(
        lambda: asyncio.create_task(_run_job(job_id, body.repo_url))
    )

    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ─── Background runner ────────────────────────────────────────────────────────

async def _run_job(job_id: str, repo_url: str):
    try:
        def _update_status(new_status: str):
            if job_id in _jobs:
                _jobs[job_id]["status"] = new_status

        report = await run_sheriff_pipeline(
            repo_url,
            status_cb=_update_status,
        )

        # Serialize findings for frontend
        _jobs[job_id] = {
            "status": "completed",
            "error": None,
            "result": {
                "repo_url": report.repo_url,
                "scanned_files": report.scanned_files,
                "total_findings": report.total_findings,
                "real_secrets": report.real_secrets,
                "false_positives": report.false_positives,
                "needs_review": report.needs_review,
                "exposure_risk": report.exposure_risk,
                "analyzed_at": report.analyzed_at,
                "env_example": report.env_example,
                "remediation_checklist": report.remediation_checklist,
                "findings": [
                    {
                        "file": f.file,
                        "line": f.line,
                        "column": f.column,
                        "match_preview": f.match_preview,
                        "pattern_name": f.pattern_name,
                        "entropy": f.entropy,
                        "classification": f.classification,
                        "reason": f.reason,
                        "rotate_immediately": f.rotate_immediately,
                    }
                    for f in report.findings
                ],
            },
        }

    except Exception as e:
        print(f"[SHERIFF ROUTER] Job {job_id} failed: {e}")
        _jobs[job_id] = {
            "status": "failed",
            "error": str(e),
            "result": None,
        }
