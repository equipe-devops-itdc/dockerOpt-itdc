// ============================================================
// routes/health.js — GET /health
// ============================================================

const express = require('express');
const { SERVICE_DISPLAY, PROMETHEUS_URL } = require('../config');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    service: SERVICE_DISPLAY,
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    modules: { docker: true, prometheus: PROMETHEUS_URL }
  });
});

module.exports = router;