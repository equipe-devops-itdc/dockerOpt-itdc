// ============================================================
// DockerOpt - Plateforme d'Optimisation des Ressources Docker
// Backend Principal
// ============================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const promClient = require('prom-client');
const axios = require('axios');
const Docker = require('dockerode');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDatabase, authenticateUser, listOptimizationHistory, saveOptimizationHistory } = require('./db');

const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 5000;
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
const SERVICE_DISPLAY = 'dockeropt-backend';
const METRICS_PREFIX = 'dockeropt_';

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// ==================== AUTHENTIFICATION (COMPTE ADMIN) ====================
//
// Accès protégé par un compte administrateur unique (usage interne à
// l'entreprise, pas de gestion multi-utilisateurs) : identifiants définis
// via variables d'environnement, session par jeton JWT (24h). Toutes les
// routes /api/* exigent un jeton valide, à l'exception de la connexion
// elle-même et des endpoints techniques (/health, /metrics) qui doivent
// rester accessibles aux sondes de santé et à Prometheus sans jeton.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('[DockerOpt] ADMIN_EMAIL, ADMIN_PASSWORD et JWT_SECRET doivent être définis dans .env');
  process.exit(1);
}


const PUBLIC_PATHS = new Set(['/api/auth/login', '/health', '/metrics']);

function authMiddleware(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (!req.path.startsWith('/api/')) return next(); // routes non-API (aucune ici, sécurité par défaut)

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session invalide ou expirée, veuillez vous reconnecter' });
  }
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  try {
    const user = await authenticateUser(email, password);
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });
    const token = jwt.sign(
      { sub: String(user.id), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ token, user: { email: user.email, role: user.role } });
  } catch (err) {
    console.error('[DockerOpt] Auth PostgreSQL:', err.message);
    res.status(503).json({ error: 'Service d’authentification temporairement indisponible' });
  }
});

app.use(authMiddleware);

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user });
});

// Docker client (hôte local — celui sur lequel tourne DockerOpt lui-même)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// ==================== ACCÈS DOCKER (ABSTRACTION INTERNE) ====================
//
// Le backend s'appuie sur une petite abstraction "client par hôte" plutôt
// que d'utiliser directement `docker` partout : cela garde les endpoints
// (containers, optimisation, sécurité...) écrits de façon générique, sans
// dépendre de la présence d'un seul hôte. Actuellement, un seul hôte est
// enregistré (celui qui exécute DockerOpt) — pas d'interface de gestion de
// plusieurs hôtes exposée.
const dockerHosts = new Map(); // name -> { client, config, addedAt }
dockerHosts.set('local', {
  client: docker,
  config: { name: 'local', label: 'Hôte local', builtIn: true },
  addedAt: new Date().toISOString()
});

function getAllHostClients() {
  return Array.from(dockerHosts.entries()).map(([name, h]) => ({ name, client: h.client, config: h.config }));
}

// ==================== SÉCURITÉ DES CONTENEURS ====================
//
// Deux volets, volontairement séparés :
//
// 1. Audit de CONFIGURATION (toujours actif, instantané, zéro dépendance
//    externe) : analyse directement les données déjà renvoyées par l'API
//    Docker (`inspect`) pour détecter les réglages à risque (privileged,
//    socket Docker monté, exécution en root, capacités élargies, etc.).
//    Fiable à 100% car il ne dépend d'aucun outil tiers ni d'accès réseau.
//
// 2. Scan de VULNÉRABILITÉS d'image (à la demande, via Trivy) : plus lourd
//    et plus lent, déclenché explicitement par l'utilisateur pour une image
//    donnée, avec mise en cache — jamais exécuté automatiquement en arrière-
//    plan pour ne pas dégrader les performances de la plateforme.

