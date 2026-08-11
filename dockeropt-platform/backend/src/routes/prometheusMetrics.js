// ============================================================
// routes/prometheusMetrics.js — GET /api/metrics/containers
// (requêtes Prometheus agrégées CPU/mémoire/réseau par conteneur)
// ============================================================

const express = require('express');
const axios = require('axios');
const { PROMETHEUS_URL } = require('../config');

const router = express.Router();

router.get('/api/metrics/containers', async (req, res) => {
  try {
    const duration = req.query.duration || '5m';

    const [cpuQuery, memQuery, netQuery] = await Promise.all([
      axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: `sum(rate(container_cpu_usage_seconds_total[${duration}])) by (name) * 100` }
      }).then(r => r.data).catch(() => ({ data: { result: [] } })),
      axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: `sum(container_memory_usage_bytes) by (name)` }
      }).then(r => r.data).catch(() => ({ data: { result: [] } })),
      axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: `sum(rate(container_network_receive_bytes_total[${duration}])) by (name)` }
      }).then(r => r.data).catch(() => ({ data: { result: [] } }))
    ]);

    res.json({ cpu: cpuQuery, memory: memQuery, network: netQuery });
  } catch (err) {
    res.status(500).json({ error: err.message, note: 'Prometheus may not be ready yet' });
  }
});

module.exports = router;