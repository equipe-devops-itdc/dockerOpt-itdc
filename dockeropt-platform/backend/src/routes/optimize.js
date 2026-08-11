// ============================================================
// routes/optimize.js
//   GET  /api/optimize/recommendations
//   POST /api/optimize/apply
//   GET  /api/optimize/history
//   POST /api/optimize/history
//   GET  /api/optimize/logs
// ============================================================

const express = require('express');
const { getAllHostClients, dockerHosts } = require('../docker/hosts');
const { computeCpuPercent, computeMemPercent } = require('../docker/stats');
const { listOptimizationHistory, saveOptimizationHistory } = require('../../db');
const {
  generateRecommendations,
  resourceHistory,
  recommendationCooldowns,
  COOLDOWN_MS,
  optimizationDetectionLog,
} = require('../optimize/engine');
const { PLATFORM_INFRA_CONTAINERS, RECO_WINDOW_MS } = require('../config');
const { optimizationActions, resourceRecommendations, containerResourceUsage } = require('../metrics/registry');

const router = express.Router();

router.get('/api/optimize/recommendations', async (req, res) => {
  try {
    const perHost = await Promise.allSettled(getAllHostClients().map(async ({ name: hostName, client }) => {
      const containers = await client.listContainers({ all: false });
      return Promise.all(containers.map(async (c) => {
        try {
          const container = client.getContainer(c.Id);
          const [stats, inspect] = await Promise.all([
            container.stats({ stream: false }),
            container.inspect()
          ]);

          return {
            id: `${hostName}:${c.Id}`,
            host: hostName,
            name: c.Names[0].replace('/', ''),
            memory: {
              usage: stats.memory_stats.usage || 0,
              limit: stats.memory_stats.limit || 0,
              percent: computeMemPercent(stats)
            },
            cpu: {
              usage: computeCpuPercent(stats),
              online_cpus: stats.cpu_stats.online_cpus || 1
            },
            memoryLimit: inspect.HostConfig?.Memory || 0,
            cpuLimit: inspect.HostConfig?.NanoCpus || 0
          };
        } catch (e) {
          return null;
        }
      }));
    }));

    const validDetails = perHost
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .filter((d) => d !== null);
    const monitoredDetails = validDetails.filter(d => !PLATFORM_INFRA_CONTAINERS.has(d.name));
    const recommendations = generateRecommendations(validDetails);

    validDetails.forEach(d => {
      containerResourceUsage.set({ container: d.name, resource: 'memory' }, parseFloat(d.memory.percent));
      containerResourceUsage.set({ container: d.name, resource: 'cpu' }, parseFloat(d.cpu.usage));
    });

    const pendingCounts = {};
    recommendations.forEach(r => {
      const key = `${r.container}:${r.type}`;
      pendingCounts[key] = (pendingCounts[key] || 0) + 1;
    });
    Object.entries(pendingCounts).forEach(([k, v]) => {
      const [container, resourceType] = k.split(':');
      resourceRecommendations.set({ container, resource_type: resourceType }, v);
    });

    res.json({
      generated_at: new Date().toISOString(),
      total_containers: monitoredDetails.length,
      excluded_infra_containers: validDetails.length - monitoredDetails.length,
      analysis_window_minutes: RECO_WINDOW_MS / 60000,
      total_recommendations: recommendations.length,
      recommendations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/optimize/apply', async (req, res) => {
  const { container: containerName, action, host: hostName = 'local' } = req.body;

  const hostEntry = dockerHosts.get(hostName);
  if (!hostEntry) {
    return res.status(404).json({ error: `Hôte '${hostName}' inconnu` });
  }
  const client = hostEntry.client;

  try {
    // CORRECTIF : `all: true` pour pouvoir aussi appliquer une optimisation
    // sur un conteneur ARRÊTÉ (les nouvelles limites s'appliqueront à son
    // prochain démarrage). Avec `all: false`, un conteneur arrêté n'était
    // jamais trouvé et l'application échouait avec un 404.
    const containers = await client.listContainers({ all: true });
    const target = containers.find(c => c.Names[0].replace('/', '') === containerName);

    if (!target) {
      return res.status(404).json({ error: `Container ${containerName} not found` });
    }

    const container = client.getContainer(target.Id);
    const currentConfig = await container.inspect();

    let updateConfig = {};
    let actionDescription = '';

    switch (action) {
      case 'reduce_cpu': {
        const newCpu = Math.max(Math.floor((currentConfig.HostConfig.NanoCpus || 500000000) * 0.7), 50000000);
        updateConfig = { NanoCpus: newCpu };
        actionDescription = `CPU réduit à ${(newCpu / 1e9).toFixed(1)} CPUs`;
        break;
      }
      case 'increase_cpu': {
        const increasedCpu = Math.floor((currentConfig.HostConfig.NanoCpus || 500000000) * 1.5);
        updateConfig = { NanoCpus: increasedCpu };
        actionDescription = `CPU augmenté à ${(increasedCpu / 1e9).toFixed(1)} CPUs`;
        break;
      }
      case 'reduce_memory': {
        const newMem = Math.max(Math.floor((currentConfig.HostConfig.Memory || 268435456) * 0.7), 83886080);
        // CORRECTIF : toujours fixer MemorySwap en même temps que Memory —
        // Docker refuse (409) une Memory inférieure au MemorySwap déjà en
        // place. On garde le ratio par défaut de Docker (swap = 2x la RAM).
        updateConfig = { Memory: newMem, MemorySwap: newMem * 2 };
        actionDescription = `Mémoire réduite à ${(newMem / 1024 / 1024).toFixed(0)} MB`;
        break;
      }
      case 'increase_memory': {
        const increasedMem = Math.floor((currentConfig.HostConfig.Memory || 268435456) * 1.5);
        updateConfig = { Memory: increasedMem, MemorySwap: increasedMem * 2 };
        actionDescription = `Mémoire augmentée à ${(increasedMem / 1024 / 1024).toFixed(0)} MB`;
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    await container.update(updateConfig);
    optimizationActions.inc({ action, container: containerName, status: 'applied' });

    // IMPORTANT : la clé doit être IDENTIQUE à celle utilisée par le moteur
    // de recommandations (`${host}:${containerId}`), sans quoi le cooldown
    // ne cible pas le bon conteneur et la recommandation peut réapparaître
    // immédiatement après application — c'est ce qui la faisait "rester"
    // dans la liste malgré le clic sur Appliquer.
    const historyKey = `${hostName}:${target.Id}`;
    const type = action.includes('cpu') ? 'cpu' : 'memory';
    resourceHistory.delete(historyKey);
    recommendationCooldowns.set(`${historyKey}:${type}`, Date.now() + COOLDOWN_MS);

    res.json({
      success: true,
      container: containerName,
      host: hostName,
      action,
      description: actionDescription,
      note: 'Cette recommandation restera masquée pendant la période d\'observation qui suit (~3 minutes)'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/api/optimize/history', async (req, res) => {
  try {
    res.json(await listOptimizationHistory(100));
  } catch (err) {
    res.status(500).json({ error: `Historique indisponible : ${err.message}` });
  }
});

router.post('/api/optimize/history', async (req, res) => {
  try {
    const entry = await saveOptimizationHistory(req.body || {});
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: `Impossible d’enregistrer l’historique : ${err.message}` });
  }
});

// Journal des CAUSES de détection (pourquoi une recommandation a été
// déclenchée, avec la valeur mesurée) — distinct de l'historique
// ci-dessus, qui ne trace que les optimisations réellement APPLIQUÉES.
router.get('/api/optimize/logs', (req, res) => {
  const { container } = req.query;
  const filtered = container
    ? optimizationDetectionLog.filter((l) => l.container === container)
    : optimizationDetectionLog;
  res.json(filtered.slice(0, 100));
});

module.exports = router;