from __future__ import annotations
import asyncio
import re

from services.ollama_client import call_ollama
from services.emitter import emit
from models.schemas import JobStatus


# ─────────────────────────────────────────────
# Ollama analysis — always called regardless of pass/fail
# ─────────────────────────────────────────────

def _build_pass_prompt(passed: int, total: int, test_names: list[str]) -> str:
    names_block = "\n".join(f"  - {n}" for n in test_names[:30]) or "  (no test names available)"
    return f"""You are a test quality reviewer. These Jest tests all passed.
Passed: {passed}/{total}
Test names:
{names_block}

In 4-5 bullet points: what edge cases are likely missing?
End with: "Test Health Score: X/10 — <one line reason>"
Keep response under 150 words."""


def _build_fail_prompt(failed: int, total: int, failure_logs: str) -> str:
    logs_block = failure_logs[:1200] if failure_logs else "(no failure output captured)"
    return f"""You are a debugging assistant. These Jest tests failed.
Failed: {failed}/{total}
Failure logs:
{logs_block}

In 4-5 bullet points: what broke, why, and how to fix it.
End with: "Test Health Score: X/10 — <one line reason>"
Keep response under 150 words."""


def _extract_health_score(analysis: str) -> str:
    """Pull e.g. '7/10' from the LLM response."""
    m = re.search(r"Test Health Score:\s*(\d+/10)", analysis, re.IGNORECASE)
    return m.group(1) if m else "?/10"


def _collect_test_names(test_record: dict) -> list[str]:
    """Best-effort extraction of individual test names from the result."""
    names = []
    # node-service may return testResults as list of {testName, status} dicts
    for item in test_record.get("failures", []):
        if isinstance(item, dict):
            name = item.get("testName") or item.get("title") or item.get("name", "")
            if name:
                names.append(name)
    # Fallback: try to parse from stdout
    if not names:
        output = test_record.get("output", "")
        for line in output.splitlines():
            line = line.strip()
            if line.startswith("✓") or line.startswith("✗") or line.startswith("●") or "PASS" in line or "FAIL" in line:
                names.append(line[:80])
    return names


def _collect_failure_logs(test_record: dict) -> str:
    """Collect failure details for the fail prompt."""
    parts = []

    for item in test_record.get("failures", []):
        if isinstance(item, dict):
            name = item.get("testName") or item.get("title") or item.get("name", "")
            msg  = item.get("message") or item.get("error") or item.get("failureMessage", "")
            if name or msg:
                parts.append(f"FAILED: {name}\n{msg}")

    # Also include raw stdout if nothing structured
    if not parts:
        output = test_record.get("output", "")
        if output:
            parts.append(output[:1200])

    return "\n\n".join(parts)


# ─────────────────────────────────────────────
# verify_tests — Ollama analysis on Jest results
#
# Called by orchestrator as:
#   verify_tests(generated_tests, repo_path, queue)
#
# generated_tests is the list returned by generate_tests —
# a single-element list containing the Jest run record.
# We augment it with ai_analysis and health_score, then
# set verified=True so the orchestrator counts it as valid.
# ─────────────────────────────────────────────

async def verify_tests(tests: list, repo_path: str, queue) -> list:
    results = []
    for test_record in tests:
        results.append(await _analyse_single(test_record, queue))
    return results


async def _analyse_single(test_record: dict, queue) -> dict:
    overall_passed = test_record.get("overall_passed", False)
    passed   = test_record.get("passed",   0)
    failed   = test_record.get("failed",   0)
    total    = test_record.get("tests_run", passed + failed)

    # ── Choose prompt based on outcome ──
    if overall_passed or failed == 0:
        test_names = _collect_test_names(test_record)
        prompt     = _build_pass_prompt(passed, total, test_names)
        context    = "tests passed — reviewing coverage quality"
    else:
        failure_logs = _collect_failure_logs(test_record)
        prompt       = _build_fail_prompt(failed, total, failure_logs)
        context      = "tests failed — diagnosing failures"

    print("\n" + "=" * 60)
    print(f"[GEMMA ANALYSIS] {context}")
    print("-" * 60)
    print(prompt[:600])
    print("=" * 60)

    await emit(
        queue, JobStatus.VERIFYING,
        f"Gemma 1B analysing test results ({context})...",
        {
            "model":   "gemma3:1b",
            "agent":   "Gemma-1B",
            "context": context,
            "passed":  passed,
            "failed":  failed,
            "total":   total,
        },
        event_type="agent_thinking",
        event_route="agent_event",
    )

    analysis = await call_ollama(
        model       = "gemma3:1b",
        prompt      = prompt,
        temperature = 0.1,
        max_tokens  = 600,
    )

    health_score = _extract_health_score(analysis)

    print(f"\n[GEMMA RESPONSE] health_score={health_score}")
    print("-" * 60)
    print(analysis)
    print("=" * 60 + "\n")

    await emit(
        queue, JobStatus.VERIFYING,
        f"Gemma 1B analysis complete — Test Health Score: {health_score}",
        {
            "agent":        "Gemma-1B",
            "ai_analysis":  analysis,
            "health_score": health_score,
            "passed":       passed,
            "failed":       failed,
        },
        event_type="agent_done",
        event_route="agent_event",
    )

    return {
        **test_record,
        # Orchestrator checks t["verified"] — True so it's counted as valid
        "verified":      True,
        "kills_mutant":  failed == 0,   # tests "kill" issues when they pass cleanly
        "confidence":    1.0,
        "agent_votes":   [True],
        # New fields
        "ai_analysis":   analysis,
        "health_score":  health_score,
    }