const SECURITY_CHECKS = [
  {
    id: 'privileged',
    severity: 'critical',
    test: (info) => !!info.HostConfig?.Privileged,
    title: 'Mode privilégié activé',
    detail: 'Le conteneur a un accès quasi total au noyau de l\'hôte — une compromission du conteneur équivaut à une compromission de l\'hôte.',
    remediation: 'Retirez `privileged: true` et accordez uniquement les capacités précises requises via `cap_add`.'
  },
  {
    id: 'docker-socket',
    severity: 'critical',
    test: (info) => (info.Mounts || []).some((m) => (m.Source || '').includes('docker.sock') || (m.Destination || '').includes('docker.sock')),
    title: 'Socket Docker monté dans le conteneur',
    detail: 'Un conteneur avec accès au socket Docker peut créer, modifier ou supprimer n\'importe quel autre conteneur, et effectivement s\'évader vers l\'hôte.',
    remediation: 'Si le conteneur doit réellement piloter Docker (ex: cet outil de supervision), limitez ce montage au strict nécessaire, envisagez un proxy Docker API en lecture seule (ex: docker-socket-proxy) pour les cas où l\'écriture n\'est pas requise.'
  },
  {
    id: 'host-network',
    severity: 'critical',
    test: (info) => info.HostConfig?.NetworkMode === 'host',
    title: 'Réseau hôte partagé (network_mode: host)',
    detail: 'Le conteneur partage la pile réseau de l\'hôte : aucune isolation, tous les ports de l\'hôte lui sont accessibles.',
    remediation: 'Utilisez un réseau Docker dédié et publiez explicitement les ports nécessaires avec `ports:`.'
  },
  {
    id: 'host-pid-ipc',
    severity: 'warning',
    test: (info) => info.HostConfig?.PidMode === 'host' || info.HostConfig?.IpcMode === 'host',
    title: 'Espace de noms PID/IPC de l\'hôte partagé',
    detail: 'Le conteneur peut voir et potentiellement signaler les processus de l\'hôte lui-même.',
    remediation: 'Retirez `pid: host` / `ipc: host` sauf nécessité technique explicite et documentée.'
  },
  {
    id: 'cap-add',
    severity: 'warning',
    test: (info) => (info.HostConfig?.CapAdd || []).length > 0,
    title: 'Capacités Linux additionnelles accordées',
    detail: (info) => `Capacités ajoutées au-delà du profil par défaut : ${(info.HostConfig?.CapAdd || []).join(', ')}.`,
    remediation: 'Vérifiez que chaque capacité ajoutée est strictement nécessaire ; préférez `cap_drop: [ALL]` puis un `cap_add` minimal ciblé.'
  },
  {
    id: 'security-opt-unconfined',
    severity: 'warning',
    test: (info) => (info.HostConfig?.SecurityOpt || []).some((o) => o.includes('unconfined')),
    title: 'Seccomp ou AppArmor désactivé',
    detail: 'Le profil de sécurité par défaut (seccomp/AppArmor) est désactivé pour ce conteneur, supprimant une couche de protection contre les appels système dangereux.',
    remediation: 'Retirez `unconfined` sauf besoin très spécifique (ex: débogage) et repassez au profil par défaut en production.'
  },
  {
    id: 'root-user',
    severity: 'warning',
    test: (info) => !info.Config?.User || info.Config.User === '0' || info.Config.User === 'root',
    title: 'Processus exécuté en tant que root',
    detail: (info) => `Utilisateur défini dans l'image : ${info.Config?.User ? `"${info.Config.User}"` : 'aucun (root par défaut)'}. Le processus principal tourne avec les droits root à l'intérieur du conteneur.`,
    remediation: 'Ajoutez une instruction `USER` non-root dans le Dockerfile, ou `user:` dans le service docker-compose.'
  },
  {
    id: 'no-resource-limits',
    severity: 'info',
    test: (info) => !info.HostConfig?.Memory && !info.HostConfig?.NanoCpus,
    title: 'Aucune limite CPU/mémoire définie',
    detail: 'Ni `mem_limit` ni `cpus` ne sont configurés pour ce conteneur (les deux valent 0). Un conteneur sans limite peut consommer toutes les ressources de l\'hôte en cas de dérive (bug, boucle infinie, attaque).',
    remediation: 'Définissez `mem_limit` et `cpus` — voir l\'onglet Optimisation pour des recommandations basées sur l\'usage réel.'
  },
  {
    id: 'latest-tag',
    severity: 'info',
    test: (info) => {
      const img = info.Config?.Image || '';
      const afterSlash = img.split('/').pop();
      return !afterSlash.includes(':') || afterSlash.endsWith(':latest');
    },
    title: 'Image sans version figée (tag "latest" ou absent)',
    detail: (info) => `Image actuellement utilisée : \`${info.Config?.Image || 'inconnue'}\`. Sans tag précis, impossible de garantir que le même code tourne d'un déploiement à l'autre, et les correctifs de sécurité ne sont pas maîtrisés.`,
    remediation: 'Épinglez une version explicite (ex: `mon-image:1.4.2`) ou, mieux, un digest SHA256.'
  },
  {
    id: 'readonly-rootfs',
    severity: 'info',
    test: (info) => !info.HostConfig?.ReadonlyRootfs,
    title: 'Système de fichiers racine modifiable',
    detail: 'Un attaquant ayant compromis le processus peut écrire sur le système de fichiers du conteneur (persistance, altération de binaires).',
    remediation: 'Activez `read_only: true` et montez des volumes en écriture uniquement là où c\'est strictement nécessaire (ex: /tmp).'
  },
  {
    id: 'exposed-all-interfaces',
    severity: 'info',
    test: (info) => Object.values(info.HostConfig?.PortBindings || {}).some((bindings) => (bindings || []).some((b) => !b.HostIp || b.HostIp === '0.0.0.0')),
    title: 'Port publié sur toutes les interfaces (0.0.0.0)',
    detail: (info) => {
      const ports = Object.entries(info.HostConfig?.PortBindings || {})
        .filter(([, bindings]) => (bindings || []).some((b) => !b.HostIp || b.HostIp === '0.0.0.0'))
        .map(([containerPort, bindings]) => `${containerPort} → ${bindings[0]?.HostPort || '?'}`)
        .join(', ');
      return `Port(s) concerné(s) : ${ports || 'non déterminé'}. Accessible depuis n'importe quelle interface réseau de l'hôte, y compris une interface publique si l'hôte en a une.`;
    },
    remediation: 'Si le service n\'a pas besoin d\'être exposé publiquement, liez-le à 127.0.0.1 (`"127.0.0.1:PORT:PORT"`) ou passez par un reverse-proxy.'
  },
  {
    id: 'no-healthcheck',
    severity: 'info',
    test: (info) => !info.Config?.Healthcheck || (info.Config.Healthcheck.Test || []).includes('NONE'),
    title: 'Aucun HEALTHCHECK défini',
    detail: 'Sans vérification de santé, Docker ne peut pas détecter automatiquement un conteneur bloqué ou en échec silencieux (processus vivant mais service ne répondant plus).',
    remediation: 'Ajoutez une instruction `HEALTHCHECK` dans le Dockerfile, ou `healthcheck:` dans le service docker-compose.'
  },
  {
    id: 'possible-hardcoded-secret',
    severity: 'warning',
    test: (info) => (info.Config?.Env || []).some((e) => /^(.*_)?(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)=.+/i.test(e) && !/=\$\{|=CHANGE|=REPLACE_ME|=<.*>/i.test(e)),
    title: 'Secret potentiellement en clair dans les variables d\'environnement',
    detail: (info) => {
      const suspects = (info.Config?.Env || [])
        .filter((e) => /^(.*_)?(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)=.+/i.test(e))
        .map((e) => e.split('=')[0]);
      return `Variable(s) concernée(s) : ${suspects.join(', ') || 'non déterminé'}. Une valeur visible directement dans la configuration du conteneur (via \`docker inspect\`) est accessible à quiconque a accès au socket Docker ou aux logs de déploiement.`;
    },
    remediation: 'Utilisez un gestionnaire de secrets (Docker secrets, Vault, variables chiffrées côté CI/CD) plutôt qu\'une valeur en clair dans `environment:`.'
  }
];

const SEVERITY_WEIGHT = { critical: 25, warning: 10, info: 3 };

function auditContainerSecurity(info) {
  const findings = SECURITY_CHECKS
    .filter((check) => {
      try { return check.test(info); } catch (_) { return false; }
    })
    .map((check) => ({
      id: check.id,
      severity: check.severity,
      title: check.title,
      detail: typeof check.detail === 'function' ? check.detail(info) : check.detail,
      remediation: check.remediation
    }));

  const penalty = findings.reduce((acc, f) => acc + SEVERITY_WEIGHT[f.severity], 0);
  const score = Math.max(0, 100 - penalty);

  return { score, findings };
}

app.get('/api/security/audit', async (req, res) => {
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

// ---- Correction automatique — volontairement limitée ----
//
// Beaucoup de constats de sécurité (mode privilégié, root, capacités,
// filesystem en lecture-écriture...) exigent de RECRÉER le conteneur avec
// une configuration différente. Le faire automatiquement est risqué : sans
// connaître les besoins réels de l'application, retirer par exemple
// `privileged` ou changer d'utilisateur peut casser le service en
// production. Seul le constat "aucune limite de ressources" peut être
// corrigé en toute sécurité sur un conteneur EN COURS D'EXÉCUTION (l'API
// Docker `update` le permet sans redémarrage) — c'est le seul cas géré
// automatiquement ici. Pour tout le reste, la remédiation reste manuelle
// et délibérée, avec des instructions précises déjà fournies par l'audit.
const AUTO_FIXABLE_FINDINGS = new Set(['no-resource-limits']);

app.post('/api/security/auto-fix', async (req, res) => {
  const { container: containerName, host: hostName = 'local', findingId } = req.body || {};

  if (!AUTO_FIXABLE_FINDINGS.has(findingId)) {
    return res.status(400).json({
      error: "Ce constat ne peut pas être corrigé automatiquement en toute sécurité (il nécessiterait de recréer le conteneur, avec un risque réel de casser le service). Suivez la remédiation indiquée manuellement."
    });
  }

  const hostEntry = dockerHosts.get(hostName);
  if (!hostEntry) return res.status(404).json({ error: `Hôte '${hostName}' inconnu` });

  try {
    const containers = await hostEntry.client.listContainers({ all: false });
    const target = containers.find((c) => c.Names[0].replace('/', '') === containerName);
    if (!target) return res.status(404).json({ error: `Conteneur ${containerName} introuvable` });

    const container = hostEntry.client.getContainer(target.Id);
    // Limites par défaut raisonnables — l'utilisateur peut ensuite les
    // affiner depuis l'onglet Optimisation une fois l'usage réel observé.
    const DEFAULT_MEMORY = 512 * 1024 * 1024; // 512 MB
    const DEFAULT_NANO_CPUS = 500000000; // 0.5 CPU

    await container.update({ Memory: DEFAULT_MEMORY, NanoCpus: DEFAULT_NANO_CPUS });

    res.json({
      success: true,
      message: `Limites par défaut appliquées (512 MB / 0.5 CPU) sur '${containerName}'. Ajustez-les depuis l'onglet Optimisation selon l'usage réel observé.`
    });
  } catch (err) {
    res.status(500).json({ error: `Échec de la correction : ${err.message}` });
  }
});

// ---- Scan de vulnérabilités d'image (Trivy, à la demande) ----
const TRIVY_TIMEOUT_MS = 165000; // < 185s (nginx) pour laisser le temps de répondre proprement
const TRIVY_CACHE_TTL_MS = 60 * 60 * 1000; // 1h : une image ne change pas d'une minute à l'autre
const trivyCache = new Map(); // image -> { result, scannedAt }

app.post('/api/security/scan-image', async (req, res) => {
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

// ==================== PROMETHEUS METRICS ====================
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: METRICS_PREFIX });

const optimizationActions = new promClient.Counter({
  name: `${METRICS_PREFIX}optimization_actions_total`,
  help: 'Total optimization actions performed',
  labelNames: ['action', 'container', 'status'],
  registers: [register]
});

const resourceRecommendations = new promClient.Gauge({
  name: `${METRICS_PREFIX}recommendations_pending`,
  help: 'Number of pending optimization recommendations',
  labelNames: ['container', 'resource_type'],
  registers: [register]
});

const containerResourceUsage = new promClient.Gauge({
  name: `${METRICS_PREFIX}container_resource_percent`,
  help: 'Container resource usage percentage',
  labelNames: ['container', 'resource'],
  registers: [register]
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ==================== HELPERS DE CALCUL DE RESSOURCES ====================
//
// IMPORTANT : `docker stats` (et donc dockerode) ne renvoie pas un pourcentage
// CPU directement. Diviser le compteur cumulatif `cpu_usage.total_usage` par
// `system_cpu_usage` (comme dans la version précédente) donne une valeur quasi
// toujours proche de 0% ou incohérente, car ce sont des compteurs cumulés
// depuis le démarrage, pas une mesure instantanée.
//
// La formule correcte (identique à celle utilisée par `docker stats`) repose
// sur le DELTA entre l'échantillon courant et le précédent, fourni par Docker
// lui-même via `precpu_stats` lors d'un appel `stats({ stream: false })`.
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

// ==================== REPLI FIABLE (SANS PROMETHEUS) ====================
//
// Le tableau de bord ne doit jamais rester bloqué sur "--" si Prometheus est
// indisponible ou encore en train de démarrer. On calcule donc les métriques
// système directement depuis l'hôte (module `os` + `df`) en repli.
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

async function queryPrometheusInstant(query) {
  try {
    const { data } = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
      params: { query },
      timeout: 4000
    });
    const results = data?.data?.result || [];
    if (!results.length) return null;
    const values = results.map((r) => parseFloat(r.value[1])).filter((v) => !Number.isNaN(v));
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  } catch (e) {
    return null;
  }
}

// ==================== AUTO-DÉCOUVERTE DES SERVICES ====================
//
// Toute nouvelle application microservice démarrée sur cet hôte Docker (via
// `docker run` ou `docker compose up`) est automatiquement visible ici :
// aucune inscription manuelle n'est nécessaire, la plateforme interroge
// directement le socket Docker. On enrichit juste chaque conteneur avec :
//   - son "stack" d'appartenance (regroupement docker-compose si présent),
//   - un indicateur "isNew" pendant les 3 minutes suivant sa première
//     détection, pour signaler visuellement l'arrivée d'un nouveau service.
const NEW_SERVICE_WINDOW_MS = 3 * 60 * 1000;
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

// ==================== DOCKER API PROXY ====================

app.get('/api/containers', async (req, res) => {
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

app.get('/api/containers/:id', async (req, res) => {
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
function demuxDockerLogBuffer(buffer) {
  // Docker multiplexe stdout/stderr avec un en-tête de 8 octets par trame
  // (1 octet type de flux, 3 octets de bourrage, 4 octets = longueur) quand
  // le conteneur n'a PAS de TTY. Avec TTY, le flux est déjà du texte brut.
  let out = '';
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (length < 0 || end > buffer.length) return null; // ne ressemble pas au format multiplexé
    out += buffer.slice(start, end).toString('utf-8');
    offset = end;
  }
  return offset === buffer.length ? out : null;
}

app.get('/api/containers/:id/logs', async (req, res) => {
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

// ==================== PROMETHEUS QUERIES ====================

app.get('/api/metrics/containers', async (req, res) => {
  try {
    const duration = req.query.duration || '5m';

    const [cpuQuery, memQuery, netQuery] = await Promise.all([
      axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: `sum(rate(container_cpu_usage_seconds_total[${duration}])) by (name) * 100` }
      }).then(r => r.data).catch(() => ({ data: { result: [] } })),
      axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: `sum(container_memory_usage_bytes) by (name)` }
      }).then(r => r.data).catch(() => ({ data: { result: [] } })),
      axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: `sum(rate(container_network_receive_bytes_total[${duration}])) by (name)` }
      }).then(r => r.data).catch(() => ({ data: { result: [] } }))
    ]);

    res.json({ cpu: cpuQuery, memory: memQuery, network: netQuery });
  } catch (err) {
    res.status(500).json({ error: err.message, note: 'Prometheus may not be ready yet' });
  }
});

