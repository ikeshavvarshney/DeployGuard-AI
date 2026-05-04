import aiohttp


def calculate_score(mutants: list) -> float:
    """
    Calculate mutation score as killed / total.
    Handles both Stryker-style capital ('Killed'/'Survived') and
    lowercase ('killed'/'survived') status strings.
    """
    if not mutants:
        return 0.0
    killed = len([m for m in mutants if m.get("status", "").lower() == "killed"])
    total  = len(mutants)
    return killed / total if total > 0 else 0.0


def calculate_final_score(
    mutation_score: float,
    tests_generated: int,
    tests_verified: int,
    deployment_success: bool,
) -> dict:
    test_effectiveness = (tests_verified / tests_generated) if tests_generated > 0 else 0.0
    deploy_score       = 1.0 if deployment_success else 0.0

    final = (
        0.5 * mutation_score
        + 0.3 * test_effectiveness
        + 0.2 * deploy_score
    )

    return {
        "mutation_score":    round(mutation_score    * 100, 1),
        "test_effectiveness": round(test_effectiveness * 100, 1),
        "deployment_score":  round(deploy_score       * 100, 1),
        "final_score":       round(final              * 100, 1),
        "confidence": (
            "HIGH"   if final >= 0.8
            else "MEDIUM" if final >= 0.6
            else "LOW"
        ),
    }


async def validate_deployment_url(url: str) -> bool:
    if not url or "mock" in url:
        return False
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                return resp.status == 200
    except Exception:
        return False
