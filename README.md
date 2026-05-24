# DeployGuard AI

> Local-first, AI-powered DevOps automation platform — built on sub-billion parameter models.

DeployGuard AI automates the highest-friction parts of engineering workflows: deployments, PR reviews, dependency audits, secret detection, and task assignment — using small, efficient LLMs instead of heavyweight cloud APIs.

The core thesis: **architecture beats brute force**. Every feature runs a structured multi-stage pipeline that constrains and validates model output, rather than blindly trusting a raw LLM response.

---

## What It Does

| Feature | Description |
|---|---|
| **AutoDeploy** | Paste a GitHub repo URL → framework detection → config generation → Vercel deployment → failure debugging |
| **PR Review Agent** | Fetches PRs, scores merge readiness, flags bugs and breaking changes |
| **Command Translator** | Natural language → Git / Docker / SQL CLI commands |
| **Dependency Audit** | Full dependency graph scan with Critical / High / Medium / Low risk classification |
| **Env Sheriff** | Detects leaked secrets in repos, filters false positives via LLM, generates `.env.example` |
| **AI Task Assignment** | Matches tasks to best contributors using GitHub history + skill inference, drafts assignment email |

---

## Architecture

Every request flows through a **6-stage pipeline**:

```
User Input
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  1. Prompt Restructuring  — normalize + enrich input     │
│  2. RAG Retrieval         — inject relevant context      │
│  3. Parallel Inference    — multiple LLM calls           │
│  4. Validation Layer      — correctness + format checks  │
│  5. Caching               — skip redundant token usage   │
│  6. Ensemble Merging      — combine into final output    │
└──────────────────────────────────────────────────────────┘
    │
    ▼
Structured JSON response streamed to frontend via SSE
```

### Models

| Task | Model | Size |
|---|---|---|
| Reasoning / analysis | Qwen3 | ~0.6B |
| Code generation | Gemma3 | ~1B |

Both run locally via **Ollama** — no cloud API required.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript, TailwindCSS |
| Backend | Python, FastAPI, asyncio |
| Node Service | Express.js (Jest execution + custom mutation engine) |
| LLM Runtime | Ollama |
| Deployment target | Vercel (automated via backend) |

---

## Services & Ports

