// ============================================================
// docker/hosts.js — ACCÈS DOCKER (ABSTRACTION INTERNE)
// ------------------------------------------------------------
// Le backend s'appuie sur une petite abstraction "client par hôte"
// plutôt que d'utiliser directement `docker` partout : cela garde
// les endpoints (containers, optimisation, sécurité...) écrits de
// façon générique, sans dépendre de la présence d'un seul hôte.
// Actuellement, un seul hôte est enregistré (celui qui exécute
// DockerOpt) — pas d'interface de gestion de plusieurs hôtes exposée.
// ============================================================

const Docker = require('dockerode');

// Docker client (hôte local — celui sur lequel tourne DockerOpt lui-même)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const dockerHosts = new Map(); // name -> { client, config, addedAt }
dockerHosts.set('local', {
  client: docker,
  config: { name: 'local', label: 'Hôte local', builtIn: true },
  addedAt: new Date().toISOString()
});

function getAllHostClients() {
  return Array.from(dockerHosts.entries()).map(([name, h]) => ({ name, client: h.client, config: h.config }));
}

module.exports = { docker, dockerHosts, getAllHostClients };