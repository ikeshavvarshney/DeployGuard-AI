from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import aiohttp
import asyncio
import os
import re
import json
import logging
from services.ollama_client import get_completion, MODELS

router = APIRouter()
logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_API = "https://api.github.com"


def get_github_headers() -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers


def parse_github_url(repo_url: str) -> tuple[str, str]:
    """Extract owner and repo from a GitHub URL."""
    repo_url = repo_url.strip().rstrip("/").removesuffix(".git")
    pattern = r"github\.com[:/]([^/]+)/([^/]+)"
    match = re.search(pattern, repo_url)
    if not match:
        raise ValueError("Invalid GitHub repository URL")
    return match.group(1), match.group(2)


# ─── Request Models ──────────────────────────────────────────────────────────

class FetchContributorsRequest(BaseModel):
    repo_url: str


class ContributorInput(BaseModel):
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    email: str = ""
    skills: list[str] = []
    commit_count: int = 0
    avatar_url: str = ""


class AssignTaskRequest(BaseModel):
    task: str
    contributors: list[ContributorInput]


# ─── Helper: fetch one contributor's full profile + languages ─────────────────

async def fetch_contributor_details(
    session: aiohttp.ClientSession,
    username: str,
    commit_count: int,
    headers: dict,
) -> dict:
    """Concurrently fetch user profile and their recent repos for language detection."""

    async def get_user() -> dict:
        async with session.get(
            f"{GITHUB_API}/users/{username}",
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 200:
                return await resp.json()
            return {}

    async def get_repos() -> list:
        async with session.get(
            f"{GITHUB_API}/users/{username}/repos",
            headers=headers,
            params={"sort": "pushed", "per_page": 10},
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 200:
                return await resp.json()
            return []

    user_data, repos_data = await asyncio.gather(get_user(), get_repos())

    # Deduplicated language list from recent repos
    seen: set[str] = set()
    languages: list[str] = []
    for repo in repos_data:
        lang = repo.get("language")
        if lang and lang not in seen:
            seen.add(lang)
            languages.append(lang)

    return {
        "username": username,
        "name": user_data.get("name") or None,
        "avatar_url": user_data.get("avatar_url", ""),
        "bio": user_data.get("bio") or None,
        "languages": languages,
        "commit_count": commit_count,
        "email": "",  # email intentionally left blank for user to fill
    }


# ─── Route 1: Fetch Contributors ──────────────────────────────────────────────

@router.post("/fetch-contributors")
async def fetch_contributors(req: FetchContributorsRequest):
    try:
        owner, repo = parse_github_url(req.repo_url)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL. Expected: https://github.com/owner/repo")

    headers = get_github_headers()

    async with aiohttp.ClientSession() as session:
        # Step 1: Get contributors list
        async with session.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contributors",
            headers=headers,
            params={"per_page": 10},
            timeout=aiohttp.ClientTimeout(total=20),
        ) as resp:
            if resp.status == 404:
                raise HTTPException(
                    status_code=404,
                    detail="Repository not found or is private",
                )
            if resp.status == 403:
                raise HTTPException(
                    status_code=429,
                    detail="GitHub rate limit hit. Add GITHUB_TOKEN to .env to increase limit.",
                )
            if resp.status != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"GitHub API error: {resp.status}",
                )
            raw_contributors = await resp.json()

        if not raw_contributors:
            raise HTTPException(status_code=404, detail="No contributors found for this repository.")

        # Step 2: Fetch all user details + languages concurrently
        tasks = [
            fetch_contributor_details(
                session=session,
                username=c["login"],
                commit_count=c.get("contributions", 0),
                headers=headers,
            )
            for c in raw_contributors
        ]
        contributors = await asyncio.gather(*tasks)

    return {"contributors": list(contributors)}


# ─── Route 2: Assign Task via LLM ─────────────────────────────────────────────

def extract_json(text: str) -> dict | None:
    text = text.strip()
    # Strip markdown fences
    for fence in ["```json", "```"]:
        if text.startswith(fence):
            text = text[len(fence):]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


@router.post("/assign-task")
async def assign_task(req: AssignTaskRequest):
    if not req.contributors:
        raise HTTPException(status_code=400, detail="No contributors provided")

    contributor_lines = "\n".join(
        f'- {c.username} ({c.name or "No name"}): skills=[{", ".join(c.skills)}], '
        f'commits={c.commit_count}, bio="{c.bio or "No bio"}"'
        for c in req.contributors
    )

    system_prompt = (
        "You are a technical team lead. Analyze contributors and assign the task to the best match "
        "based on skills. Reply with valid JSON only. No markdown. No explanation outside JSON."
    )

    user_prompt = f"""Task: {req.task}

Contributors:
{contributor_lines}

Assign this task. Return JSON:
{{
  "assignee": "<username>",
  "reason": "2-3 sentence explanation of why this person is the best fit",
  "confidence": "HIGH or MEDIUM or LOW",
  "skill_matches": ["skill1", "skill2"],
  "rankings": [
    {{"username": "...", "score": 0.9, "reason": "brief"}},
    {{"username": "...", "score": 0.6, "reason": "brief"}}
  ]
}}"""

    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    # First attempt
    raw = await get_completion(full_prompt, model_key="reasoning", max_tokens=800, temperature=0.1)
    parsed = extract_json(raw)

    # Retry once if parsing fails
    if parsed is None:
        logger.warning("[assign-task] JSON parse failed, retrying...")
        retry_prompt = (
            full_prompt
            + "\n\nERROR: output raw JSON only, absolutely no markdown code fences or backticks."
        )
        raw = await get_completion(retry_prompt, model_key="reasoning", max_tokens=800, temperature=0.1)
        parsed = extract_json(raw)

    if parsed is None:
        raise HTTPException(
            status_code=500,
            detail="Model returned invalid response, try rephrasing the task",
        )

    assignee_username = parsed.get("assignee", "")
    assignee_data = next(
        (c for c in req.contributors if c.username == assignee_username), None
    )

    if assignee_data is None:
        # Fall back to first contributor if LLM hallucinated a username
        assignee_data = req.contributors[0]

    return {
        "assignee": {
            "username": assignee_data.username,
            "name": assignee_data.name,
            "avatar_url": assignee_data.avatar_url,
            "email": assignee_data.email,
            "skills": assignee_data.skills,
            "skill_matches": parsed.get("skill_matches", []),
        },
        "reason": parsed.get("reason", ""),
        "confidence": parsed.get("confidence", "MEDIUM"),
        "rankings": parsed.get("rankings", []),
    }
