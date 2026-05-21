const express = require('express');
const router = express.Router();

const { addLog, getLog, verifyChain, exportLogs } = require('../controllers/log.controller');
const apiKeyAuth = require('../middleware/auth');
const postLimiter = require('../middleware/rateLimiter');

router.post('/log', apiKeyAuth, postLimiter, addLog);
router.get('/verify', apiKeyAuth, verifyChain);
router.get('/export', apiKeyAuth, exportLogs);
router.get('/log/:id', apiKeyAuth, getLog);

module.exports = router;