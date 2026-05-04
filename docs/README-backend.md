# Backend Overview

The `backend` folder contains the Python/FastAPI server that acts as the brain of DeployGuard AI. It is responsible for orchestrating the entire autonomous deployment and testing pipeline, managing interactions with local LLMs (via Ollama), classifying code risk, and serving APIs to the frontend dashboard. 

---

## Core Application & Models

### `main.py`
- **What it is**: The FastAPI application entry point.
- **Purpose**: Initializes the server, defines API routes, handles CORS, and manages background job scheduling for the pipeline.
- **Main functions**:
  - `create_job()`: Initializes a new Job ID and queues the pipeline execution non-blocking via `asyncio.create_task`.
  - `stream_events()`: Async generator that streams Server-Sent Events (SSE) from the `job_id` queue to the frontend.
- **API routes**:
  - `POST /api/jobs` | Expects: `{ github_url, branch }` | Returns: `{ job_id }` | Calls: `orchestrator.run_pipeline`
  - `POST /api/deploy-only` | Expects: `{ github_url, branch }` | Returns: `{ job_id }` | Calls: `deploy_only.run_deploy_only_pipeline`
  - `GET /api/jobs/{job_id}/stream` | Expects: None | Returns: `text/event-stream` stream | Calls: Reads from internal `events` dict
  - `GET /api/jobs/{job_id}/report` | Expects: None | Returns: JSON report dict
  - `GET /api/deployment/{job_id}/status` | Expects: None | Returns: JSON deployment status

### `pipeline/orchestrator.py`
- **What it is**: The master state machine for the autonomous pipeline.
- **Purpose**: Sequentially executes the pipeline stages (Analyze -> Deploy -> Mutate -> Rank -> Generate -> Verify -> Fix -> Score), emitting SSE updates to the frontend at every step.
- **Main functions**:
  - `run_pipeline(job_id, repo, queue)`: A massive async function orchestrating the workflow. It clones the repo, deploys to Vercel, triggers mutation tests, asks LLMs to generate tests, verifies tests, scores the results, and saves the report.
- **Dependencies**: Depends on almost every agent and service file.

### `models/schemas.py`
- **What it is**: Pydantic models for data validation.
- **Purpose**: Ensures strong typing for API inputs/outputs and internal data structures like Job Status, PR Risk, and Dependency Analysis.
- **Main functions**: N/A (pure classes).

### `models/database.py`
- **What it is**: Database mock layer.
- **Purpose**: A placeholder for future persistent DB logic. Currently just prints a mock init message.

---

## Agents

### `agents/repo_analyzer.py`
- **What it is**: Source code static analysis tool.
- **Purpose**: Clones the GitHub repo to a temp folder and parses `package.json` to detect the framework, testing tools, package manager, and entry points.
- **Main functions**:
  - `analyze_repo(github_url, branch)` | Returns: `RepoAnalysis` object | Automatically detects Next.js vs Express vs Node.js.

### `agents/deploy_planner.py`
- **What it is**: Deployment strategy generator.
- **Purpose**: Determines the specific npm/yarn build and start commands based on the repo analysis.
- **Main functions**:
  - `plan_deployment(analysis)` | Returns: Dict with commands like `npm run build`.

### `agents/execution_agent.py`
- **What it is**: A lightweight wrapper for Docker/Vercel execution.
- **Purpose**: Triggers the sandbox execution step in the pipeline.
- **Main functions**:
  - `execute_deployment(plan, github_url, queue)` | Returns: Dict with success status and logs.

### `agents/test_generator.py`
- **What it is**: Runs the existing Jest test suite.
- **Purpose**: Bridges the Python pipeline to the Node.js test runner to execute the repo's existing tests and capture the pass/fail results.
- **Main functions**:
  - `generate_tests(mutants, repo_path, queue)` | Returns: A single-element list containing the Jest execution record (tests_run, passed, failed, failures array).

