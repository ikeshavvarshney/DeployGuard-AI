import asyncio, traceback
from models.schemas import JobStatus, RepoInput
from agents.repo_analyzer import analyze_repo
from agents.deploy_planner import plan_deployment
from agents.execution_agent import execute_deployment
from services.scoring import validate_deployment_url
from services.emitter import emit
from services.cache import repo_fingerprint, store_run

async def run_deploy_only_pipeline(job_id: str, repo: RepoInput, queue: asyncio.Queue):
    print("🚀 DEPLOY ONLY PIPELINE STARTED")
    try:
        await emit(queue, JobStatus.ANALYZING, "Pipeline started", {"progress": 10}, event_route="progress")
        await emit(queue, JobStatus.ANALYZING, "Cloning and analyzing repository...", event_route="stage_update", data={"status": "active"})
        
        analysis = await analyze_repo(repo.github_url, repo.branch, queue)
        
        await emit(queue, JobStatus.ANALYZING, f"Repo analyzed. Framework: {analysis.framework}", event_route="log")
        await emit(queue, JobStatus.ANALYZING, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.DEPLOYING, "Progress", {"progress": 40}, event_route="progress")

        await emit(queue, JobStatus.DEPLOYING, "Planning deployment strategy...", event_route="stage_update", data={"status": "active"})
        plan = await plan_deployment(analysis)

        await emit(queue, JobStatus.DEPLOYING, "Executing deployment...", event_route="log")
        deploy_result = await execute_deployment(plan, analysis.repo_path, queue)
        await emit(queue, JobStatus.DEPLOYING, f"Deployment complete (Success: {deploy_result.get('success')})", event_route="log")
        await emit(queue, JobStatus.DEPLOYING, "Vercel deployment complete", {"url": deploy_result.get("url"), "live": deploy_result.get("success"), "vercel_project": deploy_result.get("vercel_project")}, event_route="log")
        await emit(queue, JobStatus.DEPLOYING, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.COMPLETE, "Progress", {"progress": 95}, event_route="progress")

        url_live = await validate_deployment_url(deploy_result.get("url"))

        report = {
            "job_id": job_id,
            "repo_url": repo.github_url,
            "deployment_url": deploy_result.get("url"),
            "deployment_live": url_live,
            "vercel_project": deploy_result.get("vercel_project", ""),
            # Set defaults for omitted steps
            "overall_score": 0,
            "reliability_grade": "N/A",
            "score_breakdown": {},
            "initial_mutation_score": 0,
            "total_mutants": 0,
            "survived_before": 0,
            "survived_after": 0,
            "tests_generated": 0,
            "tests_verified": 0,
        }

        fingerprint = repo_fingerprint(repo.github_url)
        await store_run(fingerprint, report)

        await emit(queue, JobStatus.COMPLETE, "Progress", {"progress": 100}, event_route="progress")
        await emit(queue, JobStatus.COMPLETE, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.COMPLETE, "Pipeline finished.", {"report": report}, event_route="complete")

    except Exception as e:
        print("💥 PIPELINE CRASHED")
        traceback.print_exc()

        error_msg = str(e) if str(e) else "Unknown error"

        await emit(
            queue,
            JobStatus.FAILED,
            f"Pipeline failed: {error_msg}",
            data={"error": error_msg},
            event_type="error",
            event_route="error"
        )
        await emit(
            queue,
            JobStatus.FAILED,
            "failed",
            data={"status": "failed"},
            event_route="stage_update"
        )
