// ============================================================
// security/checks.js — SÉCURITÉ DES CONTENEURS : audit de config
// ------------------------------------------------------------
// Audit de CONFIGURATION (toujours actif, instantané, zéro
// dépendance externe) : analyse directement les données déjà
// renvoyées par l'API Docker (`inspect`) pour détecter les réglages
// à risque (privileged, socket Docker monté, exécution en root,
// capacités élargies, etc.). Fiable à 100% car il ne dépend d'aucun
// outil tiers ni d'accès réseau.
// ============================================================

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

const AUTO_FIXABLE_FINDINGS = new Set(['no-resource-limits']);

module.exports = { SECURITY_CHECKS, SEVERITY_WEIGHT, auditContainerSecurity, AUTO_FIXABLE_FINDINGS };