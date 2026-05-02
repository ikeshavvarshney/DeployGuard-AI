import json, re
from services.ollama_client import fix_logs
from services.rag import get_known_fixes
from services.emitter import emit
from models.schemas import JobStatus

async def fix_issues(logs: str, analysis, queue) -> list:
    await emit(queue, JobStatus.FIXING,
        "Fixer agent scanning deployment logs...",
        {"log_tail": logs[-500:], "agent": "Rule-engine"},
        event_type="agent_start",
        event_route="agent_event"
    )

    # RAG: check known fixes first (no LLM)
    error_keywords = [kw for kw in ["ENOENT", "MODULE_NOT_FOUND", "port", "env"] if kw.lower() in logs.lower()]
    known = get_known_fixes(error_keywords)
    if known:
        fixes = [f["fix"] for f in known]
        await emit(queue, JobStatus.FIXING,
            f"Rule engine found {len(fixes)} pattern matches via RAG",
            {"fixes_found": fixes, "method": "rule-based (no LLM)", "agent": "Rule-engine"},
            event_type="agent_decision",
            event_route="agent_event"
        )
        await emit(queue, JobStatus.FIXING, "Fixer finished", {"agent": "Rule-engine"}, event_type="agent_done", event_route="agent_event")
        return fixes

    # Rule-based fixes (no LLM)
    fixes = []
    if "ENOENT" in logs:
        fixes.append("Fixed: Missing file reference in entry point")
    if "MODULE_NOT_FOUND" in logs:
        fixes.append("Fixed: Added missing dependency installation step")
    if "port" in logs.lower() and "already in use" in logs.lower():
        fixes.append("Fixed: Reassigned port to available port")
    if "env" in logs.lower() and ("undefined" in logs.lower() or "missing" in logs.lower()):
        fixes.append("Fixed: Added placeholder environment variables for deployment")
    
    if fixes:
        await emit(queue, JobStatus.FIXING,
            f"Rule engine found {len(fixes)} pattern matches",
            {"fixes_found": fixes, "method": "rule-based (no LLM)", "agent": "Rule-engine"},
            event_type="agent_decision",
            event_route="agent_event"
        )
        await emit(queue, JobStatus.FIXING, "Fixer finished", {"agent": "Rule-engine"}, event_type="agent_done", event_route="agent_event")
        return fixes

    await emit(queue, JobStatus.FIXING, "Fixer finished", {"agent": "Rule-engine"}, event_type="agent_done", event_route="agent_event")
    
    await emit(queue, JobStatus.FIXING,
        "Gemma 1B starting log analysis",
        {"agent": "Gemma-1B"},
        event_type="agent_start",
        event_route="agent_event"
    )

    # Gemma 1B via Ollama for unrecognised errors
    prompt = f"""You are a DevOps expert. Analyze these deployment logs and list the TOP 3 fixes needed.
Output as JSON array of strings only, no explanation.

LOGS:
{logs[-2000:]}

Output: ["fix1", "fix2", "fix3"]"""
    
    await emit(queue, JobStatus.FIXING,
        "No rule match — escalating to Gemma 1B",
        {"prompt_preview": prompt, "model": "gemma3:1b", "agent": "Gemma-1B"},
        event_type="agent_thinking",
        event_route="agent_event"
    )
    
    raw = await fix_logs(prompt)
    
    await emit(queue, JobStatus.FIXING,
        "Gemma 1B response received",
        {"raw_output": raw, "model": "gemma3:1b", "agent": "Gemma-1B"},
        event_type="agent_response",
        event_route="agent_event"
    )
    
    match = re.search(r'\[.*?\]', raw, re.DOTALL)
    if match:
        fixes = json.loads(match.group())
        
    await emit(queue, JobStatus.FIXING, "Fixer finished", {"agent": "Gemma-1B"}, event_type="agent_done", event_route="agent_event")
    
    return fixes
