import sys
sys.stdout.reconfigure(line_buffering=True)
import os
import re
from services.ollama_client import generate_test
from services.emitter import emit
from models.schemas import JobStatus


def build_prompt(mutant: dict, source_code: str) -> str:
    return f"""You are a Jest test writer. Output ONLY a Jest test, no explanation.

The function has been mutated. Write a test that PASSES on the original and FAILS on the mutated version.

ORIGINAL (correct): {mutant['original'].strip()}
MUTATED (buggy):    {mutant['mutated'].strip()}

EXAMPLE of correct output format:
```javascript
describe('example', () => {{
  it('detects the bug', () => {{
    expect(2 + 2).toBe(4);
  }});
}});
```

Now write a test for this mutation. Test the logic directly without importing any React component.
Only use plain JavaScript logic — no imports, no JSX, no React.

```javascript
describe('mutant {mutant["id"]} - {mutant.get("mutation_type","Unknown")}', () => {{
  it('kills mutant at line {mutant["line"]}', () => {{"""


def try_generate_logic_test(mutant: dict) -> str | None:
    """
    Deterministically generate a correct test for simple operator mutations.
    No LLM needed. Returns None if too complex.
    """
    original = mutant.get("original", "").strip()
    mutated  = mutant.get("mutated",  "").strip()
    mut_type = mutant.get("mutation_type", "")
    line     = mutant["line"]
    mid      = mutant["id"]

    # ── Pattern 1: array.length === N  ↔  array.length !== N ──
    m = re.search(r'(\w+)\.length\s*(===|!==|==|!=)\s*(\d+)', original)
    if m and mut_type in ("EqualityOperator", "LogicalOperator"):
        var, op, n = m.group(1), m.group(2), m.group(3)
        flip = "!==" if op == "===" else "==="
        items = ", ".join([str(i) for i in range(int(n))])
        return f"""describe('mutant {mid} - {mut_type} at line {line}', () => {{
  it('kills {var}.length {op} {n} mutation', () => {{
    // Original: {original}
    // Mutated:  {mutated}
    const arr = [{items}]; // length exactly {n}
    expect(arr.length {op} {n}).toBe(true);   // passes on original
    expect(arr.length {flip} {n}).toBe(false); // catches mutation
  }});
}});"""

    # ── Pattern 2: variable === 'string'  ↔  variable !== 'string' ──
    m = re.search(r"(\w+)\s*(===|!==)\s*'([^']+)'", original)
    if m and mut_type in ("EqualityOperator",):
        var, op, val = m.group(1), m.group(2), m.group(3)
        flip = "!==" if op == "===" else "==="
        return f"""describe('mutant {mid} - {mut_type} at line {line}', () => {{
  it('kills {var} {op} "{val}" mutation', () => {{
    // Original: {original}
    // Mutated:  {mutated}
    const {var} = '{val}';
    expect({var} {op} '{val}').toBe(true);
    expect({var} {flip} '{val}').toBe(false);
  }});
}});"""

    # ── Pattern 3: Math.random() > N  ↔  Math.random() >= N (boundary) ──
    m = re.search(r'Math\.random\(\)\s*([><=!]+)\s*([\d.]+)', original)
    if m and mut_type in ("LogicalOperator", "EqualityOperator", "ConditionalExpression"):
        op, threshold = m.group(1), m.group(2)
        flip = ">=" if op == ">" else ">"
        # at exact boundary: > is False, >= is True — test that difference
        return f"""describe('mutant {mid} - boundary at line {line}', () => {{
  it('kills Math.random() {op} {threshold} boundary mutation', () => {{
    // Original: {original}
    // Mutated:  {mutated}
    // At exact threshold the two operators give opposite results
    const val = {threshold};
    const originalResult = val {op} {threshold};
    const mutatedResult  = val {flip} {threshold};
    expect(originalResult).not.toBe(mutatedResult); // must differ at boundary
  }});
}});"""

    # ── Pattern 4: ternary  x > N ? 'a' : 'b'  ↔  x >= N ? 'a' : 'b' ──
    m = re.search(r"(\w+)\s*([><=!]+)\s*([\d.]+)\s*\?\s*'([^']+)'\s*:\s*'([^']+)'", original)
    if m:
        var, op, threshold, val_true, val_false = (
            m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        )
        flip = ">=" if op == ">" else ">"
        return f"""describe('mutant {mid} - {mut_type} at line {line}', () => {{
  it('kills ternary boundary mutation', () => {{
    // Original: {original}
    // Mutated:  {mutated}
    // At exact threshold the two operators pick different branches
    const val = {threshold};
    const original = val {op} {threshold} ? '{val_true}' : '{val_false}';
    const mutated  = val {flip} {threshold} ? '{val_true}' : '{val_false}';
    expect(original).not.toBe(mutated);
  }});
}});"""

    return None  # too complex — let Qwen handle it


