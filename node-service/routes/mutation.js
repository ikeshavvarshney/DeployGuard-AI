const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { repoPath } = req.body;
        // Stub: In reality this would invoke stryker.js util
        res.json({ status: 'success', message: `Mutation testing started for ${repoPath}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
