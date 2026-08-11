// ============================================================
// routes/containers.js — DOCKER API PROXY
//   GET /api/containers
//   GET /api/containers/:id
//   GET /api/containers/:id/logs
// ============================================================

const express = require('express');
const { getAllHostClients, dockerHosts } = require('../docker/hosts');
const { computeCpuPercent, computeMemPercent, computeNetworkTotals } = require('../docker/stats');
const { resolveGrouping, trackDiscovery } = require('../docker/discovery');
const { demuxDockerLogBuffer } = require('../docker/logs');

const router = express.Router();

router.get('/api/containers', async (req, res) => {
  const hostResults = await Promise.allSettled(getAllHostClients().map(async ({ name: hostName, client }) => {
    const containers = await client.listContainers({ all: true });
    return Promise.all(containers.map(async (c) => {
      const { stack, service } = resolveGrouping(c.Labels);
      const discoveryKey = `${hostName}:${c.Id}`;
      const { firstSeen, isNew } = trackDiscovery(discoveryKey);

      const base = {
        id: c.Id.substring(0, 12),
        host: hostName,
        name: c.Names[0].replace('/', ''),
        image: c.Image,
        status: c.State,
        created: c.Created,
        ports: c.Ports,
        networks: Object.keys(c.NetworkSettings?.Networks || {}),
        stack,
        service: service || c.Names[0].replace('/', ''),
        firstSeen,
        isNew
      };

      // On n'interroge les stats en temps réel que pour les conteneurs actifs :
      // `stats()` sur un conteneur arrêté est inutile et ralentit la réponse.
      if (c.State !== 'running') {
        return { ...base, restartPolicy: 'none' };
      }

      try {
        const container = client.getContainer(c.Id);
        const [stats, inspect] = await Promise.all([
          container.stats({ stream: false }),
          container.inspect()
        ]);

        return {
          ...base,
          memory: {
            usage: stats.memory_stats.usage || 0,
            limit: stats.memory_stats.limit || 0,
            percent: computeMemPercent(stats)
          },
          cpu: {
            usage: computeCpuPercent(stats),
            online_cpus: stats.cpu_stats.online_cpus || 1
          },
          network: computeNetworkTotals(stats),
          memoryLimit: inspect.HostConfig?.Memory || 0,
          cpuLimit: inspect.HostConfig?.NanoCpus || 0,
          restartPolicy: inspect.HostConfig?.RestartPolicy?.Name || 'none'
        };
      } catch (err) {
        return { ...base, error: err.message };
      }
    }));
  }));

  // Un hôte injoignable ne doit jamais faire échouer la vue d'ensemble : on
  // agrège ce qui a répondu et on signale les hôtes en échec séparément.
  const detailed = [];
  const hostErrors = [];
  hostResults.forEach((result, i) => {
    const hostName = getAllHostClients()[i].name;
    if (result.status === 'fulfilled') {
      detailed.push(...result.value);
    } else {
      hostErrors.push({ host: hostName, error: result.reason.message });
    }
  });

  if (detailed.length === 0 && hostErrors.length > 0) {
    return res.status(502).json({ error: 'Aucun hôte Docker joignable', hostErrors });
  }

  res.json(detailed);
});

router.get('/api/containers/:id', async (req, res) => {
  const hostName = req.query.host || 'local';
  const entry = dockerHosts.get(hostName);
  if (!entry) return res.status(404).json({ error: `Hôte '${hostName}' inconnu` });
  try {
    const container = entry.client.getContainer(req.params.id);
    const stats = await container.stats({ stream: false });
    const inspect = await container.inspect();
    res.json({ stats, inspect });
  } catch (err) {
    res.status(404).json({ error: 'Container not found' });
  }
});

// Journaux réels du conteneur (équivalent `docker logs`) — utile pour
// diagnostiquer une panne directement depuis la plateforme.
router.get('/api/containers/:id/logs', async (req, res) => {
  const hostName = req.query.host || 'local';
  const entry = dockerHosts.get(hostName);
  if (!entry) return res.status(404).json({ error: `Hôte '${hostName}' inconnu` });

  try {
    const container = entry.client.getContainer(req.params.id);
    const inspect = await container.inspect();
    const tail = Math.min(Number(req.query.tail) || 200, 1000);
    const raw = await container.logs({ stdout: true, stderr: true, tail, timestamps: true, follow: false });
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

    let text;
    if (inspect.Config?.Tty) {
      text = buffer.toString('utf-8');
    } else {
      text = demuxDockerLogBuffer(buffer) ?? buffer.toString('utf-8');
    }

    res.json({
      container: inspect.Name?.replace('/', ''),
      lines: text.split('\n').filter((l) => l.length > 0)
    });
  } catch (err) {
    res.status(404).json({ error: `Impossible de récupérer les logs : ${err.message}` });
  }
});

module.exports = router;