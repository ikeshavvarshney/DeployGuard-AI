# Frontend Overview

The `frontend` folder contains the Next.js application responsible for the user interface of the DeployGuard AI system. It serves as the primary visual entry point, providing a modern, dark-themed dashboard to monitor live deployment pipelines, analyze mutation test results in real-time, translate natural language to terminal commands, and assign tasks to repository contributors using AI.

---

## Pages

### `app/page.tsx`
- **What it is**: The main landing page for DeployGuard AI.
- **Purpose**: Introduces the product, highlights core features (Mutation Testing, LLM Test Generation, Task Assigner, Command Translator), and routes the user to the main tools.
- **Features**:
  - Hero section with pulsing animations and clear call-to-actions.
  - "New Feature" teasers for Command Translator and Task Assigner.
  - "How It Works" 7-step pipeline visualizer.
  - "Core Features" grid outlining system capabilities like Stryker integration and LightGBM risk ranking.
- **Main functions**:
  - Only relies on standard Next.js `useRouter` for client-side navigation.
- **API calls**: None.
- **State managed**: None natively tracked, purely presentational and routing.

### `app/dashboard/[jobId]/page.tsx`
- **What it is**: The live pipeline dashboard tracking deployment jobs.
- **Purpose**: Connects via Server-Sent Events (SSE) to the backend to visualize the autonomous testing and deployment pipeline in real-time.
- **Features**:
  - Dynamic Progress Bar and Job Status Banner (Running/Complete/Failed).
  - 3-column layout: Pipeline execution status & Logs (Left), Analytics & Inspectors (Center), Agent Observatory (Right).
  - Integrates multiple components: `PipelineStatus`, `LogStream`, `MutationScore`, `ReliabilityReport`, `MutantInspector`, `AIAnalysisPanel`, and `AgentObservatory`.
- **Main functions**:
  - `reducer(state, action)`: Central state management handling incoming SSE events to update logs, scores, agent events, and stage transitions.
  - `updateVoteHistory`: Utility to process agent voting events into a consensus tracker.
  - `useEffect`: Manages the `EventSource` connection to the backend stream.
- **API calls**:
  - **GET** `http://localhost:8000/api/jobs/[jobId]/stream` (SSE): Receives continuous pipeline updates (logs, stage updates, scores, tests, ai_analysis).
- **State managed**: 
  - Tracks `stages`, `logs`, `mutationScoreBefore`, `mutationScoreAfter`, `tests`, `mutants`, `finalReport`, `progress`, `agentEvents`, `activeAgents`, `voteHistory`, and `aiAnalysis`.

### `app/translate/page.tsx`
- **What it is**: Landing page for the Command Translator tool.
- **Purpose**: Allows users to select a specific technical domain (Git, SQL, MongoDB, Shell, Docker, npm) to translate English commands into precise technical commands.
- **Features**:
  - Grid of 6 interactive category cards with icons and hints.
  - Hover effects highlighting the selected technology.
- **Main functions**: 
  - Utilizes Next.js `<Link>` for routing to specific category pages.
- **API calls**: None.
- **State managed**: None natively tracked.

### `app/translate/[category]/page.tsx`
- **What it is**: The active workspace for the Command Translator.
- **Purpose**: Takes natural language input and queries the backend AI to generate an executable command with an explanation.
- **Features**:
  - Dynamic examples based on the selected category (e.g., specific Git or Docker examples).
  - Interactive text area for natural language input.
  - Execution state indicators (Translating animation, Error banners).
  - Result output rendering via `CommandOutput`.
  - Session history sidebar to quickly recall past queries.
- **Main functions**:
  - `handleTranslate()`: Triggers the POST request to the API proxy.
  - `handleKeyDown()`: Supports `Cmd/Ctrl + Enter` shortcuts.
  - `handleChipClick()`: Allows quick execution of suggested variations.
- **API calls**:
  - **POST** `/api/translate`: Sends `{ query, category }`. Expects a JSON object with `{ command, explanation, category, variations }`.
- **State managed**: 
  - `query` (input string), `loading` (boolean), `error` (string | null), `result` (translation response), `history` (array of past queries).

### `app/assign/page.tsx`
- **What it is**: The Task Assigner workspace.
- **Purpose**: Fetches contributors for a specific GitHub repository, allows users to manually augment their profiles (emails, skills), and uses AI to assign a specified task to the most capable contributor.
- **Features**:
  - GitHub Repository input URL field.
  - Grid of `ContributorCard` components to view and edit team members.
  - Text area to describe the task/feature to be assigned.
  - Interactive assignment result card showing the chosen assignee, AI reasoning, confidence score, and ranking of other candidates.
  - Quick action buttons (e.g., Send Task via Email).
