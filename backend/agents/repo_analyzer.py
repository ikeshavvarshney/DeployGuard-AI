import os
import json
import asyncio
import uuid
import tempfile
import subprocess
from models.schemas import RepoAnalysis


# ─────────────────────────────────────────────
# SAFE CROSS-PLATFORM CLONE
# ─────────────────────────────────────────────
def _clone_repo_sync(github_url: str, branch: str, clone_path: str):
    result = subprocess.run(
        ["git", "clone", "--depth=1", "--branch", branch, github_url, clone_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    if result.returncode != 0:
        raise Exception(f"Git clone failed: {result.stderr.strip()}")


async def _clone_repo(github_url: str, branch: str, clone_path: str):
    # run blocking git clone safely in thread
    await asyncio.to_thread(_clone_repo_sync, github_url, branch, clone_path)


# ─────────────────────────────────────────────
# FILE SCAN (RUN IN THREAD)
# ─────────────────────────────────────────────
def _scan_files(clone_path: str):
    test_files, source_files = [], []

    for root, dirs, files in os.walk(clone_path):
        dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", ".next", "dist"]]

        for file in files:
            rel = os.path.relpath(os.path.join(root, file), clone_path)

            if any(p in rel for p in [".test.", ".spec.", "__tests__"]):
                test_files.append(rel)

            elif file.endswith((".js", ".ts", ".jsx", ".tsx")):
                source_files.append(rel)

    return test_files, source_files


# ─────────────────────────────────────────────
# MAIN ANALYZER
# ─────────────────────────────────────────────
async def analyze_repo(github_url: str, branch: str = "main", queue=None) -> RepoAnalysis:
    repo_id = str(uuid.uuid4())[:8]

    # cross-platform temp directory
    base_dir = os.path.join(tempfile.gettempdir(), "deployguard")
    os.makedirs(base_dir, exist_ok=True)

    clone_path = os.path.join(base_dir, repo_id)

    # clone repo
    await _clone_repo(github_url, branch, clone_path)

    pkg_path = os.path.join(clone_path, "package.json")
    if not os.path.exists(pkg_path):
        raise ValueError("Not a Node.js repo — only Node.js supported in MVP")

    with open(pkg_path, "r", encoding="utf-8") as f:
        pkg = json.load(f)

    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}

    # framework detection
    if "next" in deps:
        framework = "nextjs"
        entry_point = (
            "app/page.tsx"
            if os.path.exists(os.path.join(clone_path, "app"))
            else "pages/index.tsx"
        )
    elif "express" in deps or "fastify" in deps:
        framework = "express"
        entry_point = pkg.get("main", "src/index.js")
    else:
        framework = "node"
        entry_point = pkg.get("main", "index.js")

    # test framework detection
    scripts = pkg.get("scripts", {})
    if "jest" in deps or "jest" in scripts.get("test", ""):
        test_framework = "jest"
    elif "vitest" in deps:
        test_framework = "vitest"
    else:
        test_framework = "none"

    # package manager detection
    if os.path.exists(os.path.join(clone_path, "yarn.lock")):
        pm = "yarn"
    elif os.path.exists(os.path.join(clone_path, "pnpm-lock.yaml")):
        pm = "pnpm"
    else:
        pm = "npm"

    # scan files safely
    test_files, source_files = await asyncio.to_thread(_scan_files, clone_path)

    return RepoAnalysis(
        framework=framework,
        test_framework=test_framework,
        entry_point=entry_point,
        package_manager=pm,
        has_tests=len(test_files) > 0,
        test_files=test_files,
        source_files=source_files[:50],
        repo_path=clone_path,
    )