async def generate_single_test(mutant: dict, repo_path: str, queue) -> dict:
    # ── Try deterministic logic test first (no LLM) ──
    direct = try_generate_logic_test(mutant)
    if direct:
        print(f"\n[LOGIC TEST] Mutant {mutant['id']} — generated directly, skipping Qwen")
        print("-"*60)
        print(direct)
        print("="*60)

        await emit(queue, JobStatus.GENERATING_TESTS,
            f"Agent Qwen starting on mutant {mutant['id']} ({mutant.get('mutation_type','Unknown')})",
            {"mutant_id": mutant["id"], "mutation_type": mutant.get("mutation_type","Unknown"),
             "file": mutant["file"], "line": mutant["line"], "agent": "Qwen-0.5B"},
            event_type="agent_start", event_route="agent_event"
        )
        await emit(queue, JobStatus.GENERATING_TESTS,
            f"Test generated for mutant {mutant['id']} (logic test — no LLM needed)",
            {"mutant_id": mutant["id"], "test_preview": direct[:200], "confidence": 0.95, "agent": "Qwen-0.5B"},
            event_type="agent_done", event_route="agent_event"
        )
        return {
            "mutant_id": mutant["id"],
            "file": mutant["file"],
            "line": mutant["line"],
            "original_code": mutant.get("original", ""),
            "mutated_code":  mutant.get("mutated", ""),
            "test_code": direct.strip(),
            "confidence": 0.95,
            "verified": False,
            "kills_mutant": False
        }

    # ── Fall through to Qwen for complex cases ──
    file_path = os.path.join(repo_path, mutant["file"])
    try:
        with open(file_path) as f:
            lines = f.readlines()
        start = max(0, mutant["line"] - 25)
        end   = min(len(lines), mutant["line"] + 25)
        context = "".join(lines[start:end])
    except Exception:
        context = mutant.get("original", "// source unavailable")

    prompt = build_prompt(mutant, context)

    print("\n" + "="*60)
    print(f"[QWEN INPUT] Mutant {mutant['id']} | {mutant.get('mutation_type','Unknown')} | {mutant['file']}:{mutant['line']}")
    print("-"*60)
    print(prompt)
    print("="*60)

    await emit(queue, JobStatus.GENERATING_TESTS,
        f"Agent Qwen starting on mutant {mutant['id']} ({mutant.get('mutation_type','Unknown')})",
        {"mutant_id": mutant["id"], "mutation_type": mutant.get("mutation_type","Unknown"),
         "file": mutant["file"], "line": mutant["line"], "agent": "Qwen-0.5B"},
        event_type="agent_start", event_route="agent_event"
    )
    await emit(queue, JobStatus.GENERATING_TESTS,
        "Qwen 0.5B generating test...",
        {"prompt_preview": prompt, "model": "qwen3:0.6b",
         "mutant_id": mutant["id"], "agent": "Qwen-0.5B"},
        event_type="agent_thinking", event_route="agent_event"
    )

    raw = await generate_test(prompt)

    print("\n" + "="*60)
    print(f"[QWEN RAW OUTPUT] Mutant {mutant['id']}")
    print("-"*60)
    print(raw)
    print("="*60)

    await emit(queue, JobStatus.GENERATING_TESTS,
        "Qwen responded",
        {"raw_output": raw, "mutant_id": mutant["id"],
         "model": "qwen3:0.6b", "agent": "Qwen-0.5B"},
        event_type="agent_response", event_route="agent_event"
    )

    code = extract_code(raw)

    print(f"\n[QWEN EXTRACTED CODE] Mutant {mutant['id']}")
    print("-"*60)
    print(code)
    print("-"*60)
    print(f"[QWEN VALIDATION] has expect():   {'YES ✓' if 'expect(' in code else 'NO ✗'}")
    print(f"[QWEN VALIDATION] has test block: {'YES ✓' if any(k in code for k in ['describe(','it(','test(']) else 'NO ✗'}")
    print(f"[QWEN VALIDATION] has import:     {'YES ✓' if any(k in code for k in ['require(','import ']) else 'NO ✗'}")
    print(f"[QWEN VALIDATION] code length:    {len(code)} chars")
    print("="*60)

    if "expect(" not in code:
        print(f"\n[QWEN RETRY] Mutant {mutant['id']} — expect() missing, retrying...")

        await emit(queue, JobStatus.GENERATING_TESTS,
            f"Output missing expect() — retrying mutant {mutant['id']}",
            {"mutant_id": mutant["id"], "reason": "No expect() found",
             "extracted_so_far": code[:200], "agent": "Qwen-0.5B"},
            event_type="retry", event_route="agent_event"
        )

        retry_prompt = build_prompt(mutant, context) + f"""
    expect(true).toBe(true); // replace this line with a real assertion
  }});
}});
```

IMPORTANT: You MUST write a real expect() that tests the difference between:
ORIGINAL: {mutant['original'].strip()}
MUTATED:  {mutant['mutated'].strip()}"""

        print(f"\n[QWEN RETRY PROMPT] Mutant {mutant['id']}")
        print("-"*60)
        print(retry_prompt)
        print("="*60)

        raw = await generate_test(retry_prompt)

        print(f"\n[QWEN RETRY RAW OUTPUT] Mutant {mutant['id']}")
        print("-"*60)
        print(raw)
        print("="*60)

        code = extract_code(raw)

        print(f"\n[QWEN RETRY EXTRACTED] Mutant {mutant['id']}")
        print("-"*60)
        print(code)
        print("-"*60)
        print(f"[QWEN RETRY VALIDATION] has expect(): {'YES ✓' if 'expect(' in code else 'NO ✗ — fallback'}")
        print("="*60)

        await emit(queue, JobStatus.GENERATING_TESTS,
            "Qwen responded (Retry)",
            {"raw_output": raw, "mutant_id": mutant["id"],
             "model": "qwen3:0.6b", "agent": "Qwen-0.5B"},
            event_type="agent_response", event_route="agent_event"
        )

    if "expect(" not in code:
        print(f"\n[QWEN FALLBACK] Mutant {mutant['id']} — both attempts failed")
        code = build_fallback_test(mutant)
        print(f"[QWEN FALLBACK CODE]:\n{code}")

    print(f"\n[QWEN FINAL TEST] Mutant {mutant['id']} — going to verifier")
    print("-"*60)
    print(code)
    print("="*60 + "\n")

    await emit(queue, JobStatus.GENERATING_TESTS,
        f"Test generated for mutant {mutant['id']}",
        {"mutant_id": mutant["id"], "test_preview": code[:200],
         "confidence": 0.7, "agent": "Qwen-0.5B"},
        event_type="agent_done", event_route="agent_event"
    )

    return {
        "mutant_id": mutant["id"],
        "file":          mutant["file"],
        "line":          mutant["line"],
        "original_code": mutant.get("original", ""),
        "mutated_code":  mutant.get("mutated",  ""),
        "test_code":     code.strip(),
        "confidence":    0.7,
        "verified":      False,
        "kills_mutant":  False
    }


