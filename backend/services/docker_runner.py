import os
import asyncio
from .vercel_deployer import deploy_to_vercel

def _prepare_repo_path(repo_path: str) -> str:
    """
    Ensure repo_path exists. Create fallback if needed.
    Runs in thread to avoid blocking event loop.
    """
    if repo_path and os.path.exists(repo_path):
        return repo_path

    fallback = f"/tmp/deployguard/mock_{os.getpid()}"
    os.makedirs(fallback, exist_ok=True)
    return fallback


async def run_in_sandbox(plan: dict, repo_path: str, queue: asyncio.Queue = None) -> dict:
    """
    Simulated sandbox execution (async-safe).
    """

    # ✅ avoid blocking event loop
    repo_path = await asyncio.to_thread(_prepare_repo_path, repo_path)

    # simulate execution delay (non-blocking)
    await asyncio.sleep(0.2)
    
    build_logs = "Build in sandbox successful.\n"
    
    repo_name = repo_path.rstrip("/").split("/")[-1]
    framework = plan.get("framework", "node")
    
    vercel_result = await deploy_to_vercel(repo_path, framework, repo_name, queue)

    result = {
        "repo_path": repo_path,
        "success": True,
        "logs": build_logs + vercel_result.get("logs", ""),
        "url": vercel_result.get("url"),
        "vercel_project": vercel_result.get("vercel_project")
    }
    
    if not vercel_result.get("success") or not vercel_result.get("url"):
        result["vercel_failed"] = True

    return result