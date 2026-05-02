import aiohttp
import os
import asyncio
from typing import List, Dict, Any, Optional

NODE_SERVICE_URL = os.environ.get("NODE_SERVICE_URL", "http://localhost:3001")

# 🔥 shared session (connection pooling)
_session: Optional[aiohttp.ClientSession] = None


async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=300)
        )
    return _session


async def _post(endpoint: str, payload: dict, timeout: int = 120, retries: int = 2) -> dict:
    """
    Unified POST handler with retry + error handling.
    """
    url = f"{NODE_SERVICE_URL}{endpoint}"

    for attempt in range(retries + 1):
        try:
            session = await get_session()

            async with session.post(
                url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=timeout)
            ) as resp:

                if resp.status == 200:
                    return await resp.json()

                error_text = await resp.text()
                return {"error": error_text, "status": resp.status}

        except asyncio.TimeoutError:
            if attempt == retries:
                return {"error": "timeout"}
        except Exception as e:
            if attempt == retries:
                return {"error": str(e)}

        # retry delay (basic backoff)
        await asyncio.sleep(0.5 * (attempt + 1))

    return {"error": "unknown failure"}


# ─────────────────────────────────────────────
# Public APIs
# ─────────────────────────────────────────────

async def run_mutation(repo_path: str, extra_tests: List[Dict[str, Any]] = None) -> dict:
    """
    Run Stryker mutation testing.
    """
    payload = {
        "repoPath": repo_path,
        "extraTests": extra_tests or []
    }

    result = await _post("/run-mutation", payload, timeout=300)

    return result if "mutants" in result else {"mutants": [], **result}


async def run_tests(repo_path: str) -> dict:
    """
    Run full test suite.
    """
    payload = {"repoPath": repo_path}

    result = await _post("/run-tests", payload, timeout=120)

    return result if "passed" in result else {"passed": False, **result}


async def run_single_test(test_code: str, mutant_id: str, repo_path: str) -> dict:
    """
    Run a single generated test.
    """
    payload = {
        "testCode": test_code,
        "mutantId": mutant_id,
        "repoPath": repo_path
    }

    result = await _post("/run-single-test", payload, timeout=30)

    return result if "passed" in result else {"passed": False, **result}


# ─────────────────────────────────────────────
# Cleanup (important for FastAPI shutdown)
# ─────────────────────────────────────────────

async def close_session():
    global _session
    if _session and not _session.closed:
        await _session.close()