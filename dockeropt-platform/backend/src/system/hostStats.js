// ============================================================
// system/hostStats.js — REPLI FIABLE (SANS PROMETHEUS)
// ------------------------------------------------------------
// Le tableau de bord ne doit jamais rester bloqué sur "--" si
// Prometheus est indisponible ou encore en train de démarrer. On
// calcule donc les métriques système directement depuis l'hôte
// (module `os` + `df`) en repli.
// ============================================================

const os = require('os');
const fs = require('fs');

let lastCpuSample = null;

function computeHostCpuPercent() {
  const cpus = os.cpus();
  const totals = cpus.reduce(
    (acc, cpu) => {
      const t = cpu.times;
      acc.idle += t.idle;
      acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
      return acc;
    },
    { idle: 0, total: 0 }
  );

  if (!lastCpuSample) {
    lastCpuSample = totals;
    const load1 = os.loadavg()[0];
    return Math.min(100, parseFloat(((load1 / cpus.length) * 100).toFixed(1)));
  }

  const idleDelta = totals.idle - lastCpuSample.idle;
  const totalDelta = totals.total - lastCpuSample.total;
  lastCpuSample = totals;

  if (totalDelta <= 0) return 0;
  return parseFloat((100 - (idleDelta / totalDelta) * 100).toFixed(1));
}

function computeHostMemPercent() {
  const total = os.totalmem();
  const free = os.freemem();
  if (!total) return 0;
  return parseFloat((((total - free) / total) * 100).toFixed(1));
}

async function computeHostDiskPercent() {
  // Implémentation 100% native (fs.statfsSync) plutôt qu'un appel shell à
  // `df`/`awk`/`tr` : évite toute dépendance à des utilitaires système dont
  // la disponibilité varie selon l'image de base (la mésaventure avec Trivy
  // sur Alpine vs Debian a montré que ce genre de supposition est fragile).
  try {
    const stats = fs.statfsSync('/');
    const used = stats.blocks - stats.bfree;
    const total = used + stats.bavail; // même convention que `df` (blocs réservés root exclus)
    if (!total) return null;
    return parseFloat(((used / total) * 100).toFixed(1));
  } catch (e) {
    return null;
  }
}

module.exports = { computeHostCpuPercent, computeHostMemPercent, computeHostDiskPercent };