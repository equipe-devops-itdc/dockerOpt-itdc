// ============================================================
// routes/analysis.js — GET /api/analysis/system
// ============================================================

const express = require('express');
const { docker, getAllHostClients } = require('../docker/hosts');
const { queryPrometheusInstant } = require('../prometheus/query');

const router = express.Router();

router.get('/api/analysis/system', async (req, res) => {
  const source = { cpu: 'prometheus', memory: 'prometheus', disk: 'prometheus' };

  let [cpuVal, memVal, diskVal] = await Promise.all([
    queryPrometheusInstant('100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
    queryPrometheusInstant('(node_memory_MemTotal_bytes - node_memory_MemFree_bytes - node_memory_Cached_bytes - node_memory_Buffers_bytes) / node_memory_MemTotal_bytes * 100'),
    queryPrometheusInstant('(node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_free_bytes{mountpoint="/"}) / node_filesystem_size_bytes{mountpoint="/"} * 100')
  ]);

  // Aucune valeur synthétique : si Prometheus/node-exporter n'a pas encore
  // fourni de série, l'interface affiche "—" au lieu d'inventer une mesure.
  const toResult = (val) => ({
    data: { result: val != null ? [{ value: [Date.now() / 1000, String(val)] }] : [] }
  });

  try {
    const info = await docker.info();

    // Compte agrégé sur TOUS les hôtes connectés (local + distants) — un
    // hôte distant injoignable est simplement ignoré, il n'empêche pas
    // l'affichage du reste.
    const perHostCounts = await Promise.allSettled(getAllHostClients().map(async ({ name, client }) => {
      const [running, all] = await Promise.all([
        client.listContainers({ all: false }),
        client.listContainers({ all: true })
      ]);
      return { name, running: running.length, total: all.length };
    }));

    const hostsSummary = perHostCounts.map((r, i) => {
      const hostName = getAllHostClients()[i].name;
      if (r.status === 'fulfilled') return { host: hostName, status: 'online', ...r.value };
      return { host: hostName, status: 'offline', running: 0, total: 0 };
    });

    const aggregatedRunning = hostsSummary.reduce((acc, h) => acc + h.running, 0);
    const aggregatedTotal = hostsSummary.reduce((acc, h) => acc + h.total, 0);

    res.json({
      timestamp: new Date().toISOString(),
      source,
      docker: {
        version: info.ServerVersion,
        containers: {
          running: aggregatedRunning,
          total: aggregatedTotal,
          paused: info.ContainersPaused,
          stopped: info.ContainersStopped
        },
        images: info.Images,
        storageDriver: info.Driver,
        os: info.OperatingSystem,
        kernelVersion: info.KernelVersion,
        cgroupDriver: info.CgroupDriver
      },
      hosts: hostsSummary,
      metrics: { host: 'Prometheus/node-exporter', containers: 'Prometheus/cAdvisor' },
      resources: {
        cpu: toResult(cpuVal),
        memory: toResult(memVal),
        disk: toResult(diskVal)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;