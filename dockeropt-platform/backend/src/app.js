// ============================================================
// app.js — construit et retourne l'application Express, avec
// tous les middlewares et routes montés dans le même ORDRE que
// le fichier d'origine (important pour l'authentification : le
// login doit être accessible AVANT que authMiddleware ne soit
// appliqué, /me et le reste APRÈS).
// ============================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { authMiddleware } = require('./middleware/auth');
const { publicAuthRouter, protectedAuthRouter } = require('./routes/auth');
const securityRoutes = require('./routes/security');
const metricsEndpoint = require('./routes/metricsEndpoint');
const prometheusMetricsRoutes = require('./routes/prometheusMetrics');
const containerRoutes = require('./routes/containers');
const optimizeRoutes = require('./routes/optimize');
const analysisRoutes = require('./routes/analysis');
const predictRoutes = require('./routes/predict');
const notificationRoutes = require('./routes/notifications');
const healthRoutes = require('./routes/health');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(morgan('combined'));
  app.use(express.json());

  // Connexion : seule route /api/* accessible sans jeton (avec /health et
  // /metrics, qui sont montées plus bas mais restent publiques grâce à
  // PUBLIC_PATHS dans authMiddleware, indépendamment de leur ordre de
  // montage).
  app.use(publicAuthRouter);

  app.use(authMiddleware);

  // Tout ce qui suit passe par authMiddleware.
  app.use(protectedAuthRouter);
  app.use(securityRoutes);
  app.use(containerRoutes);
  app.use(prometheusMetricsRoutes);
  app.use(optimizeRoutes);
  app.use(analysisRoutes);
  app.use(predictRoutes);
  app.use(notificationRoutes);

  // Publiques (listées dans PUBLIC_PATHS) : santé et métriques Prometheus.
  app.use(healthRoutes);
  app.use(metricsEndpoint);

  return app;
}

module.exports = { createApp };