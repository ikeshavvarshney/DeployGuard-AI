const { exec } = require('child_process');

async function runTests(repoPath) {
  return new Promise((resolve) => {
    exec('npm test', { cwd: repoPath }, (error, stdout, stderr) => {
      resolve({
        passed: !error,
        output: stdout,
        error: stderr
      });
    });
  });
}

async function runSingleTest(testCode, mutantId, repoPath) {
  const path = require('path');
  const fs = require('fs');

  // FIXED: Write test file inside __deployguard_tests__ subdir
  // so relative imports like require('../src/x') resolve correctly
  // from inside that subdir (one level down from repo root)
  const testDir = path.join(repoPath, '__deployguard_tests__');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const testFile = path.join(testDir, `${mutantId}.test.js`);

  // FIXED: Rewrite import paths in test code
  // Qwen generates paths like require('./src/utils') assuming test is at repo root
  // but our test is one level inside __deployguard_tests__/
  // Prefix any relative require/import with ../
  const fixedTestCode = fixImportPaths(testCode, repoPath);

  try {
    fs.writeFileSync(testFile, fixedTestCode);

    const { execSync } = require('child_process');

    // FIXED: explicit flags to avoid config issues
    const cmd = [
      'npx jest',
      JSON.stringify(testFile),   // absolute path, no glob ambiguity
      '--no-coverage',
      '--testEnvironment=node',
      '--forceExit',
      '--passWithNoTests',
      '--json',
      '--rootDir', JSON.stringify(repoPath),   // FIXED: rootDir = repo, not testDir
      '--testTimeout=8000'
    ].join(' ');

    let output;
    try {
      output = execSync(cmd, {
        cwd: repoPath,
        stdio: 'pipe',
        timeout: 20000,
        env: { ...process.env, NODE_ENV: 'test' }
      }).toString();
    } catch (e) {
      // Jest exits 1 on test failure — still parse the JSON output
      output = e.stdout?.toString() || '';
      const stderr = e.stderr?.toString() || '';

      // Real crash (no JSON output at all)
      if (!output.includes('"numTotalTests"')) {
        return {
          passed: false,
          output: stderr.slice(0, 500) || e.message,
          error: 'jest_crash'
        };
      }
    }

    const result = JSON.parse(output);
    const passed = result.numPassedTests > 0 && result.numFailedTests === 0;
    const message = result.testResults?.[0]?.message || '';

    return { passed, output: message.slice(0, 500) };

  } catch (e) {
    return { passed: false, output: e.message?.slice(0, 500), error: 'exception' };
  } finally {
    try { fs.unlinkSync(testFile); } catch {}
  }
}

function fixImportPaths(testCode, repoPath) {
  const fs = require('fs');
  const path = require('path');

  // Replace require('./something') or require('../something') with corrected paths
  // Goal: make paths resolve from __deployguard_tests__ dir (one level inside repo)
  return testCode.replace(
    /require\(['"](\.[^'"]+)['"]\)/g,
    (match, importPath) => {
      // Already going up a level — check if path actually exists from testDir
      const fromTestDir = path.resolve(repoPath, '__deployguard_tests__', importPath);
      const fromRepoRoot = path.resolve(repoPath, importPath);

      if (!fs.existsSync(fromTestDir) && fs.existsSync(fromRepoRoot)) {
        // Path is valid from repo root but not from testDir
        // Prepend ../ to fix it
        const fixed = importPath.startsWith('.')
          ? '../' + importPath.replace(/^\.\//, '')
          : importPath;
        return `require('${fixed}')`;
      }
      return match;
    }
  );
}

module.exports = { runTests, runSingleTest };