// ==================== MOTEUR D'OPTIMISATION ====================
//
// PROBLÈME CORRIGÉ : la version précédente décidait d'une recommandation sur
// UNE SEULE mesure instantanée. Un microservice normalement actif peut être
// mesuré à 5% de CPU simplement parce qu'il est interrogé entre deux
// requêtes — ce qui déclenchait une recommandation "réduire" en permanence,
// même quand ce n'était pas justifié. Ce n'est pas acceptable pour un usage
// en entreprise : les recommandations doivent refléter un comportement
// SOUTENU dans le temps, pas un instantané bruité.
//
// Solution : on conserve un historique glissant par conteneur (fenêtre de
// RECO_WINDOW_MS) et on ne se prononce que sur la moyenne de cette fenêtre,
// avec un nombre minimal d'échantillons avant de statuer.
const RECO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes d'historique
const RECO_MIN_SAMPLES = 4;           // ne pas juger un conteneur tout juste démarré

const resourceHistory = new Map(); // containerId -> [{ t, cpu, mem }]

// Après l'application d'une optimisation, le conteneur doit redémarrer pour
// que le changement prenne effet — le pénaliser à nouveau immédiatement
// (avec l'historique d'AVANT le changement) n'aurait aucun sens. On observe
// donc une période de grâce pendant laquelle ce type de recommandation ne
// réapparaît pas pour ce conteneur.
const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const recommendationCooldowns = new Map(); // "containerId:type" -> expiryTimestamp

