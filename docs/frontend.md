====================================================
DEPLOYGUARD AI - FRONTEND DOCUMENTATION
====================================================

This document provides a complete technical breakdown of the frontend architecture,
pages, components, and data flow of the DeployGuard AI system.

The frontend is built using Next.js (App Router) and serves as the primary UI
for interacting with the AI-driven deployment pipeline, observability tools,
and developer productivity features.

----------------------------------------------------
1. ARCHITECTURE OVERVIEW
----------------------------------------------------

The frontend is a modern, dark-themed dashboard-based application designed to:

- Monitor deployment pipelines in real-time
- Visualize mutation testing results
- Interact with AI tools (command translation, task assignment)
- Analyze repositories and contributors

----------------------------------------------------
2. FOLDER STRUCTURE
----------------------------------------------------

app/
  - Contains all routes (pages) using Next.js App Router
  - Also includes API proxy routes

components/
  - Reusable UI components and complex dashboard modules

lib/
  - Utility functions and API wrappers

public/
  - Static assets (icons, favicon, etc.)

----------------------------------------------------
3. PAGES & ROUTES
----------------------------------------------------

-------------------------------------
/ (Home Page)
-------------------------------------
File: app/page.tsx

Purpose:
- Landing page introducing DeployGuard AI

Features:
- Hero section with animations
- Core features overview
- 7-step pipeline visualization
- Navigation entry points

Data Flow:
- Static (no API calls)

-------------------------------------
/scan
-------------------------------------
File: app/scan/page.tsx

Purpose:
- Entry point to start pipeline execution

Features:
- GitHub repo URL input
- Branch selection

API:
- POST /api/proxy/jobs → initializes pipeline

Flow:
1. User submits repo + branch
2. Backend creates job
3. Redirect → /dashboard/[jobId]

-------------------------------------
/dashboard/[jobId]
-------------------------------------
File: app/dashboard/[jobId]/page.tsx

Purpose:
- Real-time pipeline monitoring dashboard

Core Features:
- Live progress tracking
- Logs streaming
- Mutation score visualization
- AI analysis
- Agent decision tracking

Layout:
- Left: Pipeline status + logs
- Center: analytics + inspectors
- Right: agent observability

State Management:
- useReducer (centralized event-driven state)

State includes:
- stages
- logs
- mutation scores
- tests
- mutants
- agent events
- progress
- final report

Main Logic:
- EventSource (SSE connection)
- reducer(state, action)
- updateVoteHistory()

API:
- GET /api/jobs/{jobId}/stream (SSE)

-------------------------------------
/dependencies
-------------------------------------
Purpose:
- Analyze dependency risks

Flow:
- Sends request → backend
- Polls job status

-------------------------------------
/envsheriff
-------------------------------------
Purpose:
- Detect secrets in repo
- Generate .env.example

-------------------------------------
/assign
-------------------------------------
File: app/assign/page.tsx

Purpose:
- Assign tasks to best contributor using AI

Features:
- Fetch GitHub contributors
- Edit skills + emails
- Task description input
- AI-based assignment result

API:
- POST /api/proxy/assign/fetch-contributors
- POST /api/proxy/assign/assign-task

State:
- contributors[]
- task
- result
- loading/error states

-------------------------------------
/translate
-------------------------------------
File: app/translate/page.tsx

Purpose:
- Select domain for command translation

-------------------------------------
/translate/[category]
-------------------------------------
File: app/translate/[category]/page.tsx

Purpose:
- Translate natural language → commands

Features:
- Dynamic examples
- History tracking
- Command output rendering

Main Functions:
- handleTranslate()
- handleKeyDown()
- handleChipClick()

API:
- POST /api/translate

State:
- query
- result
- history
- loading/error

-------------------------------------
/prscorer
-------------------------------------
Purpose:
- Analyze pull request risks

-------------------------------------
/autodeploy /deployment
-------------------------------------
Purpose:
- Deployment and health check interfaces

----------------------------------------------------
4. API PROXY LAYER
----------------------------------------------------

File: app/api/proxy/[...path]/route.ts

Purpose:
- Acts as middleware between frontend and backend

Functions:
- GET → forwards requests (supports SSE streaming)
- POST → forwards JSON body

Why it exists:
- Avoids CORS issues
- Hides backend URL

----------------------------------------------------
5. COMPONENTS
----------------------------------------------------

-------------------------------------
PipelineStatus
-------------------------------------
- Displays pipeline stages
- Visual states: pending / active / done

-------------------------------------
LogStream
-------------------------------------
- Terminal-like live logs
- Auto-scrolls on updates

-------------------------------------
MutationScore
-------------------------------------
- Animated donut charts
- Shows before vs after scores

Logic:
- Smooth animation using setInterval

-------------------------------------
MutantInspector
-------------------------------------
- Displays mutation testing results
- Shows:
  - file
  - line
  - original vs mutated code
  - status (killed/survived)

-------------------------------------
AIAnalysisPanel
-------------------------------------
- Displays LLM-generated insights
- Shows scores and feedback

-------------------------------------
AgentObservatory
-------------------------------------
- Visualizes AI agent decisions
- Tracks:
  - events
  - vote history
  - active agents

-------------------------------------
ReliabilityReport
-------------------------------------
- Final system score

Score Formula:
(0.5 * mutationScore)
+ (0.3 * testEffectiveness)
+ (0.2 * deploymentSuccess)

-------------------------------------
CommandOutput
-------------------------------------
- Displays translated commands
- Features:
  - copy to clipboard
  - collapsible explanation
  - variations

-------------------------------------
ContributorCard
-------------------------------------
- Editable contributor profile

Features:
- Add/remove skills
- Email validation
- Displays GitHub metadata

----------------------------------------------------
6. DATA FLOW SUMMARY
----------------------------------------------------

1. User initiates pipeline (/scan)
2. Backend creates job
3. Dashboard connects via SSE
4. Events streamed:
   - logs
   - stage updates
   - mutants
   - tests
   - AI analysis

5. Reducer updates state
6. UI re-renders in real-time

----------------------------------------------------
7. CORE LOGIC (IMPORTANT)
----------------------------------------------------

Reducer Pattern:
- Handles all real-time updates
- Ensures consistent state

Event Types:
- ADD_LOG
- SET_STAGE
- SET_PROGRESS
- ADD_AGENT_EVENT
- COMPLETE

Vote System:
- updateVoteHistory aggregates agent decisions
- Builds consensus per mutant/test

----------------------------------------------------
8. KEY TAKEAWAYS
----------------------------------------------------

- Event-driven architecture using SSE
- Centralized state via reducer
- Modular UI components
- Proxy-based API abstraction
- AI-integrated workflows across features

----------------------------------------------------

End of Document