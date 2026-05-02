"""
dep_version_checker.py

Fetches latest versions from npm registry + PyPI concurrently.
No subprocess spam. No installs. Pure async HTTP.
"""

import asyncio
import json
import re
import httpx
from typing import Optional

# ─── Config ───────────────────────────────────────────────────────────────────

NPM_REGISTRY  = "https://registry.npmjs.org/{pkg}/latest"
PYPI_REGISTRY = "https://pypi.org/pypi/{pkg}/json"

CONCURRENCY   = 20      # max simultaneous requests
REQUEST_TIMEOUT = 8     # seconds per request
HTTP_HEADERS  = {"User-Agent": "DeployGuard/1.0"}

# ─── Internal fetch helpers ───────────────────────────────────────────────────

async def _fetch_npm_latest(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    pkg: str,
) -> tuple[str, str]:
    async with sem:
        try:
            r = await client.get(
                NPM_REGISTRY.format(pkg=pkg),
                timeout=REQUEST_TIMEOUT,
            )
            if r.status_code == 200:
                return pkg, r.json().get("version", "unknown")
        except Exception as e:
            print(f"[VERSION CHECKER] npm {pkg}: {e}")
    return pkg, "unknown"


async def _fetch_pypi_latest(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    pkg: str,
) -> tuple[str, str]:
    async with sem:
        try:
            # PyPI normalizes package names — lowercase + hyphen
            normalized = re.sub(r"[-_.]+", "-", pkg).lower()
            r = await client.get(
                PYPI_REGISTRY.format(pkg=normalized),
                timeout=REQUEST_TIMEOUT,
            )
            if r.status_code == 200:
                return pkg, r.json()["info"]["version"]
        except Exception as e:
            print(f"[VERSION CHECKER] pypi {pkg}: {e}")
    return pkg, "unknown"


# ─── Public API ───────────────────────────────────────────────────────────────

async def fetch_npm_versions(packages: list[str]) -> dict[str, str]:
    """
    Fetch latest npm versions for all packages concurrently.
    Returns: { "react": "19.0.0", "axios": "1.7.2", ... }
    """
    if not packages:
        return {}

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=HTTP_HEADERS) as client:
        tasks = [_fetch_npm_latest(client, sem, pkg) for pkg in packages]
        results = await asyncio.gather(*tasks)

    return dict(results)


async def fetch_pypi_versions(packages: list[str]) -> dict[str, str]:
    """
    Fetch latest PyPI versions for all packages concurrently.
    Returns: { "fastapi": "0.111.0", "requests": "2.32.0", ... }
    """
    if not packages:
        return {}

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=HTTP_HEADERS) as client:
        tasks = [_fetch_pypi_latest(client, sem, pkg) for pkg in packages]
        results = await asyncio.gather(*tasks)

    return dict(results)


async def fetch_all_versions(
    npm_packages: list[str],
    pip_packages: list[str],
) -> tuple[dict[str, str], dict[str, str]]:
    """
    Fetch npm + PyPI versions simultaneously.
    Returns: (npm_versions_dict, pip_versions_dict)
    """
    npm_result, pip_result = await asyncio.gather(
        fetch_npm_versions(npm_packages),
        fetch_pypi_versions(pip_packages),
    )
    return npm_result, pip_result