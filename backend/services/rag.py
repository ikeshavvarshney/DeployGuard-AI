import logging
from .ollama_client import get_completion

logger = logging.getLogger(__name__)

# Simulated MongoDB fixes collection
_fixes_collection = [
    {"pattern": "enoent", "fix": "Fixed: Missing file reference in entry point", "success_rate": 0.9},
    {"pattern": "module_not_found", "fix": "Fixed: Added missing dependency installation step", "success_rate": 0.85},
]


async def get_similar_configs(framework: str, package_manager: str) -> list:
    """
    Fetch deployment commands using LLM (reasoning model).
    Falls back to static defaults if LLM fails.
    """

    prompt = (
        f"What are common successful deployment commands for {framework} "
        f"using {package_manager}? Return ONLY commands, no explanation."
    )

    try:
        response = await get_completion(
            prompt,
            model_key="reasoning",
            max_tokens=150,
            temperature=0.1,
        )

        if response:
            return [response.strip()]

    except Exception as e:
        logger.warning(f"Ollama call failed: {e}")

    # fallback (deterministic safety net)
    if framework.lower() == "nextjs" and package_manager.lower() == "npm":
        return ["npm install", "npm run build", "npm start"]

    return ["npm install", "npm start"]


async def get_known_fixes(keywords: list) -> list:
    """Returns past fixes sorted by success_rate"""

    fixes = []

    for kw in keywords:
        kw_lower = kw.lower()
        for record in _fixes_collection:
            if kw_lower in record["pattern"]:
                fixes.append(record)

    fixes.sort(key=lambda x: x["success_rate"], reverse=True)

    return [f["fix"] for f in fixes]


async def store_fix(pattern: str, fix_str: str, worked: bool):
    """Upsert fix with simple success-rate tracking"""

    global _fixes_collection

    success_rate = 1.0 if worked else 0.0

    for record in _fixes_collection:
        if record["pattern"] == pattern:
            record["success_rate"] = (record["success_rate"] + success_rate) / 2
            return

    _fixes_collection.append({
        "pattern": pattern,
        "fix": fix_str,
        "success_rate": success_rate,
    })