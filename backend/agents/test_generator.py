import sys
sys.stdout.reconfigure(line_buffering=True)

from services.node_bridge import run_tests
from services.emitter import emit
from models.schemas import JobStatus


# ─────────────────────────────────────────────
# generate_tests — run the repo's existing Jest suite
#
# Called by orchestrator as:
#   generate_tests(survived_mutants, repo_path, queue)
#
# We ignore the mutants list — the new flow runs the existing
# tests from the repo directly, rather than generating new ones.
# Returns a single-element list so the rest of the pipeline
# (verify_tests, valid_tests count, etc.) keeps working.
# ─────────────────────────────────────────────

async def generate_tests(mutants: list, repo_path: str, queue) -> list:
    print("\n" + "=" * 60)
    print(f"[TEST RUNNER] Running existing Jest suite in sandbox for repo: {repo_path}")
    print("=" * 60)

    await emit(
        queue, JobStatus.GENERATING_TESTS,
        "Running existing Jest tests in Docker sandbox...",
        {"repo_path": repo_path, "agent": "Jest-Runner"},
        event_type="agent_start",
        event_route="agent_event",
    )

    try:
        result = await run_tests(repo_path)
    except Exception as e:
        print(f"[TEST RUNNER ERROR] Jest call failed: {e}")
        result = {"passed": False, "error": str(e)}

    # Normalise the response from the node service.
    # /run-tests typically returns:
    #   { passed: bool, numPassedTests: int, numFailedTests: int,
    #     testResults: [...], output: str, ... }
    tests_run  = result.get("numTotalTests",  result.get("total",   0))
    passed     = result.get("numPassedTests", result.get("passed_count", 0))
    failed     = result.get("numFailedTests", result.get("failed_count", 0))
    output     = result.get("output", result.get("stdout", ""))
    failures   = result.get("failures",    result.get("testResults", []))

    # If the node service only gave us a boolean "passed", derive counts
    if tests_run == 0 and output:
        # Best-effort parse from Jest stdout
        import re
        m = re.search(r"Tests:\s+(\d+) failed,\s+(\d+) passed,\s+(\d+) total", output)
        if m:
            failed, passed, tests_run = int(m.group(1)), int(m.group(2)), int(m.group(3))
        else:
            m = re.search(r"Tests:\s+(\d+) passed,\s+(\d+) total", output)
            if m:
                passed, tests_run = int(m.group(1)), int(m.group(2))
                failed = tests_run - passed

    overall_passed = result.get("passed", failed == 0)

    print(f"[TEST RUNNER] Result — passed: {passed}, failed: {failed}, total: {tests_run}")
    print(f"[TEST RUNNER] Overall: {'✓ PASS' if overall_passed else '✗ FAIL'}")
    if output:
        print(f"[TEST RUNNER] Output (truncated):\n{output[:600]}")
    print("=" * 60 + "\n")

    await emit(
        queue, JobStatus.GENERATING_TESTS,
        f"Jest suite complete — {passed} passed, {failed} failed out of {tests_run} tests",
        {
            "tests_run":      tests_run,
            "passed":         passed,
            "failed":         failed,
            "overall_passed": overall_passed,
            "agent":          "Jest-Runner",
        },
        event_type="agent_done",
        event_route="agent_event",
    )

    # Build the single result record that verify_tests will receive
    test_record = {
        # Required by orchestrator interface
        "mutant_id":      "jest_suite",
        "verified":       False,   # verifier will set this
        "kills_mutant":   False,
        "confidence":     0.0,
        # Test run data
        "tests_run":      tests_run,
        "passed":         passed,
        "failed":         failed,
        "overall_passed": overall_passed,
        "failures":       failures,
        "output":         output,
        # Populated by verifier
        "ai_analysis":    "",
        "health_score":   "?/10",
    }

    return [test_record]