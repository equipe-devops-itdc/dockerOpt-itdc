// ============================================================
// metrics/registry.js — registre Prometheus (prom-client) et
// métriques custom, partagées entre les routes qui les alimentent
// (optimize) et celle qui les expose (/metrics).
// ============================================================

const promClient = require('prom-client');
const { METRICS_PREFIX } = require('../config');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: METRICS_PREFIX });

const optimizationActions = new promClient.Counter({
  name: `${METRICS_PREFIX}optimization_actions_total`,
  help: 'Total optimization actions performed',
  labelNames: ['action', 'container', 'status'],
  registers: [register]
});

const resourceRecommendations = new promClient.Gauge({
  name: `${METRICS_PREFIX}recommendations_pending`,
  help: 'Number of pending optimization recommendations',
  labelNames: ['container', 'resource_type'],
  registers: [register]
});

const containerResourceUsage = new promClient.Gauge({
  name: `${METRICS_PREFIX}container_resource_percent`,
  help: 'Container resource usage percentage',
  labelNames: ['container', 'resource'],
  registers: [register]
});

module.exports = { register, optimizationActions, resourceRecommendations, containerResourceUsage };