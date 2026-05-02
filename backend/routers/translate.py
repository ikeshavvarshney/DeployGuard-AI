from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ollama_client import get_completion, MODELS
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class TranslateRequest(BaseModel):
    query: str
    category: str

def get_system_prompt(category: str) -> str:
    prompts = {
        "git": "You are a Git expert. Convert the user's plain English description into the exact Git command(s) needed. Output format must be JSON only: {\"command\": \"git ...\", \"explanation\": \"step by step breakdown\", \"variations\": [\"related query 1\", \"related query 2\"]}. The command must be immediately runnable in a terminal. If multiple commands are needed, join with && or show on separate lines with \\n. Never explain outside the JSON.",
        "sql": "You are a SQL expert. Convert the user's plain English into a clean SQL query. Assume standard PostgreSQL syntax unless specified. Output JSON only: {\"command\": \"SELECT ...\", \"explanation\": \"what each clause does\", \"variations\": [\"variation 1\", \"variation 2\"]}. Format the SQL with newlines for readability. Never explain outside the JSON.",
        "mongodb": "You are a MongoDB expert. Convert the user's plain English into the exact MongoDB shell command or query. Output JSON only: {\"command\": \"db.collection.find(...)\", \"explanation\": \"breakdown of each part\", \"variations\": [\"variation 1\", \"variation 2\"]}. Never explain outside the JSON.",
        "shell": "You are a Linux/Bash expert. Convert the user's plain English into the exact shell command. Prefer POSIX-compatible commands. Output JSON only: {\"command\": \"...\", \"explanation\": \"what each flag and part does\", \"variations\": [\"variation 1\", \"variation 2\"]}. Include a safety warning in explanation if command is destructive (rm, chmod 777, etc). Never explain outside the JSON.",
        "docker": "You are a Docker expert. Convert the user's plain English into the exact Docker CLI command. Output JSON only: {\"command\": \"docker ...\", \"explanation\": \"what each flag does\", \"variations\": [\"variation 1\", \"variation 2\"]}. Never explain outside the JSON.",
        "npm": "You are an npm/Node.js expert. Convert the user's plain English into the exact npm or npx command. Output JSON only: {\"command\": \"npm ...\", \"explanation\": \"what this does and any side effects\", \"variations\": [\"variation 1\", \"variation 2\"]}. Never explain outside the JSON."
    }
    return prompts.get(category, prompts["shell"])

def extract_json_from_response(text: str):
    """Attempt to extract and parse JSON from the raw LLM response."""
    # Sometimes models wrap in markdown blocks
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None

@router.post("/")
async def translate_command(req: TranslateRequest):
    sys_prompt = get_system_prompt(req.category)
    prompt = f"{sys_prompt}\n\nUser Query: {req.query}"
    
    # First attempt
    response_text = await get_completion(prompt, model_key="reasoning")
    
    parsed = extract_json_from_response(response_text)
    
    # Retry once if parsing fails
    if parsed is None:
        logger.warning("Failed to parse JSON, retrying...")
        retry_prompt = f"{prompt}\n\nERROR: Previous response was not valid JSON. output valid JSON only, no markdown fences."
        response_text = await get_completion(retry_prompt, model_key="reasoning")
        parsed = extract_json_from_response(response_text)
        
        if parsed is None:
            raise HTTPException(status_code=500, detail="Model returned invalid response, please rephrase")
            
    # Add category and model info to response
    parsed["category"] = req.category
    parsed["model"] = MODELS.get("reasoning", "gemma3:1b")
    
    return parsed