- **Main functions**:
  - `handleFetch()`: Retrieves contributors from the backend.
  - `handleContributorChange()`: Updates local state when a user edits a contributor's skills or email.
  - `handleAssign()`: Sends the task description and contributor profiles to the AI for assignment.
- **API calls**:
  - **POST** `/api/proxy/assign/fetch-contributors`: Sends `{ repo_url }`. Expects an array of contributor profiles.
  - **POST** `/api/proxy/assign/assign-task`: Sends `{ task, contributors }`. Expects `{ assignee, reason, confidence, rankings }`.
- **State managed**: 
  - `repoUrl`, `fetchLoading`, `fetchError`, `contributors` (array of objects), `showTask`, `task`, `assignLoading`, `assignError`, `result`.

### `app/api/proxy/[...path]/route.ts`
- **What it is**: Next.js API Proxy Route.
- **Purpose**: Acts as a middleware/bridge between the Next.js frontend (running on port 3000) and the FastAPI backend (running on port 8000), circumventing CORS issues and securely forwarding requests.
- **Main functions**:
  - `GET()`: Proxies GET requests. Critically, it checks if the backend responds with `text/event-stream` and properly forwards SSE connections without buffering.
  - `POST()`: Proxies POST requests by forwarding the JSON body and returning the JSON response.

---

## Components

### `components/PipelineStatus.tsx`
- **What it is**: A visual checklist of pipeline stages.
- **Purpose**: Shows the user exactly where the autonomous pipeline is in its lifecycle.
- **Features**: Vertical list of steps (Analyzing, Mutating, etc.) with dynamic icons (Spinner for active, Check for done, X for failed).
- **API calls**: None (receives state via props).
- **State managed**: None natively. Uses `stages` prop.

### `components/MutationScore.tsx`
- **What it is**: Animated radial progress charts for test quality.
- **Purpose**: Visually compares the mutation score (test effectiveness) "Before AI" and "After AI" improvements.
- **Features**: Two animated SVG donut charts showing percentage values that fill up dynamically when data arrives.
- **Main functions**:
  - `useEffect` hooks create a `setInterval` loop to smoothly animate the numbers from 0 to the target score over 30 frames.
- **API calls**: None.
- **State managed**: `animBefore` and `animAfter` track the current animated number.

### `components/TestList.tsx`
- *(Currently empty or deprecated in favor of AIAnalysisPanel / AgentObservatory)*

### `components/LogStream.tsx`
- **What it is**: A simulated terminal window.
- **Purpose**: Displays raw execution logs from the backend tools (Docker, Jest, Stryker) in real-time.
- **Features**: Auto-scrolling terminal UI with MacOS-style window controls and syntax coloring (red for errors).
- **Main functions**:
  - `useEffect`: Triggers `scrollIntoView` on a hidden bottom element whenever the `logs` array updates.
- **API calls**: None.
- **State managed**: None natively.

### `components/ReliabilityReport.tsx`
- **What it is**: The final pipeline grade summary card.
- **Purpose**: Displays the aggregated reliability score and confidence level once the deployment is complete.
- **Features**: 
  - Dynamic grade rendering (HIGH/MEDIUM/LOW).
  - Displays the final weighted score percentage.
  - Provides a clickable link to the live Vercel deployment URL.
- **Main functions**: 
  - Calculates the final score if it's not explicitly provided: `(0.5 * mutationScore) + (0.3 * testEffectiveness) + (0.2 * deploymentSuccess)`.
- **API calls**: None.
- **State managed**: None natively.

### `components/CommandOutput.tsx`
- **What it is**: The result renderer for the Command Translator.
- **Purpose**: Beautifully formats the translated terminal command and its AI-generated explanation.
- **Features**: 
  - "Copy to clipboard" functionality.
  - Collapsible explanation section.
  - Clickable variation chips to test alternative commands.
- **Main functions**:
  - `handleCopy()`: Writes the command string to the system clipboard using the `navigator.clipboard` API.
- **API calls**: None.
- **State managed**: `copied` (boolean for UI feedback), `showExplanation` (boolean to toggle the explanation div).

### `components/ContributorCard.tsx`
- **What it is**: An editable profile card for a GitHub contributor.
- **Purpose**: Allows users to manually add missing data (emails and specific technical skills) to a GitHub profile before passing it to the AI for task assignment.
- **Features**:
  - Displays GitHub avatar, name, handle, bio, and commit count.
  - Input field for email address (turns green when valid).
  - Interactive tagging system for adding/removing skills.
- **Main functions**:
  - `addSkill()`: Appends a skill to the array and calls the parent's `onChange`.
  - `removeSkill()`: Filters out a skill and calls `onChange`.
  - `handleSkillKeyDown()`: Supports adding skills via `Enter` or `,` and deleting via `Backspace`.
- **API calls**: None.
- **State managed**: `skillInput` tracks the current text in the add-skill input field.
