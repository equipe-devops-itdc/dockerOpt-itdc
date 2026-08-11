// ============================================================
// routes/predict.js — GET /api/predict/resource/:containerName
// ------------------------------------------------------------
// Régression linéaire simple sur l'historique réel exposé par
// Prometheus. Si l'historique est insuffisant, on le signale
// explicitement plutôt que de renvoyer des valeurs inventées.
// ============================================================

const express = require('express');
const axios = require('axios');
const { docker } = require('../docker/hosts');
const { PROMETHEUS_URL } = require('../config');

const router = express.Router();

router.get('/api/predict/resource/:containerName', async (req, res) => {
  const { containerName } = req.params;

  try {
    const container = docker.getContainer(containerName);
    await container.inspect();

    const cpuRange = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
      params: {
        query: `dockeropt_container_resource_percent{container="${containerName}",resource="cpu"}`,
        start: Math.floor(Date.now() / 1000) - 3600,
        end: Math.floor(Date.now() / 1000),
        step: 300
      },
      timeout: 4000
    }).then(r => r.data?.data?.result?.[0]?.values || []).catch(() => []);

    if (cpuRange.length < 3) {
      return res.json({
        container: containerName,
        generated_at: new Date().toISOString(),
        model: 'linear-regression-simple',
        available: false,
        message: "Historique insuffisant pour produire une prédiction fiable — laissez la plateforme tourner quelques minutes de plus."
      });
    }

    const points = cpuRange.map(([, v]) => parseFloat(v));
    const n = points.length;
    const xs = points.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = points.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((acc, x, i) => acc + (x - meanX) * (points[i] - meanY), 0)
      / (xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0) || 1);
    const intercept = meanY - slope * meanX;
    const project = (stepsAhead) => Math.max(0, Math.min(100, intercept + slope * (n - 1 + stepsAhead)));

    res.json({
      container: containerName,
      generated_at: new Date().toISOString(),
      model: 'linear-regression-simple',
      available: true,
      predictions: [{
        resource: 'cpu',
        current: { value: points[n - 1].toFixed(1), unit: '%' },
        predicted_1h: { value: project(12).toFixed(1), unit: '%' },
        trend: slope > 0.05 ? 'increasing' : slope < -0.05 ? 'decreasing' : 'stable'
      }]
    });
  } catch (err) {
    res.status(404).json({ error: 'Container not found' });
  }
});

module.exports = router;