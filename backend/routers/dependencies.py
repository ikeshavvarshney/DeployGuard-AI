"""
routers/dependencies.py

Routes:
  POST /api/deps/analyze   → start analysis job, return job_id
  GET  /api/deps/status/{job_id} → poll job status + result
"""

import asyncio
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pipeline.dependency_agent import analyze

router = APIRouter()

# In-memory job store (same pattern as main.py jobs dict)
_dep_jobs: dict = {}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class DepAnalyzeRequest(BaseModel):
    repo_url: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def start_analysis(body: DepAnalyzeRequest):
    if not body.repo_url.startswith("https://github.com/"):
        raise HTTPException(status_code=400, detail="Only GitHub URLs supported")

    job_id = str(uuid.uuid4())
    _dep_jobs[job_id] = {"status": "pending", "result": None, "error": None}

    # Fire and forget — same pattern as main.py
    asyncio.get_running_loop().call_soon(
        lambda: asyncio.create_task(_run_job(job_id, body.repo_url))
    )

    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def get_status(job_id: str):
    job = _dep_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ─── Background runner ────────────────────────────────────────────────────────

async def _run_job(job_id: str, repo_url: str):
    try:
        report = await analyze(repo_url)

        # Shape report to match what frontend expects
        _dep_jobs[job_id] = {
            "status": "completed",
            "error": None,
            "result": {
                "repo_url": report.repo_url,
                "analyzed_at": report.analyzed_at,
                "summary": {
                    "critical": report.critical_count,
                    "high": report.high_count,
                    "medium": report.medium_count,
                    "low": report.low_count,
                    "total_outdated": report.total_outdated,
                },
                "frontend": [_serialize_dep(d) for d in report.frontend_deps],
                "backend":  [_serialize_dep(d) for d in report.backend_deps],
            },
        }

    except Exception as e:
        print(f"[DEPS ROUTER] Job {job_id} failed: {e}")
        _dep_jobs[job_id] = {
            "status": "failed",
            "error": str(e),
            "result": None,
        }


def _serialize_dep(dep) -> dict:
    return {
        "name":             dep.name,
        "current_version":  dep.installed_version,
        "latest_version":   dep.latest_version,
        "urgency":          dep.urgency.lower(),       # frontend expects lowercase
        "reason":           dep.reason,
        "update_command":   dep.update_command,
        "sub_dependencies": [_serialize_dep(s) for s in (dep.sub_dependencies or [])],
    }