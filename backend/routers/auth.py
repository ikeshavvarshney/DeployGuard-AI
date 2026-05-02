"""
routers/auth.py

GitHub OAuth flow for PR merging.
Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env
"""

import os
import aiohttp
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse

router = APIRouter()

CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")


@router.get("/github")
async def github_oauth_start(redirect: str = "/"):
    if not CLIENT_ID:
        return HTMLResponse("<h3>GitHub OAuth not configured. Set GITHUB_CLIENT_ID in .env</h3>", status_code=500)
    auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={CLIENT_ID}&scope=repo&state={redirect}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/github/callback")
async def github_oauth_callback(code: str, state: str = "/"):
    if not CLIENT_ID or not CLIENT_SECRET:
        return HTMLResponse("<h3>OAuth not configured</h3>", status_code=500)

    # Exchange code for token
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://github.com/login/oauth/access_token",
            json={"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET, "code": code},
            headers={"Accept": "application/json"},
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            data = await resp.json()

    token = data.get("access_token", "")
    error = data.get("error", "")

    if error or not token:
        return HTMLResponse(f"<h3>OAuth failed: {error or 'no token'}</h3>", status_code=400)

    # Return HTML that stores token in localStorage and redirects
    return HTMLResponse(f"""<!DOCTYPE html>
<html><head><title>Auth Success</title></head>
<body style="background:#080c12;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center">
<h2>✅ GitHub Connected</h2>
<p>Redirecting...</p>
<script>
localStorage.setItem('github_token', '{token}');
window.location.href = '{state}';
</script>
</div></body></html>""")
