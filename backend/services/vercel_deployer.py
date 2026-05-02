import os
import json
import asyncio
import subprocess
import re
import traceback
import httpx
from .scoring import validate_deployment_url

# VERCEL_TOKEN must be set in .env — get from vercel.com/account/tokens
# (Token is read lazily inside the function so dotenv has time to load)

def strip_ansi(text: str) -> str:
    return re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', text)

async def deploy_to_vercel(repo_path: str, framework: str, repo_name: str, queue: asyncio.Queue = None) -> dict:
    try:
        VERCEL_TOKEN = os.getenv("VERCEL_TOKEN", "")
        if not VERCEL_TOKEN:
            raise ValueError(
                "VERCEL_TOKEN is not set. Add it to your .env file at the project root."
            )
        print(f"[VercelDeployer] Starting deployment for {repo_name} at {repo_path}")
        
        # Step 1: Auto-generate vercel.json
        vercel_json_path = os.path.join(repo_path, "vercel.json")
        vercel_config = {"env": {}, "build": {"env": {}}}
        
        if framework and framework.lower() == "nextjs":
            vercel_config.update({
                "framework": "nextjs",
                "buildCommand": "npm run build",
                "outputDirectory": ".next"
            })
        else: # node or express
            vercel_config.update({
                "framework": None,
                "buildCommand": "npm run build --if-present",
                "outputDirectory": "dist",
                "rewrites": [{"source": "/(.*)", "destination": "/api/index.js"}]
            })
            
        with open(vercel_json_path, "w") as f:
            json.dump(vercel_config, f, indent=2)
        print(f"[VercelDeployer] Wrote vercel.json for {framework}")

        # Step 2: Install Vercel CLI locally if not present
        which_result = await asyncio.create_subprocess_exec("which", "vercel", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        await which_result.communicate()
        if which_result.returncode != 0:
            print("[VercelDeployer] Vercel CLI not found. Installing globally...")
            install_result = await asyncio.create_subprocess_exec("npm", "install", "-g", "vercel")
            await install_result.communicate()
            
        # Step 3: Run the deploy command
        project_name = f"deployguard-{repo_name.lower().replace('_', '-')}"
        cmd = [
            "vercel", "deploy",
            "--token", VERCEL_TOKEN,
            "--yes", "--prod",
            "--public",
            "--name", project_name
        ]
        
        print(f"[VercelDeployer] Running deployment command...")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=repo_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout_str = ""
        stderr_str = ""
        
        async def stream_output(stream, is_stderr=False):
            nonlocal stdout_str, stderr_str
            while True:
                line = await stream.readline()
                if not line:
                    break
                line_str = line.decode()
                if is_stderr:
                    stderr_str += line_str
                else:
                    stdout_str += line_str
                
                clean_line = strip_ansi(line_str).strip()
                if clean_line and queue:
                    from .emitter import emit
                    from models.schemas import JobStatus
                    await emit(queue, JobStatus.DEPLOYING, f"[Vercel] {clean_line}", event_route="log")

        await asyncio.wait_for(asyncio.gather(
            stream_output(process.stdout),
            stream_output(process.stderr, True)
        ), timeout=120)
        
        await process.wait()
        
        combined_logs = (stdout_str + "\n" + stderr_str)[-2000:]
        
        print(f"[VercelDeployer] Command finished with exit code {process.returncode}")
        
        # Step 4: Parse the deployment URL
        # Priority: Aliased URL > Production URL > any vercel.app URL
        # The Aliased URL is the clean public one (e.g. deployguard-abc123.vercel.app)
        # The preview URL has commit-hash + team slug appended and is auth-gated
        clean_stdout = strip_ansi(stdout_str + "\n" + stderr_str)

        # Try to grab the Aliased line URL first (cleanest public URL)
        aliased_match = re.search(r'Aliased:\s*(https://[^\s]+)', clean_stdout)
        production_match = re.search(r'Production:\s*(https://[^\s]+)', clean_stdout)
        all_urls = re.findall(r'https://[a-zA-Z0-9\-\.]+\.vercel\.app', clean_stdout)

        if aliased_match:
            url = aliased_match.group(1).strip()
            print(f"[VercelDeployer] Using Aliased URL: {url}")
        elif production_match:
            url = production_match.group(1).strip()
            print(f"[VercelDeployer] Using Production URL: {url}")
        elif all_urls:
            url = all_urls[-1]
            print(f"[VercelDeployer] Using last found URL: {url}")
        else:
            url = None
        
        if url:
            print(f"[VercelDeployer] Found deployment URL: {url}")
            # Step 5: Validate URL
            is_valid = await validate_deployment_url(url)
            if not is_valid:
                print(f"[VercelDeployer] First check failed, retrying in 5 seconds...")
                await asyncio.sleep(5)
                is_valid = await validate_deployment_url(url)
                
            return {
                "success": is_valid,
                "url": url,
                "logs": combined_logs,
                "repo_path": repo_path,
                "vercel_project": project_name
            }
        else:
            print(f"[VercelDeployer] URL not found in output.")
            return {
                "success": False,
                "url": None,
                "logs": combined_logs,
                "repo_path": repo_path,
                "vercel_project": project_name
            }
            
    except Exception as e:
        print(f"[VercelDeployer] Exception: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "url": None,
            "logs": str(e),
            "repo_path": repo_path,
            "vercel_project": ""
        }

async def get_deployment_status(url: str) -> dict:
    if not url:
        return {"live": False, "status_code": 0, "response_time_ms": 0}
        
    import time
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            end_time = time.time()
            return {
                "live": resp.status_code == 200,
                "status_code": resp.status_code,
                "response_time_ms": round((end_time - start_time) * 1000, 2)
            }
    except Exception:
        return {"live": False, "status_code": 0, "response_time_ms": 0}
