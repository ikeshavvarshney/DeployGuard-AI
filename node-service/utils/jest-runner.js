const { exec } = require('child_process');

/**
 * runTests — runs `npm test` in the repo and returns structured results.
 *
 * Returns:
 *   {
 *     passed:         bool,     // overall: no failures
 *     numTotalTests:  number,
 *     numPassedTests: number,
 *     numFailedTests: number,
 *     output:         string,   // raw stdout
 *     error:          string,   // raw stderr
 *     failures:       Array<{testName, message}>
 *   }
 */
async function runTests(repoPath) {
  return new Promise((resolve) => {
    // --forceExit prevents Jest from hanging; --json gives machine-readable output
    const cmd = 'npx jest --forceExit --json --testTimeout=15000 2>/dev/null || npx jest --forceExit --testTimeout=15000';

    exec(cmd, { cwd: repoPath, timeout: 60000 }, (error, stdout, stderr) => {
      // ── Try to parse Jest JSON output (most reliable) ──
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          const failures = [];
          for (const suite of (result.testResults || [])) {
            for (const t of (suite.testResults || [])) {
              if (t.status === 'failed') {
                failures.push({
                  testName: t.fullName || t.title || '',
                  message: (t.failureMessages || []).join('\n').slice(0, 500),
                });
              }
            }
          }
          return resolve({
            passed:         result.numFailedTests === 0,
            numTotalTests:  result.numTotalTests  || 0,
            numPassedTests: result.numPassedTests  || 0,
            numFailedTests: result.numFailedTests  || 0,
            output:         stdout.slice(0, 2000),
            error:          stderr.slice(0, 500),
            failures,
          });
        }
      } catch (_) { /* fall through to text parsing */ }

      // ── Fallback: parse Jest human-readable output ──
      const combined = stdout + '\n' + stderr;
      let numTotal = 0, numPassed = 0, numFailed = 0;

      // e.g. "Tests: 2 failed, 5 passed, 7 total"
      const m1 = combined.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (m1) {
        numFailed = parseInt(m1[1]); numPassed = parseInt(m1[2]); numTotal = parseInt(m1[3]);
      } else {
        // e.g. "Tests: 5 passed, 5 total"
        const m2 = combined.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
        if (m2) { numPassed = parseInt(m2[1]); numTotal = parseInt(m2[2]); }
      }

      // Collect failure messages from stderr (lines after ●)
      const failures = [];
      const failLines = combined.split('\n');
      let inFailure = false, currentName = '', currentMsg = [];
      for (const line of failLines) {
        if (line.trim().startsWith('● ')) {
          if (currentName) failures.push({ testName: currentName, message: currentMsg.join('\n').slice(0, 300) });
          currentName = line.replace('●', '').trim();
          currentMsg = [];
          inFailure = true;
        } else if (inFailure) {
          currentMsg.push(line);
        }
      }
      if (currentName) failures.push({ testName: currentName, message: currentMsg.join('\n').slice(0, 300) });

      resolve({
        passed:         !error && numFailed === 0,
        numTotalTests:  numTotal,
        numPassedTests: numPassed,
        numFailedTests: numFailed,
        output:         combined.slice(0, 2000),
        error:          stderr.slice(0, 500),
        failures,
      });
    });
  });
}

async function runSingleTest(testCode, mutantId, repoPath) {
  const path = require('path');
  const fs = require('fs');

  const testDir = path.join(repoPath, '__deployguard_tests__');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testFile = path.join(testDir, `${mutantId}.test.js`);
  const fixedTestCode = fixImportPaths(testCode, repoPath);

  try {
    fs.writeFileSync(testFile, fixedTestCode);
    const { execSync } = require('child_process');
    const cmd = [
      'npx jest', JSON.stringify(testFile),
      '--no-coverage', '--testEnvironment=node',
      '--forceExit', '--passWithNoTests', '--json',
      '--rootDir', JSON.stringify(repoPath), '--testTimeout=8000',
    ].join(' ');

    let output;
    try {
      output = execSync(cmd, {
        cwd: repoPath, stdio: 'pipe', timeout: 20000,
        env: { ...process.env, NODE_ENV: 'test' },
      }).toString();
    } catch (e) {
      output = e.stdout?.toString() || '';
      if (!output.includes('"numTotalTests"')) {
        return { passed: false, output: e.stderr?.toString().slice(0, 500) || e.message, error: 'jest_crash' };
      }
    }

    const result = JSON.parse(output);
    const passed = result.numPassedTests > 0 && result.numFailedTests === 0;
    return { passed, output: (result.testResults?.[0]?.message || '').slice(0, 500) };
  } catch (e) {
    return { passed: false, output: e.message?.slice(0, 500), error: 'exception' };
  } finally {
    try { fs.unlinkSync(testFile); } catch {}
  }
}

function fixImportPaths(testCode, repoPath) {
  const fs = require('fs');
  const path = require('path');
  return testCode.replace(/require\(['"](\.[^'"]+)['"]\)/g, (match, importPath) => {
    const fromTestDir = path.resolve(repoPath, '__deployguard_tests__', importPath);
    const fromRepoRoot = path.resolve(repoPath, importPath);
    if (!fs.existsSync(fromTestDir) && fs.existsSync(fromRepoRoot)) {
      const fixed = importPath.startsWith('.') ? '../' + importPath.replace(/^\.\//, '') : importPath;
      return `require('${fixed}')`;
    }
    return match;
  });
}

module.exports = { runTests, runSingleTest };
