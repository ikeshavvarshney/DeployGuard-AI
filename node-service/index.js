const express = require('express');
const { runMutation } = require('./utils/stryker');
const { runTests, runSingleTest } = require('./utils/jest-runner');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/run-mutation', async (req, res) => {
  try {
    const { repoPath, extraTests = [] } = req.body;
    if (extraTests.length > 0) {
      await writeExtraTests(repoPath, extraTests);
    }
    const result = await runMutation(repoPath, extraTests);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/run-tests', async (req, res) => {
  try {
    const result = await runTests(req.body.repoPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/run-single-test', async (req, res) => {
  try {
    const { testCode, mutantId, repoPath } = req.body;
    const result = await runSingleTest(testCode, mutantId, repoPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.listen(3001, () => console.log('Node service on :3001'));

async function writeExtraTests(repoPath, extraTests) {
  const fs = require('fs').promises;
  const path = require('path');
  const dir = path.join(repoPath, '__deployguard_tests__');
  await fs.mkdir(dir, { recursive: true });
  for (const t of extraTests) {
    await fs.writeFile(path.join(dir, `${t.mutantId}.test.js`), t.testCode);
  }
}
