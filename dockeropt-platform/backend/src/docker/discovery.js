// ============================================================
// docker/discovery.js — AUTO-DÉCOUVERTE DES SERVICES
// ------------------------------------------------------------
// Toute nouvelle application microservice démarrée sur cet hôte
// Docker (via `docker run` ou `docker compose up`) est
// automatiquement visible ici : aucune inscription manuelle n'est
// nécessaire, la plateforme interroge directement le socket Docker.
// On enrichit juste chaque conteneur avec :
//   - son "stack" d'appartenance (regroupement docker-compose si présent),
//   - un indicateur "isNew" pendant les 3 minutes suivant sa première
//     détection, pour signaler visuellement l'arrivée d'un nouveau service.
// ============================================================

const { NEW_SERVICE_WINDOW_MS } = require('../config');

const firstSeenRegistry = new Map(); // containerId -> timestamp

function resolveGrouping(labels = {}) {
  const stack = labels['com.docker.compose.project'] || labels['dockeropt.stack'] || 'standalone';
  const service = labels['com.docker.compose.service'] || labels['dockeropt.service'] || null;
  return { stack, service };
}

function trackDiscovery(id) {
  const now = Date.now();
  if (!firstSeenRegistry.has(id)) {
    firstSeenRegistry.set(id, now);
    return { firstSeen: now, isNew: true };
  }
  const firstSeen = firstSeenRegistry.get(id);
  return { firstSeen, isNew: now - firstSeen < NEW_SERVICE_WINDOW_MS };
}

module.exports = { resolveGrouping, trackDiscovery };