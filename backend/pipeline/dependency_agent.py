"""
dependency_agent.py

Main analysis pipeline:
  clone → parse → fetch versions (concurrent API) → classify (batched LLM) → report
"""

import asyncio
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Optional

from models.schemas import (
    Dependency,
    DependencyResult,
    DependencyReport,
    UpdateCommand,
)
from services.dep_version_checker import fetch_all_versions
from services.ollama_client import get_completion


# ─── Git Clone ────────────────────────────────────────────────────────────────

def clone_repo(url: str) -> str:
    tmp = tempfile.mkdtemp(prefix="depguard_")
    print(f"[AGENT] Cloning {url} → {tmp}")
    result = subprocess.run(
        ["git", "clone", "--depth=1", url, tmp],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Git clone failed: {result.stderr.strip()}")
    return tmp


# ─── File Detection ───────────────────────────────────────────────────────────

def _find_file(base: str, *candidates: str) -> Optional[str]:
    for rel in candidates:
        path = os.path.join(base, rel)
        if os.path.isfile(path):
            return path
    return None


# ─── Parsers ──────────────────────────────────────────────────────────────────

def parse_package_json(path: str) -> dict:
    """Returns {name: {declared, is_dev}} for all npm deps."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    result = {}
    for name, ver in data.get("dependencies", {}).items():
        result[name] = {"declared": ver, "is_dev": False}
    for name, ver in data.get("devDependencies", {}).items():
        result[name] = {"declared": ver, "is_dev": True}
    return result


def parse_package_lock(path: str) -> dict:
    """Returns {name: {version, requires: [...]}} from package-lock.json v2/v3."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    result = {}
    packages = data.get("packages", {})
    if packages:
        for pkg_path, info in packages.items():
            if not pkg_path:
                continue
            name = pkg_path.split("node_modules/")[-1]
            result[name] = {
                "version": info.get("version", "unknown"),
                "requires": list(info.get("dependencies", {}).keys()),
            }
    else:
        # v1 lockfile fallback
        for name, info in data.get("dependencies", {}).items():
            result[name] = {
                "version": info.get("version", "unknown"),
                "requires": list(info.get("requires", {}).keys()),
            }
    return result


def parse_requirements_txt(path: str) -> list[dict]:
    """Returns [{name, declared, installed}] from requirements.txt."""
    deps = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith(("#", "-")):
                continue
            line = re.sub(r"\[.*?\]", "", line)
            m = re.match(r"^([A-Za-z0-9_\-\.]+)\s*([><=!~]+)\s*([\d\.\w\*]+)", line)
            if m:
                name, op, ver = m.group(1), m.group(2), m.group(3)
                deps.append({
                    "name": name,
                    "declared": f"{name}{op}{ver}",
                    "installed": ver if "==" in op else ver,
                })
            else:
                m2 = re.match(r"^([A-Za-z0-9_\-\.]+)", line)
                if m2:
                    deps.append({
                        "name": m2.group(1),
                        "declared": m2.group(1),
                        "installed": "unknown",
                    })
    return deps


def parse_pyproject_toml(path: str) -> list[dict]:
    """Extracts deps from [tool.poetry.dependencies] or [project.dependencies]."""
    deps = []
    with open(path, encoding="utf-8") as f:
        content = f.read()

    # Handle [project] dependencies = [...] (PEP 621)
    pep621_match = re.search(
        r'\[project\].*?^dependencies\s*=\s*\[(.*?)\]',
        content, re.DOTALL | re.MULTILINE
    )
    if pep621_match:
        for item in re.findall(r'"([^"]+)"', pep621_match.group(1)):
            m = re.match(r"([A-Za-z0-9_\-\.]+)\s*([><=!~,\s\d\.]*)", item)
            if m:
                name = m.group(1)
                ver_raw = re.sub(r"[^0-9\.]", "", m.group(2).strip())
                deps.append({"name": name, "declared": item.strip(), "installed": ver_raw or "unknown"})
        return deps

    # Handle [tool.poetry.dependencies]
    in_deps = False
    for line in content.splitlines():
        line = line.strip()
        if line in ("[tool.poetry.dependencies]",):
            in_deps = True
            continue
        if line.startswith("[") and in_deps:
            break
        if in_deps:
            m = re.match(r'^([A-Za-z0-9_\-\.]+)\s*=\s*["\']?([^"\'#\n]+)["\']?', line)
            if m and m.group(1).lower() not in ("python", "name", "version", "description"):
                name = m.group(1)
                ver_clean = re.sub(r"^[><=~^!\s]+", "", m.group(2).strip()).strip('"\'')
                deps.append({"name": name, "declared": f"{name}>={ver_clean}", "installed": ver_clean})

    return deps


# ─── LLM: Batch Urgency Classification ───────────────────────────────────────

async def classify_urgency_batch(deps: list[Dependency]) -> dict[str, dict]:
    """
    Single LLM call for ALL deps.
    Returns: { "pkg_name": {"urgency": "HIGH", "reason": "..."}, ... }
    Much faster than per-dep calls.
    """
    if not deps:
        return {}

    pkg_list = json.dumps([
        {
            "name": d.name,
            "ecosystem": d.ecosystem,
            "installed": d.installed_version,
            "latest": d.latest_version,
            "is_dev": d.is_dev,
        }
        for d in deps
    ], indent=2)

    prompt = f"""You are a software security analyst classifying dependency update urgency.

For each package below, classify urgency into exactly one of:
- CRITICAL: Known CVE or security vulnerability, update immediately
- HIGH: Major version behind, breaking changes or security risk likely  
- MEDIUM: Minor/patch version behind, update when convenient
- LOW: Dev dependency, negligible difference, or already up to date

Packages:
{pkg_list}

Rules:
- If installed == latest or latest == "unknown", classify as LOW
- Dev dependencies are at most MEDIUM
- Use package ecosystem knowledge to judge severity

Respond with ONLY a JSON object (no explanation, no markdown):
{{
  "package-name": {{"urgency": "CRITICAL|HIGH|MEDIUM|LOW", "reason": "one sentence"}},
  ...
}}"""

    try:
        response = await get_completion(
            prompt,
            model_key="reasoning",
            max_tokens=1024,
            temperature=0.1,
        )
        clean = re.sub(r"```[a-z]*\n?", "", response).strip().strip("`").strip()
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        print(f"[AGENT] Batch classification failed: {e}")

    # Fallback: all MEDIUM
    return {d.name: {"urgency": "MEDIUM", "reason": "Could not classify"} for d in deps}


# ─── Build Dep Objects ────────────────────────────────────────────────────────

def _build_npm_deps(
    npm_raw: dict,
    lock_data: dict,
    npm_versions: dict[str, str],
) -> list[Dependency]:
    deps = []
    for name, info in npm_raw.items():
        # Installed version: from lockfile if available
        installed = lock_data.get(name, {}).get("version", "unknown")
        latest = npm_versions.get(name, "unknown")
        sub_deps = lock_data.get(name, {}).get("requires", [])

        deps.append(Dependency(
            name=name,
            installed_version=installed,
            declared_version=info["declared"],
            latest_version=latest,
            is_outdated=(
                latest != "unknown"
                and installed != "unknown"
                and installed != latest
            ),
            ecosystem="npm",
            is_dev=info["is_dev"],
            sub_dependencies=sub_deps,
        ))
    return deps


def _build_pip_deps(
    pip_raw: list[dict],
    pip_versions: dict[str, str],
) -> list[Dependency]:
    deps = []
    for d in pip_raw:
        name = d["name"]
        installed = d.get("installed", "unknown")
        latest = pip_versions.get(name, "unknown")

        deps.append(Dependency(
            name=name,
            installed_version=installed,
            declared_version=d.get("declared", name),
            latest_version=latest,
            is_outdated=(
                latest != "unknown"
                and installed != "unknown"
                and installed != latest
            ),
            ecosystem="pip",
            is_dev=False,
            sub_dependencies=[],
        ))
    return deps


# ─── Build Results ────────────────────────────────────────────────────────────

def _to_result(dep: Dependency, urgency_map: dict[str, dict]) -> DependencyResult:
    cls = urgency_map.get(dep.name, {"urgency": "LOW", "reason": "Already up to date"})
    urgency = cls.get("urgency", "LOW").upper()
    # Normalize unknown values
    if urgency not in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        urgency = "MEDIUM"

    # Generate update command deterministically (no LLM needed)
    update_command = None
    if dep.is_outdated and dep.latest_version != "unknown":
        if dep.ecosystem == "npm":
            update_command = f"npm install {dep.name}@{dep.latest_version}"
        else:
            update_command = f"pip install {dep.name}=={dep.latest_version}"

    # Build sub-dependency results (lightweight, no recursion needed)
    sub_results = [
        DependencyResult(
            name=sub_name,
            installed_version="see lockfile",
            declared_version="",
            latest_version="unknown",
            is_outdated=False,
            ecosystem=dep.ecosystem,
            is_dev=dep.is_dev,
            sub_dependencies=[],
            urgency="LOW",
            reason="Transitive dependency",
            update_command=None,
        )
        for sub_name in (dep.sub_dependencies or [])
    ]

    return DependencyResult(
        name=dep.name,
        installed_version=dep.installed_version,
        declared_version=dep.declared_version,
        latest_version=dep.latest_version,
        is_outdated=dep.is_outdated,
        ecosystem=dep.ecosystem,
        is_dev=dep.is_dev,
        sub_dependencies=sub_results,
        urgency=urgency,
        reason=cls.get("reason", ""),
        update_command=update_command,
    )


# ─── Main Analyze ─────────────────────────────────────────────────────────────

async def analyze(repo_url: str) -> DependencyReport:
    repo_path = None
    try:
        # 1. Clone
        repo_path = await asyncio.to_thread(clone_repo, repo_url)

        # 2. Detect files (supports monorepo layout)
        pkg_json_path  = _find_file(repo_path, "package.json",      "frontend/package.json",  "client/package.json")
        pkg_lock_path  = _find_file(repo_path, "package-lock.json", "frontend/package-lock.json", "client/package-lock.json")
        reqs_path      = _find_file(repo_path, "requirements.txt",  "backend/requirements.txt",  "server/requirements.txt")
        pyproject_path = _find_file(repo_path, "pyproject.toml",    "backend/pyproject.toml",    "server/pyproject.toml")

        # 3. Parse static files (instant)
        npm_raw   = parse_package_json(pkg_json_path) if pkg_json_path else {}
        lock_data = parse_package_lock(pkg_lock_path) if pkg_lock_path else {}
        pip_raw   = (
            parse_requirements_txt(reqs_path) if reqs_path
            else parse_pyproject_toml(pyproject_path) if pyproject_path
            else []
        )

        print(f"[AGENT] Found {len(npm_raw)} npm, {len(pip_raw)} pip packages")

        # 4. Fetch ALL latest versions concurrently (npm + PyPI in parallel)
        npm_versions, pip_versions = await fetch_all_versions(
            npm_packages=list(npm_raw.keys()),
            pip_packages=[d["name"] for d in pip_raw],
        )

        print(f"[AGENT] Fetched versions: {len(npm_versions)} npm, {len(pip_versions)} pip")

        # 5. Build Dependency objects
        npm_deps = _build_npm_deps(npm_raw, lock_data, npm_versions)
        pip_deps = _build_pip_deps(pip_raw, pip_versions)
        all_deps = npm_deps + pip_deps

        # 6. Batch classify ALL deps with one LLM call
        urgency_map = await classify_urgency_batch(all_deps)

        # 7. Build results
        frontend_results = [_to_result(d, urgency_map) for d in npm_deps]
        backend_results  = [_to_result(d, urgency_map) for d in pip_deps]
        all_results      = frontend_results + backend_results

        # 8. Collect update commands (deterministic, already in each result)
        update_commands = [
            UpdateCommand(
                name=r.name,
                ecosystem=r.ecosystem,
                command=r.update_command,
            )
            for r in all_results
            if r.update_command
        ]

        # 9. Count urgencies
        def _count(u: str) -> int:
            return sum(1 for r in all_results if r.urgency == u)

        return DependencyReport(
            repo_url=repo_url,
            frontend_deps=frontend_results,
            backend_deps=backend_results,
            total_outdated=sum(1 for r in all_results if r.is_outdated),
            critical_count=_count("CRITICAL"),
            high_count=_count("HIGH"),
            medium_count=_count("MEDIUM"),
            low_count=_count("LOW"),
            update_commands=update_commands,
            analyzed_at=datetime.now(timezone.utc).isoformat(),
        )

    finally:
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)