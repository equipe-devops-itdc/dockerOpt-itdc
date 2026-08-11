// ============================================================
// notifications/monitor.js — NOTIFICATIONS PAR EMAIL
// ------------------------------------------------------------
// Alerte l'administrateur par email dès qu'une situation CRITIQUE
// est détectée (optimisation urgente, faille de sécurité critique,
// conteneur arrêté) — sans avoir besoin de garder l'interface
// ouverte. Conçu pour ne jamais spammer : chaque alerte a une
// identité stable, un email n'est envoyé qu'à sa PREMIÈRE
// apparition, jamais renvoyé pour la même cause tant qu'elle
// persiste, et redevient éligible si elle réapparaît après avoir
// disparu (donc après correction puis récidive).
// ============================================================

const { getAllHostClients } = require('../docker/hosts');
const { computeCpuPercent, computeMemPercent } = require('../docker/stats');
const { auditContainerSecurity } = require('../security/checks');
const { generateRecommendations } = require('../optimize/engine');
const { mailer, sendAlertEmail } = require('./mailer');
const { ALERT_CHECK_INTERVAL_MS } = require('../config');

const notifiedAlertKeys = new Set();

async function checkAndNotify() {
  if (!mailer) return;

  try {
    const criticalAlerts = [];

    // 1. Conteneurs arrêtés de façon inattendue
    for (const { client } of getAllHostClients()) {
      const containers = await client.listContainers({ all: true });
      containers.forEach((c) => {
        if (c.State === 'exited') {
          criticalAlerts.push({
            key: `container-down:${c.Names[0]}`,
            severity: 'critical',
            title: `${c.Names[0].replace('/', '')} — conteneur arrêté`,
            detail: 'Le conteneur ne répond plus.'
          });
        }
      });
    }

    // 2. Recommandations d'optimisation critiques (réutilise le moteur existant)
    for (const { client } of getAllHostClients()) {
      const containers = await client.listContainers({ all: false });
      const details = (await Promise.all(containers.map(async (c) => {
        try {
          const container = client.getContainer(c.Id);
          const [stats, inspect] = await Promise.all([container.stats({ stream: false }), container.inspect()]);
          return {
            id: c.Id, host: 'local', name: c.Names[0].replace('/', ''),
            memory: { usage: stats.memory_stats.usage || 0, limit: stats.memory_stats.limit || 0, percent: computeMemPercent(stats) },
            cpu: { usage: computeCpuPercent(stats) },
            memoryLimit: inspect.HostConfig?.Memory || 0,
            cpuLimit: inspect.HostConfig?.NanoCpus || 0
          };
        } catch (e) { return null; }
      }))).filter(Boolean);

      generateRecommendations(details)
        .filter((r) => r.severity === 'critical' || r.severity === 'warning')
        .forEach((r) => {
          criticalAlerts.push({
            key: `optimization:${r.container}:${r.type}`,
            severity: 'critical',
            title: `${r.container} — ${r.type.toUpperCase()}`,
            detail: r.suggestion
          });
        });
    }

    // 3. Failles de sécurité critiques
    for (const { client } of getAllHostClients()) {
      const containers = await client.listContainers({ all: false });
      for (const c of containers) {
        try {
          const inspect = await client.getContainer(c.Id).inspect();
          const { findings } = auditContainerSecurity(inspect);
          findings.filter((f) => f.severity === 'critical').forEach((f) => {
            criticalAlerts.push({
              key: `security:${c.Names[0]}:${f.id}`,
              severity: 'critical',
              title: `${c.Names[0].replace('/', '')} — ${f.title}`,
              detail: f.remediation
            });
          });
        } catch (e) { /* conteneur inaccessible, ignoré */ }
      }
    }

    const currentKeys = new Set(criticalAlerts.map((a) => a.key));
    const newAlerts = criticalAlerts.filter((a) => !notifiedAlertKeys.has(a.key));

    // Purge les clés qui ne sont plus d'actualité (permet une nouvelle
    // notification si le même problème revient plus tard).
    [...notifiedAlertKeys].forEach((k) => { if (!currentKeys.has(k)) notifiedAlertKeys.delete(k); });
    newAlerts.forEach((a) => notifiedAlertKeys.add(a.key));

    if (newAlerts.length) {
      await sendAlertEmail(newAlerts);
    }
  } catch (err) {
    console.error('[DockerOpt] Vérification des alertes (email) échouée :', err.message);
  }
}

function startAlertMonitor() {
  if (!mailer) return;
  setInterval(checkAndNotify, ALERT_CHECK_INTERVAL_MS);
  // Premier passage peu après le démarrage (laisse le temps à Docker/Prometheus de répondre)
  setTimeout(checkAndNotify, 15000);
}

module.exports = { startAlertMonitor, checkAndNotify };