// ============================================================
// routes/security.js
//   GET  /api/security/audit         -> audit de config par conteneur
//   POST /api/security/auto-fix      -> correction automatique limitée
//   POST /api/security/scan-image    -> scan de vulnérabilités (Trivy)
// ============================================================

const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const { getAllHostClients, dockerHosts } = require('../docker/hosts');
const { auditContainerSecurity, AUTO_FIXABLE_FINDINGS } = require('../security/checks');
const { TRIVY_TIMEOUT_MS, TRIVY_CACHE_TTL_MS } = require('../config');

const router = express.Router();

router.get('/api/security/audit', async (req, res) => {
  const perHost = await Promise.allSettled(getAllHostClients().map(async ({ name: hostName, client }) => {
    const containers = await client.listContainers({ all: false });
    return Promise.all(containers.map(async (c) => {
      try {
        const inspect = await client.getContainer(c.Id).inspect();
        const { score, findings } = auditContainerSecurity(inspect);
        return {
          id: c.Id.substring(0, 12),
          host: hostName,
          name: c.Names[0].replace('/', ''),
          image: c.Image,
          score,
          findings
        };
      } catch (e) {
        return null;
      }
    }));
  }));

  const containers = perHost
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((c) => c !== null);

  const criticalCount = containers.filter((c) => c.findings.some((f) => f.severity === 'critical')).length;
  const warningCount = containers.filter((c) => !c.findings.some((f) => f.severity === 'critical') && c.findings.some((f) => f.severity === 'warning')).length;
  const averageScore = containers.length
    ? Math.round(containers.reduce((acc, c) => acc + c.score, 0) / containers.length)
    : 100;

  res.json({
    generated_at: new Date().toISOString(),
    total_containers: containers.length,
    critical_count: criticalCount,
    warning_count: warningCount,
    average_score: averageScore,
    containers: containers.sort((a, b) => a.score - b.score)
  });
});

router.post('/api/security/auto-fix', async (req, res) => {
  const { container: containerName, host: hostName = 'local', findingId } = req.body || {};

  if (!AUTO_FIXABLE_FINDINGS.has(findingId)) {
    return res.status(400).json({
      error: "Ce constat ne peut pas être corrigé automatiquement en toute sécurité (il nécessiterait de recréer le conteneur, avec un risque réel de casser le service). Suivez la remédiation indiquée manuellement."
    });
  }

  const hostEntry = dockerHosts.get(hostName);
  if (!hostEntry) return res.status(404).json({ error: `Hôte '${hostName}' inconnu` });

  try {
    // CORRECTIF : `all: true` (et non `all: false`) pour retrouver aussi un
    // conteneur ARRÊTÉ. `container.update()` fonctionne très bien sur un
    // conteneur stoppé — les nouvelles limites s'appliquent simplement au
    // prochain démarrage. Avec `all: false`, un conteneur arrêté n'était
    // jamais trouvé et la correction échouait avec un 404.
    const containers = await hostEntry.client.listContainers({ all: true });
    const target = containers.find((c) => c.Names[0].replace('/', '') === containerName);
    if (!target) return res.status(404).json({ error: `Conteneur ${containerName} introuvable` });

    const container = hostEntry.client.getContainer(target.Id);
    // Limites par défaut raisonnables — l'utilisateur peut ensuite les
    // affiner depuis l'onglet Optimisation une fois l'usage réel observé.
    const DEFAULT_MEMORY = 512 * 1024 * 1024; // 512 MB
    // CORRECTIF : Docker exige que MemorySwap soit toujours >= Memory. Si on
    // ne fixe QUE `Memory`, l'appel échoue avec un 409 dès que le
    // MemorySwap déjà en place (ex: laissé par une optimisation précédente)
    // est inférieur à la nouvelle valeur. On fixe donc toujours les deux
    // ensemble (swap = 2x la RAM, comportement par défaut de Docker).
    const DEFAULT_MEMORY_SWAP = DEFAULT_MEMORY * 2;
    const DEFAULT_NANO_CPUS = 500000000; // 0.5 CPU

    await container.update({
      Memory: DEFAULT_MEMORY,
      MemorySwap: DEFAULT_MEMORY_SWAP,
      NanoCpus: DEFAULT_NANO_CPUS
    });

    res.json({
      success: true,
      message: `Limites par défaut appliquées (512 MB / 0.5 CPU) sur '${containerName}'. Ajustez-les depuis l'onglet Optimisation selon l'usage réel observé.`
    });
  } catch (err) {
    res.status(500).json({ error: `Échec de la correction : ${err.message}` });
  }
});

// ---- Scan de vulnérabilités d'image (Trivy, à la demande) ----
const trivyCache = new Map(); // image -> { result, scannedAt }

router.post('/api/security/scan-image', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Image requise' });

  const cached = trivyCache.get(image);
  if (cached && Date.now() - cached.scannedAt < TRIVY_CACHE_TTL_MS) {
    return res.json({ ...cached.result, cached: true });
  }

  try {
    const { stdout } = await execAsync(
      `trivy image --quiet --format json --severity CRITICAL,HIGH,MEDIUM,LOW --timeout 150s "${image.replace(/["`$\\]/g, '')}"`,
      { timeout: TRIVY_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 20 }
    );
    const parsed = JSON.parse(stdout);
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const topVulnerabilities = [];

    (parsed.Results || []).forEach((r) => {
      (r.Vulnerabilities || []).forEach((v) => {
        if (counts[v.Severity] != null) counts[v.Severity] += 1;
        if (v.Severity === 'CRITICAL' || v.Severity === 'HIGH') {
          topVulnerabilities.push({
            id: v.VulnerabilityID,
            package: v.PkgName,
            severity: v.Severity,
            installedVersion: v.InstalledVersion,
            fixedVersion: v.FixedVersion || null,
            title: v.Title || v.VulnerabilityID
          });
        }
      });
    });

    const result = {
      image,
      counts,
      totalVulnerabilities: Object.values(counts).reduce((a, b) => a + b, 0),
      topVulnerabilities: topVulnerabilities.slice(0, 15),
      scannedAt: new Date().toISOString()
    };
    trivyCache.set(image, { result, scannedAt: Date.now() });
    res.json({ ...result, cached: false });
  } catch (err) {
    const isMissingBinary = /not found|ENOENT/i.test(err.message);
    res.status(isMissingBinary ? 501 : 500).json({
      error: isMissingBinary
        ? "Trivy n'est pas installé dans le conteneur backend — le scan de vulnérabilités est indisponible, mais l'audit de configuration ci-dessus reste pleinement fonctionnel."
        : `Échec du scan : ${err.message}`
    });
  }
});

module.exports = router;