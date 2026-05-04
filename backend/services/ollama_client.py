import aiohttp
import asyncio

OLLAMA_URL = "http://localhost:11434/api/generate"

# ─── Model registry ───────────────────────────────────────────────────────────
# qwen3:0.6b → test generation (fast, code-focused)
# gemma3:1b          → verification YES/NO and log fixing

MODELS = {
    "codegen":   "qwen3:0.6b",
    "reasoning": "gemma3:1b",
}


async def call_ollama(
    model: str,
    prompt: str,
    temperature: float = 0.1,
    max_tokens: int = 600,
) -> str:
    """
    Low-level Ollama call. Uses /api/generate (non-streaming).
    Response format: {"response": "...", "done": true}
    """
    payload = {
        "model":  model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                OLLAMA_URL,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=120),
            ) as resp:

                if resp.status != 200:
                    text = await resp.text()
                    print(f"[OLLAMA ERROR] {resp.status} | {model}: {text[:200]}")
                    return ""

                data = await resp.json()

                response = data.get("response", "").strip()

                # Strip <think>…</think> blocks if model leaks reasoning
                if "<think>" in response:
                    if "</think>" in response:
                        response = response.split("</think>")[-1].strip()
                    else:
                        print("[OLLAMA WARNING] Unclosed <think> tag — returning empty")
                        return ""

                return response

    except asyncio.TimeoutError:
        print(f"[OLLAMA TIMEOUT] {model} >120s")
        return ""
    except Exception as e:
        print(f"[OLLAMA EXCEPTION] {model}: {e}")
        return ""


# ─── Shared completion helper (keeps model_key API for existing callers) ───────

async def get_completion(
    prompt: str,
    model_key: str = "reasoning",
    max_tokens: int = 512,
    temperature: float = 0.1,
    debug: bool = False,
) -> str:
    if model_key not in MODELS:
        raise ValueError(f"Invalid model_key: {model_key!r}. Valid: {list(MODELS)}")

    model  = MODELS[model_key]
    result = await call_ollama(model, prompt, temperature, max_tokens)

    if debug:
        print(f"\n[OLLAMA DEBUG] model={model}")
        print(f"response: {result[:500]}")

    return result


# ─── Task-specific wrappers ────────────────────────────────────────────────────

async def generate_test(prompt: str) -> str:
    """
    Qwen3 0.6B — test generation.
    Low temperature (0.1) to reduce hallucination / placeholder output.
    """
    return await call_ollama(
        model       = MODELS["codegen"],
        prompt      = prompt,
        temperature = 0.1,
        max_tokens  = 600,
    )


async def verify_syntax(prompt: str) -> str:
    """
    Gemma 3 1B — YES/NO syntax / structure check.
    Temperature 0.0 for deterministic output.
    """
    return await call_ollama(
        model       = MODELS["reasoning"],
        prompt      = prompt,
        temperature = 0.0,
        max_tokens  = 10,
    )


async def fix_logs(prompt: str) -> str:
    """
    Gemma 3 1B — deployment log analysis and fix suggestions.
    """
    return await call_ollama(
        model       = MODELS["reasoning"],
        prompt      = prompt,
        temperature = 0.1,
        max_tokens  = 200,
    )