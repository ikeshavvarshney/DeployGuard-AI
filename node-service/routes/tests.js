const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { repoPath, tests } = req.body;
        // Stub: In reality this would invoke jest-runner.js util
        res.json({ status: 'success', message: `Tests executed for ${repoPath}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
