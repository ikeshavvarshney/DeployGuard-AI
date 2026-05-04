====================================================
DEPLOYGUARD AI - NODE SERVICE DOCUMENTATION
====================================================

This document provides a complete technical breakdown of the Node.js microservice
used within DeployGuard AI.

The node-service is a lightweight Express-based execution layer responsible for
running JavaScript-native tooling (Jest, Mutation Testing) in isolation.

----------------------------------------------------
1. PURPOSE & ROLE IN SYSTEM
----------------------------------------------------

The node-service exists because:

→ Python backend cannot reliably execute JS tooling like Jest/Stryker directly
→ JS tooling requires Node runtime + filesystem control
→ Isolation is required for safety and performance

Core Responsibilities:
- Execute Jest test suites
- Perform mutation testing (custom engine)
- Run dynamically generated AI tests
- Return structured results to backend

Communication Model:
- Backend → Node-service (HTTP)
- Node-service → Backend (JSON response)
- Frontend NEVER talks to this service directly

Runs on:
- Port: 3001
- Typically inside Docker/sandbox

----------------------------------------------------
2. ARCHITECTURE OVERVIEW
----------------------------------------------------

Design Pattern:
→ Thin execution microservice

It does NOT:
- Contain business logic
- Perform AI reasoning
- Manage pipelines

It ONLY:
- Executes tasks
- Parses results
- Returns structured output

----------------------------------------------------
3. ENTRY POINT (index.js)
----------------------------------------------------

File: node-service/index.js

Responsibilities:
- Initialize Express server
- Configure middleware
- Define API endpoints
- Coordinate execution logic

Middleware:
- JSON parser (limit: 10mb)

-------------------------------------
KEY FUNCTIONS
-------------------------------------

writeExtraTests():
- Creates temporary test files
- Location: __deployguard_tests__/
- Used when backend sends AI-generated tests

-------------------------------------
API ROUTES
-------------------------------------

POST /run-mutation
Input:
{
  repoPath,
  extraTests[]
}

Flow:
1. Write extra tests (if any)
2. Run mutation engine
3. Return mutation results

-------------------------------------

POST /run-tests
Input:
{
  repoPath
}

Flow:
1. Execute Jest suite
2. Parse results
3. Return structured output

-------------------------------------

POST /run-single-test
Input:
{
  testCode,
  mutantId,
  repoPath
}

Flow:
1. Create temp test file
2. Fix imports
3. Run Jest (single test)
4. Cleanup file
5. Return result

-------------------------------------

GET /health
- Returns { status: "ok" }

Purpose:
- Backend health check before execution

----------------------------------------------------
4. CORE MODULES (UTILS)
----------------------------------------------------

-------------------------------------
utils/stryker.js
-------------------------------------

Purpose:
- Custom mutation testing engine

Important:
→ NOT using official stryker-mutator
→ Lightweight, AST-less approach

-------------------------------------
KEY FUNCTIONS
-------------------------------------

findSourceFiles(rootDir)
- Recursively scans repo
- Excludes:
  - node_modules
  - test files

-------------------------------------

processFile(fileContent)
- Injects mutations:
  - === → !==
  - > → <
  - arithmetic flips
- Works via string manipulation (no AST)

-------------------------------------

runMutation(repoPath, extraTests)
- Main orchestrator

Steps:
1. Load source files
2. Inject mutations
3. Run tests against mutants
4. Track killed vs survived

Features:
- Concurrency batching
- Timeout protection (3 min hard cap)

-------------------------------------

normaliseStatus()
- Standardizes result:
  - killed
  - survived

----------------------------------------------------
5. JEST EXECUTION LAYER
----------------------------------------------------

File: utils/jest-runner.js

Purpose:
- Execute and parse Jest test results

-------------------------------------
KEY FUNCTIONS
-------------------------------------

runTests(repoPath)

Command:
npx jest --forceExit --json --testTimeout=15000

Flow:
1. Run Jest CLI
2. Try parsing JSON output
3. If failed → fallback to regex parsing
4. Return:
   - total tests
   - passed
   - failed
   - failure logs[]

-------------------------------------

runSingleTest(testCode, mutantId, repoPath)

Flow:
1. Create temp .test.js file
2. Fix imports dynamically
3. Run Jest on ONLY that file
4. Delete file
5. Return result

-------------------------------------

fixImportPaths()

Purpose:
- Adjust relative imports in AI-generated tests

Problem:
- Tests live in __deployguard_tests__/
- Source files are elsewhere

Solution:
- Rewrite import paths dynamically

----------------------------------------------------
6. OPTIONAL ROUTE FILES
----------------------------------------------------

Files:
- routes/mutation.js
- routes/tests.js

Reality:
- Mostly unused or redundant
- Actual logic handled in index.js

----------------------------------------------------
7. API CONTRACT (IMPORTANT)
----------------------------------------------------

All endpoints follow:

Input:
- repoPath (absolute path)
- optional test payload

Output:
- Structured JSON

Examples:

Mutation Response:
{
  total: number,
  killed: number,
  survived: number,
  mutants: []
}

Test Response:
{
  total: number,
  passed: number,
  failed: number,
  failures: []
}

----------------------------------------------------
8. INTERNAL EXECUTION FLOW
----------------------------------------------------

STEP 1:
Backend sends request with repoPath

STEP 2:
Node-service prepares environment:
- Writes temp test files (if needed)

STEP 3:
Executes tool:
- Mutation engine OR Jest

STEP 4:
Collects raw output

STEP 5:
Parses output → JSON

STEP 6:
Returns result to backend

----------------------------------------------------
9. DESIGN DECISIONS (IMPORTANT)
----------------------------------------------------

Why separate service?

1. Language isolation
   - JS tooling runs in Node environment

2. Stability
   - Prevent Python backend crashes

3. Security
   - Sandboxed execution

4. Performance
   - Avoid cross-runtime overhead

5. Simplicity
   - Backend stays orchestration-only

----------------------------------------------------
10. LIMITATIONS
----------------------------------------------------

- Mutation engine is simplified (string-based, not AST)
- No persistent storage
- No caching layer
- Routes not modularized (index.js heavy)
- Error handling depends on CLI output quality

----------------------------------------------------
11. KEY TAKEAWAYS
----------------------------------------------------

- Acts as execution sandbox for JS tooling
- Critical bridge between Python backend and JS ecosystem
- Stateless, fast, and isolated
- Handles mutation testing + test execution reliably
- Designed for pipeline integration, not standalone usage

----------------------------------------------------

End of Document