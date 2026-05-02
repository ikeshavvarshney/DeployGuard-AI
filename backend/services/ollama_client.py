import aiohttp
import asyncio

OLLAMA_URL = "http://localhost:11434/api/generate"

MODELS = {
    "codegen": "qwen3:0.6b",
    "reasoning": "gemma3:1b",
}


async def get_completion(
    prompt: str,
    model_key: str = "reasoning",
    max_tokens: int = 512,
    temperature: float = 0.2,
    debug: bool = False,
) -> str:
    """
    Single unified LLM interface.
    Only supports predefined model keys.
    """

    if model_key not in MODELS:
        raise ValueError(f"Invalid model_key: {model_key}")

    model = MODELS[model_key]

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "think": False,
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
                    print(f"[OLLAMA ERROR] {resp.status} | {model}: {text}")
                    return ""

                data = await resp.json()

                if debug:
                    print(f"\n[OLLAMA DEBUG] model={model}")
                    print(f"thinking: {str(data.get('thinking',''))[:200]}")
                    print(f"response: {str(data.get('response',''))[:500]}")
                    print(f"done_reason: {data.get('done_reason','')}")

                response = data.get("response", "").strip()

                # strip <think> garbage if model leaks it
                if "<think>" in response:
                    if "</think>" in response:
                        response = response.split("</think>")[-1].strip()
                    else:
                        print("[OLLAMA WARNING] Unclosed <think> tag")
                        return ""

                return response

    except asyncio.TimeoutError:
        print(f"[OLLAMA TIMEOUT] {model} >120s")
        return ""

    except Exception as e:
        print(f"[OLLAMA EXCEPTION] {model}: {e}")
        return ""


# ─────────────────────────────────────────────
# Task-specific wrappers (clean + consistent)
# ─────────────────────────────────────────────

async def generate_test(prompt: str) -> str:
    return await get_completion(
        prompt,
        model_key="codegen",
        max_tokens=512,
        temperature=0.2,
    )


async def verify_syntax(prompt: str) -> str:
    return await get_completion(
        prompt,
        model_key="reasoning",
        max_tokens=10,
        temperature=0.0,
    )


async def fix_logs(prompt: str) -> str:
    return await get_completion(
        prompt,
        model_key="reasoning",
        max_tokens=200,
        temperature=0.1,
    )