// ============================================================
// docker/stats.js — HELPERS DE CALCUL DE RESSOURCES
// ------------------------------------------------------------
// IMPORTANT : `docker stats` (et donc dockerode) ne renvoie pas un
// pourcentage CPU directement. Diviser le compteur cumulatif
// `cpu_usage.total_usage` par `system_cpu_usage` (comme dans la
// version précédente) donne une valeur quasi toujours proche de 0%
// ou incohérente, car ce sont des compteurs cumulés depuis le
// démarrage, pas une mesure instantanée.
//
// La formule correcte (identique à celle utilisée par `docker
// stats`) repose sur le DELTA entre l'échantillon courant et le
// précédent, fourni par Docker lui-même via `precpu_stats` lors
// d'un appel `stats({ stream: false })`.
// ============================================================

function computeCpuPercent(stats) {
  try {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const onlineCpus = stats.cpu_stats.online_cpus
      || (stats.cpu_stats.cpu_usage.percpu_usage ? stats.cpu_stats.cpu_usage.percpu_usage.length : 1)
      || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      return parseFloat(((cpuDelta / systemDelta) * onlineCpus * 100).toFixed(1));
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

function computeMemPercent(stats) {
  const usage = stats.memory_stats?.usage || 0;
  const limit = stats.memory_stats?.limit || 0;
  if (!limit) return 0;
  return parseFloat(((usage / limit) * 100).toFixed(1));
}

function computeNetworkTotals(stats) {
  const networks = stats.networks || {};
  return Object.values(networks).reduce(
    (acc, iface) => {
      acc.rx += iface.rx_bytes || 0;
      acc.tx += iface.tx_bytes || 0;
      return acc;
    },
    { rx: 0, tx: 0 }
  );
}

module.exports = { computeCpuPercent, computeMemPercent, computeNetworkTotals };