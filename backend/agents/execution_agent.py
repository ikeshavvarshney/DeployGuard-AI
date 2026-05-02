import asyncio
from services.docker_runner import run_in_sandbox


async def execute_deployment(plan: dict, github_url: str, queue: asyncio.Queue = None) -> dict:
    """
    Executes deployment in isolated environment.
    Wrapped in thread to prevent event loop blocking.
    """

    result = await run_in_sandbox(plan, github_url, queue)

    return result