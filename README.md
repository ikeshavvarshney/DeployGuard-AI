# 🚀 DeployGuard AI

> Local-first, AI-powered DevOps platform built with sub-billion parameter models.

---

## 🧠 Overview

DeployGuard AI is a developer operations platform designed to automate high-friction engineering workflows — deployments, PR reviews, dependency audits, and more — using **small, efficient LLMs** instead of massive cloud-based models.

Built under strict constraints (few billion parameters max), DeployGuard proves that **architecture > brute force**.

---

## ⚡ Key Highlights

- 🧩 Runs on **sub-billion parameter models**
- 🔒 Fully **local-first** (no forced cloud APIs)
- ⚡ **Low latency** with parallel inference
- 🧠 Intelligent pipeline with validation + caching
- 📊 Transparent outputs (raw + parsed + token usage)

---

## 🏗️ Architecture

Every request goes through a **6-stage pipeline**:

1. **Prompt Restructuring** – Normalize + enrich user input  
2. **RAG (Retrieval Augmented Generation)** – Inject relevant context  
3. **Parallel Inference** – Multiple LLM calls simultaneously  
4. **Validation Layer** – Ensure correctness + format  
5. **Caching** – Avoid redundant token usage  
6. **Ensemble Merging** – Combine outputs into high-confidence result  

---

## 🤖 Models Used

| Task | Model | Size |
|------|------|------|
| Reasoning | Qwen3 | ~0.6B |
| Code Generation | Gemma3 | ~1B |

---

## 🔥 Core Features

### 🚀 AutoDeploy
- Paste GitHub repo → automatic deployment
- Detects framework + generates config
- Debugs failures with actionable fixes

---

### 🔍 PR Review Agent
- Analyzes pull requests with:
  - Diff breakdown
  - Merge readiness scoring
  - Risk detection (bugs, breaking changes)

---

### 💻 Command Translation
- Natural language → CLI commands
- Supports Git, Docker, SQL, etc.
- Fast + deterministic (no hallucination)

---

### 📦 Dependency Audit
- Scans full dependency graph
- Classifies risk levels:
  - Critical
  - High
  - Medium
  - Low

---

### 🧑‍🤝‍🧑 AI Task Assignment
- Matches tasks → best contributors
- Uses contribution history + skill inference
- Generates ready-to-send email draft

---

### 🔐 Env Sheriff
- Detects leaked secrets in repos
- Filters false positives using LLM classification
- Generates `.env.example` automatically

---

## 🖥️ Frontend

Built with:
- **Next.js (App Router)**
- **TypeScript**
- **TailwindCSS**

### Key Capabilities:
- Real-time pipeline monitoring (SSE)
- Interactive dashboards
- AI observability panels
- Mutation testing visualization

📄 Detailed frontend architecture: :contentReference[oaicite:0]{index=0}

---

## 🔌 Backend (Conceptual)

- FastAPI-based orchestration
- Event-driven pipeline execution
- Streaming via SSE
- Modular agent system

---

## 🔄 Data Flow

1. User submits repo
2. Backend creates job
3. Frontend connects via SSE
4. Live updates streamed:
   - Logs
   - Stages
   - AI outputs
5. Reducer updates UI in real-time

---

## 📂 Project Structure

```
frontend/
app/
components/
lib/
public/

backend/
api/
pipeline/
models/
```


---

## 🧪 Example Use Cases

- 🚀 One-click deployment for junior devs  
- 🔍 Automated PR triaging for large teams  
- 🔐 Security auditing for open-source repos  
- 📊 Dev productivity optimization  

---

## 🎯 Why This Matters

Most AI tools rely on massive models and cloud APIs.

DeployGuard AI proves:
> You don’t need trillion-parameter models to build powerful developer tools.

You need:
- Smart architecture
- Efficient pipelines
- Focused problem-solving

---

## 🏁 Demo Script

Full 5-minute walkthrough script:  
📄 :contentReference[oaicite:1]{index=1}

---

## 🚧 Roadmap

- Multi-cloud deployment support
- Advanced CI/CD integrations
- Team collaboration features
- Plugin ecosystem

---

## 🛠️ Setup (Basic)

```bash
# frontend
cd frontend
npm install
npm run dev

# backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

```

---

## 🤝 Contributing

Contributions are welcome — but keep the bar high.

- Adhere to the existing architecture and design patterns  
- Maintain modular, scalable code  
- Avoid unnecessary complexity or over-engineering  

Low-quality or inconsistent contributions will not be merged.

---

## 📜 License

This project is licensed under the MIT License.

---

## 💡 Final Thought

DeployGuard AI isn’t about scaling model size for the sake of it.

It’s about engineering systems that extract maximum capability from minimal resources — efficiently, reliably, and intelligently.