"""
routers/auth.py

GitHub OAuth flow for PR merging.
Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env

Routes (registered at prefix /api/auth):
  GET /api/auth/github          → redirect to GitHub OAuth
  GET /api/auth/github/callback → exchange code for token, store in localStorage
"""

import os
import aiohttp
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

router = APIRouter()

GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL          = os.getenv("BACKEND_URL", "http://localhost:8000")


@router.get("/github")
async def github_oauth_start(redirect: str = "/prscorer"):
    if not GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="GITHUB_CLIENT_ID not set in .env. "
                   "Create a GitHub OAuth App at https://github.com/settings/developers"
        )

    callback_url = f"{BACKEND_URL}/api/auth/github/callback"
    auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&scope=repo%20read:user"
        f"&state={redirect}"
        f"&redirect_uri={callback_url}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/github/callback")
async def github_oauth_callback(code: str, state: str = "/prscorer"):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return HTMLResponse(
            "<h3>OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env</h3>",
            status_code=500,
        )

    # Exchange code for access token
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": f"{BACKEND_URL}/api/auth/github/callback",
                },
                headers={"Accept": "application/json"},
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                data = await resp.json()
    except Exception as e:
        print(f"[AUTH] Token exchange failed: {e}")
        return HTMLResponse(f"""<!DOCTYPE html>
<html><body style="background:#080c12;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center">
<h2>OAuth Error</h2>
<p>Token exchange failed: {str(e)[:200]}</p>
<a href="{FRONTEND_URL}{state}" style="color:#60a5fa">Go back</a>
</div></body></html>""", status_code=500)

    print(f"[AUTH] GitHub token response keys: {list(data.keys())}")

    token = data.get("access_token", "")
    error = data.get("error", "")
    error_desc = data.get("error_description", "")

    if error or not token:
        msg = error_desc or error or "No access token returned"
        print(f"[AUTH] OAuth failed: {msg}")
        return HTMLResponse(f"""<!DOCTYPE html>
<html><body style="background:#080c12;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center">
<h2>GitHub OAuth Failed</h2>
<p style="color:#f87171">{msg}</p>
<a href="{FRONTEND_URL}{state}" style="color:#60a5fa">Try again</a>
</div></body></html>""", status_code=400)

    # Fetch user info for localStorage
    user_login = ""
    user_avatar = ""
    user_name = ""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "DeployGuard/1.0",
                },
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                user = await resp.json()
                user_login = user.get("login", "")
                user_avatar = user.get("avatar_url", "")
                user_name = user.get("name", "") or user_login
                print(f"[AUTH] Authenticated as @{user_login}")
    except Exception as e:
        print(f"[AUTH] Failed to fetch user info (continuing anyway): {e}")

    # Return HTML that stores token + user in localStorage, then redirects to frontend
    redirect_to = f"{FRONTEND_URL}{state}"
    # Escape single quotes in user data for JS safety
    safe_name = user_name.replace("'", "\\'").replace('"', '\\"')
    safe_login = user_login.replace("'", "\\'")

    return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head><title>GitHub Connected</title></head>
<body style="background:#080c12;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center">
<h2 style="color:#22c55e">GitHub Connected</h2>
<p>Signed in as @{user_login}</p>
<p style="color:#64748b;font-size:14px">Redirecting...</p>
<script>
try {{
  localStorage.setItem('github_token', '{token}');
  localStorage.setItem('github_user', JSON.stringify({{
    login: '{safe_login}',
    avatar_url: '{user_avatar}',
    name: '{safe_name}'
  }}));
}} catch(e) {{
  console.error('localStorage failed:', e);
}}
setTimeout(function() {{ window.location.href = '{redirect_to}'; }}, 500);
</script>
</div>
</body>
</html>""")
