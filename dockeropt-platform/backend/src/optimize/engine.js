// ============================================================
// optimize/engine.js — MOTEUR D'OPTIMISATION
// ------------------------------------------------------------
// PROBLÈME CORRIGÉ (déjà présent dans la version d'origine) : une
// version antérieure décidait d'une recommandation sur UNE SEULE
// mesure instantanée. Un microservice normalement actif peut être
// mesuré à 5% de CPU simplement parce qu'il est interrogé entre
// deux requêtes — ce qui déclenchait une recommandation "réduire"
// en permanence, même quand ce n'était pas justifié. Ce n'est pas
// acceptable pour un usage en entreprise : les recommandations
// doivent refléter un comportement SOUTENU dans le temps, pas un
// instantané bruité.
//
// Solution : on conserve un historique glissant par conteneur
// (fenêtre de RECO_WINDOW_MS) et on ne se prononce que sur la
// moyenne de cette fenêtre, avec un nombre minimal d'échantillons
// avant de statuer.
// ============================================================

const { RECO_WINDOW_MS, RECO_MIN_SAMPLES, COOLDOWN_MS, OPTIMIZATION_LOG_MAX, PLATFORM_INFRA_CONTAINERS } = require('../config');

const resourceHistory = new Map(); // containerId -> [{ t, cpu, mem }]

// Après l'application d'une optimisation, le conteneur doit redémarrer pour
// que le changement prenne effet — le pénaliser à nouveau immédiatement
// (avec l'historique d'AVANT le changement) n'aurait aucun sens. On observe
// donc une période de grâce pendant laquelle ce type de recommandation ne
// réapparaît pas pour ce conteneur.
const recommendationCooldowns = new Map(); // "containerId:type" -> expiryTimestamp

function pushResourceSample(id, cpu, mem) {
  const now = Date.now();
  const series = resourceHistory.get(id) || [];
  series.push({ t: now, cpu, mem });
  const pruned = series.filter((s) => now - s.t <= RECO_WINDOW_MS);
  resourceHistory.set(id, pruned);
  return pruned;
}

function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isOnCooldown(containerId, type) {
  const expiry = recommendationCooldowns.get(`${containerId}:${type}`);
  return expiry != null && Date.now() < expiry;
}

// ---- Journal des détections d'optimisation (par conteneur) ----
//
// Une entrée est ajoutée uniquement lors de la TRANSITION vers un état
// signalé (pas à chaque cycle de 15s tant que la condition persiste), pour
// que le journal reste lisible : on y voit QUAND un problème est apparu et
// POURQUOI (valeur mesurée, seuil), pas un flot répétitif.
const optimizationDetectionLog = [];
const previouslyFlaggedKeys = new Set();

function logNewDetections(recommendations) {
  const currentKeys = new Set(recommendations.map((r) => `${r.host || 'local'}:${r.container}:${r.type}`));

  recommendations.forEach((r) => {
    const key = `${r.host || 'local'}:${r.container}:${r.type}`;
    if (previouslyFlaggedKeys.has(key)) return; // condition déjà signalée, pas une nouvelle détection
    optimizationDetectionLog.unshift({
      timestamp: new Date().toISOString(),
      host: r.host || 'local',
      container: r.container,
      type: r.type,
      severity: r.severity,
      cause: r.current,
      suggestion: r.suggestion,
      impact: r.impact
    });
    if (optimizationDetectionLog.length > OPTIMIZATION_LOG_MAX) optimizationDetectionLog.length = OPTIMIZATION_LOG_MAX;
  });

  // Une clé qui disparaît signifie que la condition n'est plus signalée
  // (résolue, ou en cooldown après application) — elle redeviendra une
  // "nouvelle détection" si elle réapparaît plus tard.
  [...previouslyFlaggedKeys].forEach((k) => { if (!currentKeys.has(k)) previouslyFlaggedKeys.delete(k); });
  currentKeys.forEach((k) => previouslyFlaggedKeys.add(k));
}

function generateRecommendations(containers) {
  const recommendations = [];

  containers.forEach(container => {
    if (!container.memory || !container.cpu) return;
    if (PLATFORM_INFRA_CONTAINERS.has(container.name)) return;

    const series = pushResourceSample(container.id, container.cpu.usage, container.memory.percent);
    if (series.length < RECO_MIN_SAMPLES) return; // pas encore assez d'historique fiable

    const avgCpu = parseFloat(average(series.map(s => s.cpu)).toFixed(1));
    const avgMem = parseFloat(average(series.map(s => s.mem)).toFixed(1));
    const windowMinutes = Math.max(1, Math.round((Date.now() - series[0].t) / 60000));
    const cpuOnCooldown = isOnCooldown(container.id, 'cpu');
    const memOnCooldown = isOnCooldown(container.id, 'memory');

    if (!cpuOnCooldown && avgCpu < 20 && container.cpuLimit > 0) {
      recommendations.push({
        container: container.name,
        host: container.host,
        type: 'cpu',
        severity: 'info',
        current: `${avgCpu}% (moy. ${windowMinutes} min)`,
        suggestion: `Réduire les CPU alloués (actuel: ${(container.cpuLimit / 1e9).toFixed(1)} CPUs)`,
        impact: 'Économie de ressources CPU',
        action: 'reduce_cpu'
      });
    } else if (!cpuOnCooldown && avgCpu > 80) {
      recommendations.push({
        container: container.name,
        host: container.host,
        type: 'cpu',
        severity: 'warning',
        current: `${avgCpu}% (moy. ${windowMinutes} min)`,
        suggestion: `Augmenter les CPU alloués (actuel: ${(container.cpuLimit / 1e9).toFixed(1)} CPUs)`,
        impact: 'Amélioration des performances',
        action: 'increase_cpu'
      });
    }

    if (!memOnCooldown && avgMem < 30 && container.memoryLimit > 0) {
      recommendations.push({
        container: container.name,
        host: container.host,
        type: 'memory',
        severity: 'info',
        current: `${avgMem}% (moy. ${windowMinutes} min)`,
        suggestion: `Réduire la limite mémoire (actuel: ${(container.memoryLimit / 1024 / 1024).toFixed(0)} MB)`,
        impact: 'Économie de RAM',
        action: 'reduce_memory'
      });
    } else if (!memOnCooldown && avgMem > 85) {
      recommendations.push({
        container: container.name,
        host: container.host,
        type: 'memory',
        severity: 'critical',
        current: `${avgMem}% (moy. ${windowMinutes} min)`,
        suggestion: `Augmenter la limite mémoire (actuel: ${(container.memoryLimit / 1024 / 1024).toFixed(0)} MB)`,
        impact: 'Éviter les OOM kills',
        action: 'increase_memory'
      });
    }
  });

  logNewDetections(recommendations);
  return recommendations;
}

module.exports = {
  resourceHistory,
  recommendationCooldowns,
  COOLDOWN_MS,
  optimizationDetectionLog,
  generateRecommendations,
};