| Service | Port | Description |
|---|---|---|
| Frontend (Next.js) | `http://localhost:3000` | Main dashboard UI |
| Backend (FastAPI) | `http://localhost:8000` | API + pipeline orchestration |
| Node Service (Express) | `http://localhost:3001` | Jest runner + mutation testing engine |
| Ollama | `http://localhost:11434` | Local LLM inference |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10–3.12
- [Ollama](https://ollama.ai) installed and running

### 1. Pull LLM models

```bash
ollama pull qwen3:0.6b
ollama pull gemma3:1b
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Runs on http://localhost:8000
```

### 4. Node Service

```bash
cd node-service
npm install
node index.js
# Runs on http://localhost:3001
```

---

## Environment Variables

### `backend/.env`

```env
# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL_REASONING=qwen3:0.6b
OLLAMA_MODEL_CODE=gemma3:1b

# GitHub (required for PR Review and Task Assignment)
GITHUB_TOKEN=your_github_personal_access_token

# Vercel (required for AutoDeploy)
VERCEL_TOKEN=your_vercel_token

# Node Service
NODE_SERVICE_URL=http://localhost:3001

# Optional
LOG_LEVEL=INFO
```

### `frontend/.env.local`

```env
# Backend API base URL (proxied through Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Project Structure

```
deployguard-ai/
├── frontend/
│   ├── app/                  # Next.js App Router pages
│   │   ├── page.tsx          # Landing page
│   │   ├── scan/             # Pipeline entry point
│   │   ├── dashboard/[jobId] # Real-time monitoring
│   │   ├── dependencies/     # Dependency audit
│   │   ├── envsheriff/       # Secret detection
│   │   ├── assign/           # Task assignment
│   │   ├── translate/        # Command translation
│   │   ├── prscorer/         # PR risk analysis
│   │   └── api/proxy/        # API proxy (avoids CORS)
│   ├── components/           # UI components
│   └── lib/                  # API wrappers + utilities
│
├── backend/
│   ├── main.py               # FastAPI entry point, routes, job lifecycle
│   ├── pipeline/
│   │   └── orchestrator.py   # 9-stage pipeline state machine
│   ├── agents/               # repo_analyzer, deploy_planner, verifier, fixer, etc.
│   ├── services/             # ollama_client, vercel_deployer, rag, cache, scoring
│   ├── routers/              # dependencies, env_sheriff, pr_risk, assign, translate
│   └── models/               # Pydantic schemas, DB layer
│
└── node-service/
    ├── index.js              # Express entry point + API routes
    └── utils/
        ├── stryker.js        # Custom mutation testing engine (string-based)
        └── jest-runner.js    # Jest execution + result parsing
```

---

## Backend API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jobs` | Start full pipeline — returns `job_id` |
| `POST` | `/api/deploy-only` | Deployment-only pipeline |
| `GET` | `/api/jobs/{job_id}/stream` | SSE stream of live pipeline events |
| `GET` | `/api/jobs/{job_id}/report` | Final report JSON |
| `GET` | `/api/deployment/{job_id}/status` | Deployment status |
| `POST` | `/api/deps/analyze` | Start dependency audit |
| `GET` | `/api/deps/status/{job_id}` | Dependency audit results |
| `POST` | `/api/sheriff/analyze` | Scan repo for secrets |
| `GET` | `/api/sheriff/status/{job_id}` | Sheriff findings + `.env.example` |
| `POST` | `/api/pr/repo/prs` | Fetch PRs from GitHub |
| `POST` | `/api/pr/analyze` | LLM-based PR risk analysis |
| `POST` | `/api/pr/merge` | Merge PR via GitHub API |
| `POST` | `/api/assign/fetch-contributors` | Fetch contributors + language data |
| `POST` | `/api/assign/assign-task` | AI task assignment |
| `POST` | `/api/translate` | Natural language → CLI command |

---

## Node Service API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/run-mutation` | Run mutation testing on repo |
| `POST` | `/run-tests` | Execute full Jest test suite |
| `POST` | `/run-single-test` | Run one AI-generated test against a mutant |
| `GET` | `/health` | Health check |

The Node service is an internal execution sandbox. The frontend never talks to it directly — only the Python backend does.

---

## Real-Time Pipeline (SSE)

Once a job is created, the frontend connects to the SSE stream and receives live events:

```
POST /api/jobs → { job_id }
                      │
                      ▼
GET /api/jobs/{job_id}/stream (text/event-stream)
    ├── ADD_LOG
    ├── SET_STAGE
    ├── SET_PROGRESS
    ├── ADD_AGENT_EVENT
    └── COMPLETE
```

The dashboard uses `useReducer` to handle all incoming events and update UI state without full re-renders.

---

## Mutation Testing

DeployGuard includes a custom lightweight mutation testing engine (`utils/stryker.js`) — not a wrapper around official Stryker.

It works by:
1. Scanning source files recursively (excluding `node_modules` and test files)
2. Injecting mutations via string manipulation (`===` → `!==`, `>` → `<`, arithmetic flips)
3. Running the test suite against each mutant in batched concurrent runs
4. Reporting killed vs. survived mutants with a final mutation score

Final reliability score formula used in the dashboard:

```
Score = (0.5 × mutation_score) + (0.3 × test_effectiveness) + (0.2 × deployment_success)
```

---

## Limitations

- Mutation engine uses string substitution, not AST — complex mutations are not supported
- No persistent storage in the current backend DB layer (mock)
- Node service has no caching — every mutation run re-executes from scratch
- Vercel deployment requires a valid `VERCEL_TOKEN` with appropriate project permissions

---

## Contributing

Contributions are welcome, but the bar is high.

- Follow the existing architecture and pipeline patterns
- Keep code modular — agents handle intelligence, services handle infrastructure
- Do not add unnecessary dependencies or over-engineer solutions
- Low-quality or inconsistent PRs will not be merged

---

## License

MIT License