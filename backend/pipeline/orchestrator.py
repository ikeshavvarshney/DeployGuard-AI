import asyncio, time, traceback
from models.schemas import JobStatus, RepoInput
from agents.repo_analyzer import analyze_repo
from agents.deploy_planner import plan_deployment
from agents.execution_agent import execute_deployment
from agents.test_generator import generate_tests
from agents.verifier import verify_tests
from agents.fixer import fix_issues
from services.node_bridge import run_mutation, run_tests
from services.scoring import calculate_score, calculate_final_score, validate_deployment_url
from services.risk_classifier import rank_mutants
from services.emitter import emit
from services.cache import repo_fingerprint, get_cache, set_cache, store_run

async def run_pipeline(job_id: str, repo: RepoInput, queue: asyncio.Queue):
    print("🚀 PIPELINE STARTED")
    try:
        await emit(queue, JobStatus.ANALYZING, "Pipeline started", {"progress": 5}, event_route="progress")
        await emit(queue, JobStatus.ANALYZING, "Cloning and analyzing repository...", event_route="stage_update", data={"status": "active"})
        
        analysis = await analyze_repo(repo.github_url, repo.branch, queue)
        
        await emit(queue, JobStatus.ANALYZING, f"Repo analyzed. Framework: {analysis.framework}", event_route="log")
        await emit(queue, JobStatus.ANALYZING, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.DEPLOYING, "Progress", {"progress": 15}, event_route="progress")

        await emit(queue, JobStatus.DEPLOYING, "Planning deployment strategy...", event_route="stage_update", data={"status": "active"})
        plan = await plan_deployment(analysis)

        await emit(queue, JobStatus.DEPLOYING, "Executing deployment in sandbox...", event_route="log")
        deploy_result = await execute_deployment(plan, analysis.repo_path, queue)
        await emit(queue, JobStatus.DEPLOYING, f"Deployment complete (Success: {deploy_result.get('success')})", event_route="log")
        await emit(queue, JobStatus.DEPLOYING, "Vercel deployment complete", {"url": deploy_result.get("url"), "live": deploy_result.get("success"), "vercel_project": deploy_result.get("vercel_project")})
        await emit(queue, JobStatus.DEPLOYING, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.MUTATING, "Progress", {"progress": 30}, event_route="progress")

        fingerprint = repo_fingerprint(repo.github_url)
        cached_mutants = await get_cache(f"mutants:{fingerprint}")
        
        if cached_mutants:
            mutants = cached_mutants
            await emit(queue, JobStatus.MUTATING, f"Loaded {len(mutants)} mutants from cache", event_route="log")
            initial_score = calculate_score(mutants)
        else:
            await emit(queue, JobStatus.MUTATING, "Running mutation engine (Stryker)...", event_route="stage_update", data={"status": "active"})
            mutation_result = await run_mutation(deploy_result["repo_path"])
            mutants = mutation_result.get("mutants", [])
            initial_score = calculate_score(mutants)
            await set_cache(f"mutants:{fingerprint}", mutants, ttl=3600)
            await emit(queue, JobStatus.MUTATING, f"Mutation complete. Total mutants: {len(mutants)}", event_route="log")
            
        await emit(queue, JobStatus.MUTATING, "Score update", {"before": round(initial_score*100), "after": round(initial_score*100)}, event_route="mutation_score")
        await emit(queue, JobStatus.MUTATING, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.GENERATING_TESTS, "Progress", {"progress": 45}, event_route="progress")

        survived = rank_mutants(
            [m for m in mutants if m["status"] == "survived"],
            deploy_result["repo_path"]
        )
        
        await emit(queue, JobStatus.GENERATING_TESTS, f"Generating tests for {len(survived)} surviving mutants...", event_route="stage_update", data={"status": "active"})
        
        generated_tests = await generate_tests(survived, deploy_result["repo_path"], queue)
        
        for t in generated_tests:
            await emit(queue, JobStatus.GENERATING_TESTS, "Test generated", {"test": t}, event_route="test_generated")
            
        await emit(queue, JobStatus.GENERATING_TESTS, f"Generated {len(generated_tests)} tests", event_route="log")
        await emit(queue, JobStatus.GENERATING_TESTS, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.VERIFYING, "Progress", {"progress": 65}, event_route="progress")

        await emit(queue, JobStatus.VERIFYING, "Running verification agents in parallel...", event_route="stage_update", data={"status": "active"})
        
        verified_tests = await verify_tests(generated_tests, deploy_result["repo_path"], queue)
        valid_tests = [t for t in verified_tests if t["verified"]]
        
        for t in verified_tests:
            await emit(queue, JobStatus.VERIFYING, "Test verified", {"test": t}, event_route="test_generated")
            
        await emit(queue, JobStatus.VERIFYING, f"Verified {len(valid_tests)}/{len(generated_tests)} tests", event_route="log")
        await emit(queue, JobStatus.VERIFYING, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.FIXING, "Progress", {"progress": 80}, event_route="progress")

        await emit(queue, JobStatus.FIXING, "Fixing phase started", event_route="stage_update", data={"status": "active"})
        final_mutation = await run_mutation(deploy_result["repo_path"], extra_tests=valid_tests)
        final_score = calculate_score(final_mutation.get("mutants", []))
        
        await emit(queue, JobStatus.FIXING, "Score update", {"before": round(initial_score*100), "after": round(final_score*100)}, event_route="mutation_score")

        if deploy_result.get("logs") and "error" in deploy_result.get("logs", "").lower():
            fixes = await fix_issues(deploy_result["logs"], analysis, queue)
            await emit(queue, JobStatus.FIXING, f"Issues fixed: {fixes}", event_route="log")
            
        await emit(queue, JobStatus.FIXING, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.COMPLETE, "Progress", {"progress": 95}, event_route="progress")

        url_live = await validate_deployment_url(deploy_result.get("url"))
        score_breakdown = calculate_final_score(
            mutation_score=final_score,
            tests_generated=len(generated_tests),
            tests_verified=len(valid_tests),
            deployment_success=url_live
        )

        report = {
            "job_id": job_id,
            "repo_url": repo.github_url,
            "deployment_url": deploy_result.get("url"),
            "deployment_live": url_live,
            **score_breakdown,
            "initial_mutation_score": round(initial_score * 100, 1),
            "total_mutants": len(mutants),
            "survived_before": len([m for m in mutants if m["status"] == "survived"]),
            "survived_after": len([m for m in final_mutation.get("mutants", []) if m["status"] == "survived"]),
            "tests_generated": len(generated_tests),
            "tests_verified": len(valid_tests),
            "vercel_project": deploy_result.get("vercel_project", ""),
        }

        await store_run(fingerprint, report)

        await emit(queue, JobStatus.COMPLETE, "Progress", {"progress": 100}, event_route="progress")
        await emit(queue, JobStatus.COMPLETE, "done", event_route="stage_update", data={"status": "done"})
        await emit(queue, JobStatus.COMPLETE, "Pipeline finished.", {"report": report}, event_route="complete")

    except Exception as e:
        # 🔥 Print full traceback in backend
        print("💥 PIPELINE CRASHED")
        traceback.print_exc()

        error_msg = str(e) if str(e) else "Unknown error"

        # Send detailed error to frontend
        await emit(
            queue,
            JobStatus.FAILED,
            f"Pipeline failed: {error_msg}",
            data={"error": error_msg},
            event_type="error",
            event_route="error"
        )

        # Update stage explicitly
        await emit(
            queue,
            JobStatus.FAILED,
            "failed",
            data={"status": "failed"},
            event_route="stage_update"
        )