// Les conteneurs de la plateforme elle-même (supervision, non métier) ne sont
// jamais optimisés automatiquement : DockerOpt sert à optimiser les
// microservices de l'entreprise, pas sa propre infrastructure de monitoring.
const PLATFORM_INFRA_CONTAINERS = new Set(
  (process.env.PLATFORM_INFRA_CONTAINERS ||
    'dockeropt-backend,dockeropt-frontend,dockeropt-prometheus,dockeropt-cadvisor,dockeropt-node-exporter'
  ).split(',').map(s => s.trim()).filter(Boolean)
);

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

// ---- Journal des détections d'optimisation (par conteneur) ----
//
// Une entrée est ajoutée uniquement lors de la TRANSITION vers un état
// signalé (pas à chaque cycle de 15s tant que la condition persiste), pour
// que le journal reste lisible : on y voit QUAND un problème est apparu et
// POURQUOI (valeur mesurée, seuil), pas un flot répétitif.
const OPTIMIZATION_LOG_MAX = 300;
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

app.get('/api/optimize/recommendations', async (req, res) => {
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

app.post('/api/optimize/apply', async (req, res) => {
  const { container: containerName, action, host: hostName = 'local' } = req.body;

  const hostEntry = dockerHosts.get(hostName);
  if (!hostEntry) {
    return res.status(404).json({ error: `Hôte '${hostName}' inconnu` });
  }
  const client = hostEntry.client;

  try {
    const containers = await client.listContainers({ all: false });
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
        updateConfig = { Memory: newMem };
        actionDescription = `Mémoire réduite à ${(newMem / 1024 / 1024).toFixed(0)} MB`;
        break;
      }
      case 'increase_memory': {
        const increasedMem = Math.floor((currentConfig.HostConfig.Memory || 268435456) * 1.5);
        updateConfig = { Memory: increasedMem };
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

app.get('/api/optimize/history', async (req, res) => {
  try {
    res.json(await listOptimizationHistory(100));
  } catch (err) {
    res.status(500).json({ error: `Historique indisponible : ${err.message}` });
  }
});

app.post('/api/optimize/history', async (req, res) => {
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
app.get('/api/optimize/logs', (req, res) => {
  const { container } = req.query;
  const filtered = container
    ? optimizationDetectionLog.filter((l) => l.container === container)
    : optimizationDetectionLog;
  res.json(filtered.slice(0, 100));
});

// ==================== ANALYSE DES PERFORMANCES ====================

app.get('/api/analysis/system', async (req, res) => {
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

// ==================== PRÉDICTION DE CHARGE ====================
// Régression linéaire simple sur l'historique réel exposé par Prometheus.
// Si l'historique est insuffisant, on le signale explicitement plutôt que de
// renvoyer des valeurs inventées.

app.get('/api/predict/resource/:containerName', async (req, res) => {
  const { containerName } = req.params;

  try {
    const container = docker.getContainer(containerName);
    await container.inspect();

    const cpuRange = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
      params: {
        query: `dockeropt_container_resource_percent{container="${containerName}",resource="cpu"}`,
        start: Math.floor(Date.now() / 1000) - 3600,
        end: Math.floor(Date.now() / 1000),
        step: 300
      },
      timeout: 4000
    }).then(r => r.data?.data?.result?.[0]?.values || []).catch(() => []);

    if (cpuRange.length < 3) {
      return res.json({
        container: containerName,
        generated_at: new Date().toISOString(),
        model: 'linear-regression-simple',
        available: false,
        message: "Historique insuffisant pour produire une prédiction fiable — laissez la plateforme tourner quelques minutes de plus."
      });
    }

    const points = cpuRange.map(([, v]) => parseFloat(v));
    const n = points.length;
    const xs = points.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = points.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((acc, x, i) => acc + (x - meanX) * (points[i] - meanY), 0)
      / (xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0) || 1);
    const intercept = meanY - slope * meanX;
    const project = (stepsAhead) => Math.max(0, Math.min(100, intercept + slope * (n - 1 + stepsAhead)));

    res.json({
      container: containerName,
      generated_at: new Date().toISOString(),
      model: 'linear-regression-simple',
      available: true,
      predictions: [{
        resource: 'cpu',
        current: { value: points[n - 1].toFixed(1), unit: '%' },
        predicted_1h: { value: project(12).toFixed(1), unit: '%' },
        trend: slope > 0.05 ? 'increasing' : slope < -0.05 ? 'decreasing' : 'stable'
      }]
    });
  } catch (err) {
    res.status(404).json({ error: 'Container not found' });
  }
});

// ==================== NOTIFICATIONS PAR EMAIL ====================
//
// Alerte l'administrateur par email dès qu'une situation CRITIQUE est
// détectée (optimisation urgente, faille de sécurité critique, conteneur
// arrêté) — sans avoir besoin de garder l'interface ouverte. Conçu pour
// ne jamais spammer : chaque alerte a une identité stable, un email n'est
// envoyé qu'à sa PREMIÈRE apparition, jamais renvoyé pour la même cause
// tant qu'elle persiste, et redevient éligible si elle réapparaît après
// avoir disparu (donc après correction puis récidive).
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM || 'DockerOpt <alerts@dockeropt.local>';
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || ADMIN_EMAIL;
const ALERT_CHECK_INTERVAL_MS = Number(process.env.ALERT_CHECK_INTERVAL_MS || 15000);
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:8080';

let mailer = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
  console.log(`[DockerOpt] Notifications email activées (${SMTP_HOST} → ${ALERT_EMAIL_TO})`);
} else {
  console.warn('[DockerOpt] SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASSWORD manquants) — notifications email désactivées.');
}

const notifiedAlertKeys = new Set();

function severityLabel(sev) {
  return sev === 'critical' ? 'CRITIQUE' : sev === 'warning' ? 'Avertissement' : 'Info';
}

async function sendAlertEmail(alerts) {
  if (!mailer || !alerts.length) return;

  const rows = alerts.map((a) =>
    `<tr>
       <td style="padding:6px 10px;color:${a.severity === 'critical' ? '#DC2626' : '#D97706'};font-weight:600;white-space:nowrap;">${severityLabel(a.severity)}</td>
       <td style="padding:6px 10px;">${a.title}</td>
       <td style="padding:6px 10px;color:#555;">${a.detail || ''}</td>
     </tr>`
  ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;">
      <h2 style="color:#111;">DockerOpt — Nouvelles alertes détectées</h2>
      <p style="color:#555;">${alerts.length} nouvelle${alerts.length > 1 ? 's' : ''} alerte${alerts.length > 1 ? 's' : ''} nécessite${alerts.length > 1 ? 'nt' : ''} votre attention.</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#F3F4F6;text-align:left;">
            <th style="padding:6px 10px;">Sévérité</th>
            <th style="padding:6px 10px;">Alerte</th>
            <th style="padding:6px 10px;">Détail</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:20px;">Envoyé automatiquement par DockerOpt — <a href="${PLATFORM_URL}">ouvrir la plateforme</a> pour voir la cause, les métriques et les recommandations.</p>
    </div>`;

  try {
    await mailer.sendMail({
      from: SMTP_FROM,
      to: ALERT_EMAIL_TO,
      subject: `[DockerOpt] ${alerts.length} nouvelle${alerts.length > 1 ? 's' : ''} alerte${alerts.length > 1 ? 's' : ''} détectée${alerts.length > 1 ? 's' : ''}`,
      html
    });
    console.log(`[DockerOpt] Email d'alerte envoyé (${alerts.length} alerte(s)) à ${ALERT_EMAIL_TO}`);
  } catch (err) {
    console.error('[DockerOpt] Échec de l\'envoi de l\'email d\'alerte :', err.message);
  }
}

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

if (mailer) {
  setInterval(checkAndNotify, ALERT_CHECK_INTERVAL_MS);
  // Premier passage peu après le démarrage (laisse le temps à Docker/Prometheus de répondre)
  setTimeout(checkAndNotify, 15000);
}

app.post('/api/notifications/test-email', async (req, res) => {
  if (!mailer) {
    return res.status(501).json({ error: 'SMTP non configuré — définissez SMTP_HOST, SMTP_USER et SMTP_PASSWORD.' });
  }
  try {
    await mailer.sendMail({
      from: SMTP_FROM,
      to: ALERT_EMAIL_TO,
      subject: '[DockerOpt] Email de test',
      html: '<p>Si vous recevez ce message, les notifications DockerOpt sont correctement configurées.</p>'
    });
    res.json({ success: true, message: `Email de test envoyé à ${ALERT_EMAIL_TO}` });
  } catch (err) {
    res.status(500).json({ error: `Échec de l'envoi : ${err.message}` });
  }
});

// ==================== SANTÉ DU SYSTÈME ====================

app.get('/health', (req, res) => {
  res.json({
    service: SERVICE_DISPLAY,
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    modules: { docker: true, prometheus: PROMETHEUS_URL }
  });
});

// ==================== DÉMARRAGE ====================

async function startServer() {
  try {
    await initDatabase();
    console.log('[DockerOpt] PostgreSQL connecté — compte administrateur synchronisé.');
  } catch (err) {
    console.error('[DockerOpt] PostgreSQL indisponible:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  DockerOpt Backend v1.0.0');
    console.log(`  Port: ${PORT}`);
    console.log(`  Prometheus: ${PROMETHEUS_URL}`);
    console.log('========================================');
  });

  let promReady = false;
  for (let i = 0; i < 12 && !promReady; i++) {
    try {
      await axios.get(`${PROMETHEUS_URL}/api/v1/status/config`);
      promReady = true;
      console.log('[DockerOpt] Prometheus connecté');
    } catch (e) {
      console.log(`[DockerOpt] Attente Prometheus... (${i + 1}/12)`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  if (!promReady) {
    console.warn('[DockerOpt] Prometheus non disponible au démarrage — les métriques restent indisponibles jusqu’à son rétablissement (aucune valeur synthétique).');
  }
}

startServer();
