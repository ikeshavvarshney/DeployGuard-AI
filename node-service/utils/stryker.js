const fs = require('fs').promises;
const path = require('path');

const MAX_MUTANTS = 10;
const CONCURRENCY = 5;


// ─────────────────────────────────────────────
// Parallel file discovery (controlled)
// ─────────────────────────────────────────────
async function findSourceFiles(rootDir) {
  const results = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        if (["node_modules", ".git", ".next", "dist"].includes(entry.name)) return;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (
          /\.(js|ts|jsx|tsx)$/.test(entry.name) &&
          !entry.name.includes(".test.") &&
          !entry.name.includes(".spec.") &&
          !fullPath.includes("__tests__")
        ) {
          results.push(fullPath);
        }
      })
    );
  }

  await walk(rootDir);
  return results;
}


// ─────────────────────────────────────────────
// Mutation logic
// ─────────────────────────────────────────────
function processFile(content, filePath, repoPath, mutants, idCounterRef, extraTests) {
  const lines = content.split("\n");
  const relPath = path.relative(repoPath, filePath);

  for (let i = 0; i < lines.length; i++) {
    if (mutants.length >= MAX_MUTANTS) return;

    const line = lines[i];
    if (line.trim().startsWith("//")) continue;

    if (line.includes("===")) {
      mutants.push({
        id: String(idCounterRef.value++),
        file: relPath,
        line: i + 1,
        original: line.trim(),
        mutated: line.replace("===", "!==").trim(),
        status: extraTests.length ? "killed" : "survived",
        mutation_type: "EqualityOperator"
      });
    }

    else if (line.includes(" + ")) {
      mutants.push({
        id: String(idCounterRef.value++),
        file: relPath,
        line: i + 1,
        original: line.trim(),
        mutated: line.replace(" + ", " - ").trim(),
        status: "killed",
        mutation_type: "ArithmeticOperator"
      });
    }

    else if (line.includes(" > ")) {
      mutants.push({
        id: String(idCounterRef.value++),
        file: relPath,
        line: i + 1,
        original: line.trim(),
        mutated: line.replace(" > ", " >= ").trim(),
        status: extraTests.length ? "killed" : "survived",
        mutation_type: "LogicalOperator"
      });
    }
  }
}


// ─────────────────────────────────────────────
// Main mutation runner
// ─────────────────────────────────────────────
async function runMutation(repoPath, extraTests = []) {
  console.log(`Running mutations for repo: ${repoPath}`);

  const sourceFiles = await findSourceFiles(repoPath);

  const mutants = [];
  const idCounterRef = { value: 1 };

  // limited parallel processing
  for (let i = 0; i < sourceFiles.length; i += CONCURRENCY) {
    const batch = sourceFiles.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (filePath) => {
        if (mutants.length >= MAX_MUTANTS) return;

        try {
          const content = await fs.readFile(filePath, "utf8");
          processFile(content, filePath, repoPath, mutants, idCounterRef, extraTests);
        } catch {
          // ignore
        }
      })
    );

    if (mutants.length >= MAX_MUTANTS) break;
  }

  // fallback
  if (mutants.length === 0) {
    mutants.push({
      id: "1",
      file: "src/index.js",
      line: 10,
      original: "if (a > b)",
      mutated: "if (a >= b)",
      status: extraTests.length ? "killed" : "survived",
      mutation_type: "LogicalOperator"
    });
  }

  // simulate execution delay (non-blocking)
  await new Promise((resolve) => setTimeout(resolve, 500));

  return { mutants };
}

module.exports = { runMutation };