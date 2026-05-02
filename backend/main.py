from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio, uuid, json, os
from dotenv import load_dotenv

# Load .env from project root (one level above /backend)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
from models.schemas import RepoInput, JobStatus
from pipeline.orchestrator import run_pipeline
from pipeline.deploy_only import run_deploy_only_pipeline
from models.database import init_db
from services.vercel_deployer import get_deployment_status

app = FastAPI(title="DeployGuard AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: dict = {}
events: dict = {}

@app.on_event("startup")
async def startup():
    init_db()


# 🔍 request logger
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"🔥 INCOMING: {request.method} {request.url}")
    response = await call_next(request)
    print(f"🔥 RESPONSE: {response.status_code}")
    return response


# ✅ CORRECT: non-blocking job creation
@app.post("/api/jobs")
async def create_job(repo: RepoInput):
    print("🔥 create_job called")

    job_id = str(uuid.uuid4())
    queue = asyncio.Queue()

    events[job_id] = queue
    jobs[job_id] = {
        "status": JobStatus.QUEUED,
        "repo": repo.github_url
    }

    print("🔥 scheduling pipeline")

    # 🔥 CRITICAL: do NOT await
    asyncio.get_running_loop().call_soon(
        lambda: asyncio.create_task(run_pipeline(job_id, repo, queue))
    )

    return {"job_id": job_id}

@app.post("/api/deploy-only")
async def create_deploy_only_job(repo: RepoInput):
    print("🔥 create_deploy_only_job called")

    job_id = str(uuid.uuid4())
    queue = asyncio.Queue()

    events[job_id] = queue
    jobs[job_id] = {
        "status": JobStatus.QUEUED,
        "repo": repo.github_url
    }

    print("🔥 scheduling deploy only pipeline")

    asyncio.get_running_loop().call_soon(
        lambda: asyncio.create_task(run_deploy_only_pipeline(job_id, repo, queue))
    )

    return {"job_id": job_id}


# ✅ SSE stream
@app.get("/api/jobs/{job_id}/stream")
async def stream_events(job_id: str):
    async def event_generator():
        q = events.get(job_id)

        if not q:
            yield f"data: {json.dumps({'error': 'job not found'})}\n\n"
            return

        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"

                # Break when the pipeline emits a terminal event
                if event.get("event") in ["complete", "error"]:
                    # Send an explicit close signal so the client stops reconnecting
                    yield f"data: {json.dumps({'event': 'stream_end'})}\n\n"
                    break

            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'ping': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/jobs/{job_id}/report")
async def get_report(job_id: str):
    return jobs.get(job_id, {}).get("report", {})


@app.get("/api/deployment/{job_id}/status")
async def get_deploy_status(job_id: str):
    report = jobs.get(job_id, {}).get("report", {})
    url = report.get("deployment_url")
    status = await get_deployment_status(url)
    status["url"] = url
    return status


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("shutdown")
async def shutdown():
    from services.node_bridge import close_session
    await close_session()