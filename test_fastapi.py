import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        # 1. Post to jobs
        print("POSTing to /api/jobs")
        res = await client.post("http://127.0.0.1:8000/api/jobs", json={"github_url": "https://github.com/expressjs/express"})
        print(res.status_code, res.text)
        job_id = res.json()["job_id"]
        
        # 2. Stream
        print(f"GETting /api/jobs/{job_id}/stream")
        async with client.stream("GET", f"http://127.0.0.1:8000/api/jobs/{job_id}/stream") as response:
            async for chunk in response.aiter_text():
                print("CHUNK:", chunk)

asyncio.run(test())