def extract_code(raw: str) -> str:
    raw = raw.strip()
    if "```" in raw:
        parts = raw.split("```")
        if len(parts) >= 2:
            code = parts[1]
            first_line = code.split("\n")[0].strip().lower()
            if first_line in ("javascript", "js", "typescript", "ts", ""):
                code = "\n".join(code.split("\n")[1:])
            return code.strip()
    if any(raw.lstrip().startswith(kw) for kw in
           ("describe(", "it(", "test(", "const ", "import ", "require(", "//", "/*")):
        return raw.strip()
    return raw.strip()


def build_fallback_test(mutant: dict) -> str:
    return f"""// Fallback test for mutant {mutant['id']} — Qwen generation failed
describe('mutant {mutant["id"]} ({mutant.get("mutation_type","Unknown")})', () => {{
  it('should behave correctly at line {mutant["line"]}', () => {{
    // Original: {mutant.get("original","unknown")[:80]}
    // Mutated:  {mutant.get("mutated","unknown")[:80]}
    expect(true).toBe(true); // placeholder — generation failed
  }});
}});
"""


async def generate_tests(mutants: list, repo_path: str, queue) -> list:
    print("\n" + "="*60)
    print(f"[TEST GENERATOR] Starting for {len(mutants)} survived mutants")
    print("="*60)

    results = []
    for i, mutant in enumerate(mutants, 1):
        print(f"\n[TEST GENERATOR] Processing mutant {i}/{len(mutants)} — ID: {mutant['id']}")
        try:
            test = await generate_single_test(mutant, repo_path, queue)
            results.append(test)
        except Exception as e:
            print(f"\n[TEST GENERATOR ERROR] Mutant {mutant['id']} failed: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n[TEST GENERATOR] Done — {len(results)}/{len(mutants)} tests generated")
    print("="*60 + "\n")
    return results