====================================================
DEPLOYGUARD AI - BACKEND DOCUMENTATION
====================================================

This document provides a complete technical breakdown of the backend system
powering DeployGuard AI.

The backend is built using FastAPI and acts as the central orchestration layer
for deployment automation, mutation testing, AI-driven analysis, and system
coordination.

----------------------------------------------------
1. ARCHITECTURE OVERVIEW
----------------------------------------------------

The backend functions as the "brain" of the system. It is responsible for:

- Orchestrating end-to-end deployment pipelines
- Managing asynchronous jobs
- Streaming real-time updates via SSE
- Interacting with LLMs (via Ollama)
- Communicating with the Node.js execution service
- Serving APIs for all frontend features

Key Design Pattern:
→ Async, event-driven, job-based architecture

----------------------------------------------------
2. ENTRY POINT (main.py)
----------------------------------------------------

File: backend/main.py

Responsibilities:
- Initializes FastAPI app
- Configures middleware
- Defines core API routes
- Manages job lifecycle

Middleware:
- CORS → allows frontend communication
- Request Logger → logs request path + response status

Startup:
- Loads environment variables
- Calls init_db()

-------------------------------------
CORE FUNCTIONS
-------------------------------------

create_job():
- Generates unique job_id
- Initializes async queue
- Starts pipeline in background

stream_events():
- Async generator
- Streams SSE events from job queue

-------------------------------------
CORE ROUTES
-------------------------------------

POST /api/jobs
- Input: { github_url, branch }
- Output: { job_id }
- Action: Starts full pipeline

POST /api/deploy-only
- Input: { github_url, branch }
- Action: Runs deployment-only pipeline

GET /api/jobs/{job_id}/stream
- Output: text/event-stream
- Action: Streams pipeline updates

GET /api/jobs/{job_id}/report
- Output: Final report JSON

GET /api/deployment/{job_id}/status
- Output: Deployment status

----------------------------------------------------
3. PIPELINE ORCHESTRATION
----------------------------------------------------

File: pipeline/orchestrator.py

Purpose:
- Central state machine controlling full workflow

Main Function:
run_pipeline(job_id, repo, queue)

Pipeline Stages:
1. Analyze Repo
2. Plan Deployment
3. Deploy (Vercel)
4. Run Mutation Testing
5. Rank Mutants
6. Generate Tests
7. Verify Tests (LLM)
8. Fix Issues
9. Score System

Key Behavior:
- Emits events at each stage via queue
- Drives real-time frontend updates

Dependencies:
- Uses agents + services extensively

----------------------------------------------------
4. DATA MODELS
----------------------------------------------------

File: models/schemas.py

Purpose:
- Defines Pydantic schemas
- Ensures type safety for API I/O

Examples:
- RepoInput
- JobStatus
- PRAnalyzeRequest
- AssignTaskRequest

-------------------------------------

File: models/database.py

Purpose:
- Placeholder DB layer
- Currently mock (no persistence)

----------------------------------------------------
5. AGENTS (CORE INTELLIGENCE LAYER)
----------------------------------------------------

-------------------------------------
repo_analyzer.py
-------------------------------------
- Clones GitHub repo
- Parses package.json
- Detects framework, tools, entry points

Function:
analyze_repo()

-------------------------------------
deploy_planner.py
-------------------------------------
- Generates build/start commands

Function:
plan_deployment()

-------------------------------------
execution_agent.py
-------------------------------------
- Executes deployment (via Docker/Vercel)

Function:
execute_deployment()

-------------------------------------
test_generator.py
-------------------------------------
- Runs Jest test suite

Function:
generate_tests()

Returns:
- tests_run
- passed
- failed
- failures[]

-------------------------------------
verifier.py
-------------------------------------
- LLM-based test analysis

Behavior:
- If tests pass → suggest edge cases
- If fail → suggest fixes

LLM:
- gemma3:1b (Ollama)

Function:
verify_tests()

-------------------------------------
fixer.py
-------------------------------------
- Debugs deployment/test failures

