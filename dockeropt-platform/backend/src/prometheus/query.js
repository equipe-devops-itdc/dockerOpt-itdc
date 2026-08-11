// ============================================================
// prometheus/query.js — petite requête Prometheus instantanée
// réutilisée par /api/analysis/system.
// ============================================================

const axios = require('axios');
const { PROMETHEUS_URL } = require('../config');

async function queryPrometheusInstant(query) {
  try {
    const { data } = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
      params: { query },
      timeout: 4000
    });
    const results = data?.data?.result || [];
    if (!results.length) return null;
    const values = results.map((r) => parseFloat(r.value[1])).filter((v) => !Number.isNaN(v));
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  } catch (e) {
    return null;
  }
}

module.exports = { queryPrometheusInstant };