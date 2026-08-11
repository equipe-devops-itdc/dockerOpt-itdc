// ============================================================
// config.js — toutes les constantes et variables d'environnement
// regroupées ici pour que chaque module aille chercher la même
// source de vérité plutôt que de relire process.env partout.
// ============================================================

const PORT = process.env.PORT || 5000;
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
const SERVICE_DISPLAY = 'dockeropt-backend';
const METRICS_PREFIX = 'dockeropt_';

// ---- Authentification (compte admin unique) ----
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('[DockerOpt] ADMIN_EMAIL, ADMIN_PASSWORD et JWT_SECRET doivent être définis dans .env');
  process.exit(1);
}

// Routes accessibles sans jeton JWT (connexion elle-même + sondes techniques
// utilisées par les health checks et Prometheus).
const PUBLIC_PATHS = new Set(['/api/auth/login', '/health', '/metrics']);

// ---- Sécurité : scan Trivy ----
const TRIVY_TIMEOUT_MS = 165000; // < 185s (nginx) pour laisser le temps de répondre proprement
const TRIVY_CACHE_TTL_MS = 60 * 60 * 1000; // 1h : une image ne change pas d'une minute à l'autre

// ---- Auto-découverte des services ----
const NEW_SERVICE_WINDOW_MS = 3 * 60 * 1000;

// ---- Moteur d'optimisation ----
const RECO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes d'historique
const RECO_MIN_SAMPLES = 4;           // ne pas juger un conteneur tout juste démarré
const COOLDOWN_MS = 3 * 60 * 1000;    // 3 minutes de grâce après application
const OPTIMIZATION_LOG_MAX = 300;

// Conteneurs de la plateforme elle-même (supervision, non métier) — jamais
// optimisés automatiquement.
const PLATFORM_INFRA_CONTAINERS = new Set(
  (process.env.PLATFORM_INFRA_CONTAINERS ||
    'dockeropt-backend,dockeropt-frontend,dockeropt-prometheus,dockeropt-cadvisor,dockeropt-node-exporter'
  ).split(',').map(s => s.trim()).filter(Boolean)
);

// ---- Notifications par email ----
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM || 'DockerOpt <alerts@dockeropt.local>';
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || ADMIN_EMAIL;
const ALERT_CHECK_INTERVAL_MS = Number(process.env.ALERT_CHECK_INTERVAL_MS || 15000);
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:8080';

module.exports = {
  PORT, PROMETHEUS_URL, SERVICE_DISPLAY, METRICS_PREFIX,
  ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET, JWT_EXPIRES_IN, PUBLIC_PATHS,
  TRIVY_TIMEOUT_MS, TRIVY_CACHE_TTL_MS,
  NEW_SERVICE_WINDOW_MS,
  RECO_WINDOW_MS, RECO_MIN_SAMPLES, COOLDOWN_MS, OPTIMIZATION_LOG_MAX,
  PLATFORM_INFRA_CONTAINERS,
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM,
  ALERT_EMAIL_TO, ALERT_CHECK_INTERVAL_MS, PLATFORM_URL,
};