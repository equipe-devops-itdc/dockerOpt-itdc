// ============================================================
// routes/metricsEndpoint.js — GET /metrics (scrapé par Prometheus)
// ============================================================

const express = require('express');
const { register } = require('../metrics/registry');

const router = express.Router();

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = router;