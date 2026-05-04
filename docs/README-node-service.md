# Node Service Overview

The `node-service` folder contains a lightweight Express.js microservice. It is designed to run in a Dockerized or isolated environment alongside the source code repositories being analyzed. 

This service bridges the Python backend and the JavaScript ecosystem, enabling the pipeline to execute Node-native tooling (like Jest and Stryker) safely without requiring the Python backend to manage JavaScript child processes directly.

---

## Files

### `index.js`
- **What it is**: The main Express application and entry point.
- **Purpose**: Exposes HTTP POST endpoints that the Python backend calls to trigger testing and mutation runs.
- **Main functions**:
  - `writeExtraTests()`: A utility that dynamically creates test files on disk in a temporary `__deployguard_tests__` directory if the Python pipeline sends dynamically generated tests.
- **API Routes**:
  - `POST /run-mutation` | Expects: `{ repoPath, extraTests }` | Calls: `runMutation`
  - `POST /run-tests` | Expects: `{ repoPath }` | Calls: `runTests`
  - `POST /run-single-test` | Expects: `{ testCode, mutantId, repoPath }` | Calls: `runSingleTest`
  - `GET /health` | Health check endpoint.

### `utils/stryker.js`
- **What it is**: The custom, lightweight Mutation Testing engine.
- **Purpose**: Instead of installing the heavy `stryker-mutator` package, this module implements a custom, highly-performant AST-less mutation testing engine. It intentionally injects specific bugs (mutants) into the source code to see if the existing test suite catches them.
- **Main functions**:
  - `findSourceFiles(rootDir)`: Recursively scans the repository to find source files (excluding tests, `node_modules`, etc.).
  - `processFile()`: Injects logical, arithmetic, and equality bugs directly into the string content of source files. For example, changing `===` to `!==`.
  - `runMutation(repoPath, extraTests)`: The primary orchestrator for the mutation run. Features concurrency limiting (batching) and strict execution timeout protection (3-minute hard limit) to prevent runaway sandbox tasks.
  - `normaliseStatus()`: Translates standard Stryker statuses into a unified `killed` or `survived` format.

### `utils/jest-runner.js`
- **What it is**: The Jest test execution wrapper.
- **Purpose**: Invokes the Jest CLI against the repository to run its test suite, parse the results into a machine-readable JSON format, and return it to the backend.
- **Main functions**:
  - `runTests(repoPath)`: Executes `npx jest --forceExit --json --testTimeout=15000`. It attempts to parse the clean JSON output first. If the process crashes or outputs malformed JSON, it falls back to a custom Regex parser that reads human-readable terminal output. Returns total tests, passed tests, failed tests, and a parsed array of failure logs.
  - `runSingleTest(testCode, mutantId, repoPath)`: Creates a temporary `.test.js` file for an AI-generated test, fixes import paths dynamically using `fixImportPaths`, runs Jest exclusively on that single file, and cleans up the file afterward.
  - `fixImportPaths()`: Rewrites relative imports in AI-generated tests to correctly point to the original source files from within the temporary `__deployguard_tests__` directory.