### `agents/verifier.py`
- **What it is**: LLM Test Quality Analyzer.
- **Purpose**: Feeds the Jest test results to Gemma 1B. If tests pass, it asks for missing edge cases. If they fail, it asks for debugging help and fix suggestions.
- **LLM usage**: Calls Ollama (`gemma3:1b`).
- **Main functions**:
  - `verify_tests(tests, repo_path, queue)` | Returns: Augmented test record including `ai_analysis` text and `health_score`.
  - `_analyse_single()`: Builds prompt based on pass/fail and calls `call_ollama`.

### `agents/fixer.py`
- **What it is**: Autonomous error resolution agent.
- **Purpose**: Scans deployment/build logs to find errors. It first tries deterministic RAG lookup for known errors, and escalates to Gemma 1B if no rules match.
- **LLM usage**: Calls Ollama (`gemma3:1b`) asking to list top 3 fixes as a JSON array.
- **Main functions**:
  - `fix_issues(logs, analysis, queue)` | Returns: List of string fix suggestions.

---

## Services

### `services/ollama_client.py`
- **What it is**: HTTP client for local Ollama instances.
- **Purpose**: Centralized wrapper for calling local LLMs (`qwen3:0.6b` for code, `gemma3:1b` for reasoning) using `aiohttp`.
- **Main functions**:
  - `call_ollama(model, prompt, temperature, max_tokens)` | Returns: Raw LLM response string. Handles `<think>` tag stripping.
  - `get_completion()`, `generate_test()`, `verify_syntax()`, `fix_logs()`.

### `services/node_bridge.py`
- **What it is**: HTTP client for the internal Node.js sandbox service.
- **Purpose**: Communicates with the `node-service` (Port 3001) to execute JavaScript-specific tasks like Stryker mutations and Jest tests.
- **Main functions**:
  - `run_mutation(repo_path, extra_tests)` | Returns: Stryker mutant JSON.
  - `run_tests(repo_path)` | Returns: Full Jest execution results.
  - `run_single_test()` | Used to run an isolated test against a specific mutant.

### `services/docker_runner.py`
- **What it is**: Deployment sandbox coordinator.
- **Purpose**: Currently proxies deployment requests to the Vercel Deployer.
- **Main functions**:
  - `run_in_sandbox(plan, repo_path, queue)` | Returns: Result dict of the Vercel deployment.

### `services/vercel_deployer.py`
- **What it is**: Automated Vercel CLI deployer.
- **Purpose**: Generates a `vercel.json` config based on the framework and streams a local `vercel deploy` command output back to the frontend.
- **Main functions**:
  - `deploy_to_vercel(repo_path, framework, repo_name, queue)` | Generates config, installs Vercel CLI if needed, executes deploy, parses the output for the `.vercel.app` URL.

### `services/scoring.py`
- **What it is**: Analytics and Math utility.
- **Purpose**: Calculates mutation scores and the final aggregate reliability grade.
- **Main functions**:
  - `calculate_score(mutants)` | Returns float `killed / total`.
  - `calculate_final_score()` | Returns dict with weighted reliability score.

### `services/risk_classifier.py`
- **What it is**: Code risk prioritization engine.
- **Purpose**: A placeholder for a LightGBM ranker. Assigns mock risk scores (0.0 to 1.0) based on mutation type (e.g., equality mutations = 0.9 risk).
- **Main functions**:
  - `rank_mutants(mutants, repo_path)` | Returns: Sorted list of the top 10 most dangerous surviving mutants.

### `services/cache.py`
- **What it is**: Mock caching layer.
- **Purpose**: Prevents re-running expensive Stryker mutations if the repo hasn't changed.
- **Main functions**:
  - `repo_fingerprint()` | Returns SHA256 of URL and commit.
  - `get_cache()`, `set_cache()` | Uses in-memory python dict for now.

### `services/rag.py`
- **What it is**: Retrieval-Augmented Generation mock service.
- **Purpose**: Stores common deployment failure patterns and their verified fixes to save LLM calls.
- **Main functions**:
  - `get_known_fixes(keywords)` | Returns: Top fixes sorted by historical success rate.