Strategy:
1. Try RAG-based fixes
2. Fallback to LLM

Returns:
- Top fix suggestions

----------------------------------------------------
6. SERVICES (INFRASTRUCTURE LAYER)
----------------------------------------------------

-------------------------------------
ollama_client.py
-------------------------------------
- Wrapper for LLM calls

Models:
- qwen3:0.6b → code tasks
- gemma3:1b → reasoning

Functions:
- call_ollama()
- generate_test()
- fix_logs()

-------------------------------------
node_bridge.py
-------------------------------------
- Connects backend → node-service

Purpose:
- Run JS tooling (Stryker, Jest)

Functions:
- run_mutation()
- run_tests()
- run_single_test()

-------------------------------------
docker_runner.py
-------------------------------------
- Handles sandbox execution
- Delegates to Vercel deployer

-------------------------------------
vercel_deployer.py
-------------------------------------
- Automates Vercel deployment

Steps:
1. Generate vercel.json
2. Install CLI if needed
3. Execute deploy
4. Extract deployment URL

-------------------------------------
scoring.py
-------------------------------------
- Calculates metrics

Functions:
- mutation score = killed / total
- final score (weighted)

-------------------------------------
risk_classifier.py
-------------------------------------
- Assigns risk scores to mutants

Current State:
- Mock logic (placeholder for LightGBM)

-------------------------------------
cache.py
-------------------------------------
- Prevents recomputation

Functions:
- repo_fingerprint()
- get_cache()
- set_cache()

-------------------------------------
rag.py
-------------------------------------
- Stores known fixes

Purpose:
- Reduce LLM calls

----------------------------------------------------
7. FEATURE ROUTERS
----------------------------------------------------

-------------------------------------
DEPENDENCIES (routers/dependencies.py)
-------------------------------------

POST /api/deps/analyze
- Starts dependency analysis

GET /api/deps/status/{job_id}
- Returns results

-------------------------------------
ENV SHERIFF (routers/env_sheriff.py)
-------------------------------------

POST /api/sheriff/analyze
- Scans for secrets

GET /api/sheriff/status/{job_id}
- Returns findings + .env.example

-------------------------------------
PR RISK (routers/pr_risk.py)
-------------------------------------

POST /api/pr/repo/prs
- Fetch PRs from GitHub

POST /api/pr/analyze
- Analyze PR risk (LLM)

POST /api/pr/merge
- Merge PR via GitHub API

-------------------------------------
TASK ASSIGNER (routers/assign.py)
-------------------------------------

POST /api/assign/fetch-contributors
- Fetch contributors
- Extract languages

POST /api/assign/assign-task
- LLM selects best contributor

-------------------------------------
TRANSLATOR (routers/translate.py)
-------------------------------------

POST /api/translate
- Converts natural language → commands

----------------------------------------------------
8. DATA FLOW (IMPORTANT)
----------------------------------------------------

STEP 1:
Client sends request → /api/jobs

STEP 2:
Backend:
- Generates job_id
- Returns immediately

STEP 3:
Background task starts:
- run_pipeline()

STEP 4:
Pipeline emits events:
- logs
- stage updates
- results

STEP 5:
Frontend:
- connects via SSE
- receives events in real-time

STEP 6:
Final report stored + returned

----------------------------------------------------
9. ASYNC EXECUTION MODEL
----------------------------------------------------

Key Mechanism:
asyncio.create_task()

Why:
- Avoid blocking HTTP requests
- Enable long-running pipelines

Pattern:
- Fire-and-forget background jobs
- Client tracks via job_id

SSE Streaming:
- Uses asyncio.Queue
- Events pushed → consumed live

----------------------------------------------------
10. KEY TAKEAWAYS
----------------------------------------------------

- Fully async backend architecture
- Event-driven pipeline execution
- SSE-based real-time communication
- Modular agent + service design
- LLM tightly integrated into workflows
- Node.js bridge for JS ecosystem tooling

----------------------------------------------------

End of Document