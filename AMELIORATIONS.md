# DockerOpt — Journal des améliorations

Ce document résume les corrections et améliorations apportées à la plateforme
par rapport à la version initiale, à intégrer dans le mémoire (partie mise en
œuvre / retour d'expérience).

## 1. Bug critique corrigé — calcul du CPU par conteneur

**Avant** : le backend calculait le CPU avec
`cpu_usage.total_usage / system_cpu_usage`, deux compteurs *cumulatifs* depuis
le démarrage. Le résultat était quasi toujours proche de 0 % ou incohérent,
ce qui expliquait que "les données CPU ne fonctionnent pas".

**Après** : calcul par delta entre deux échantillons (`cpu_stats` et
`precpu_stats`), la même formule que celle utilisée en interne par
`docker stats` :

```
cpuPercent = (cpuDelta / systemDelta) * nombreDeCPU * 100
```

Fichier : `dockeropt-platform/backend/server.js`, fonction `computeCpuPercent`.

## 2. Fiabilité des métriques système (CPU / RAM / Disque)

**Avant** : ces trois cartes dépendaient uniquement de requêtes Prometheus.
Si `node-exporter` ou Prometheus n'étaient pas encore prêts (ou
indisponibles), l'API renvoyait un tableau vide et l'interface restait
bloquée sur `--`.

**Après** : l'endpoint `/api/analysis/system` tente d'abord Prometheus, puis
**bascule automatiquement** sur un calcul natif via le module Node `os`
(CPU, mémoire) et la commande `df` (disque) si Prometheus ne répond pas. La
réponse indique la source utilisée (`source: { cpu, memory, disk }`) pour
rester traçable. Le tableau de bord affiche donc toujours une valeur fiable.

## 3. Données réseau réelles au lieu de valeurs aléatoires

**Avant** : le graphique réseau du dashboard affichait des valeurs générées
par `Math.random()` — trompeur pour une démonstration devant un jury.

**Après** : le backend expose désormais les compteurs réseau réels
(`rx_bytes` / `tx_bytes`) par conteneur ; le frontend calcule un débit réel
(Ko/s) à partir de l'historique des relevés successifs, sans donnée
fabriquée. Idem pour le graphique de latence, retiré car il n'était basé sur
rien de mesurable ; remplacé par un radar d'efficacité calculé à partir de la
marge mémoire réelle de chaque conteneur.

## 4. Prédiction de charge honnête

**Avant** : `/api/predict/resource/:name` renvoyait des valeurs codées en dur
("45 %", "52 %"…) quel que soit le conteneur.

**Après** : régression linéaire simple calculée sur l'historique réel exposé
par Prometheus (`dockeropt_container_resource_percent`). Si l'historique est
trop court, l'API le signale explicitement (`available: false`) plutôt que
d'inventer une valeur.

## 5. Interface refaite en React

L'interface HTML/JS/Chart.js statique a été remplacée par une application
React (Vite + Tailwind CSS + Recharts + icônes `lucide-react`), avec :

- une navigation latérale claire (Dashboard, Conteneurs, Optimisation, Alertes)
  au lieu d'onglets peu lisibles ;
- des icônes vectorielles cohérentes à la place des émojis ;
- des jauges circulaires ("resource rings") pour CPU/RAM/Disque avec code
  couleur de seuil (vert/orange/rouge) ;
- une bande de pression système dans l'en-tête, résumant la charge récente
  d'un coup d'œil ;
- une gestion d'erreurs explicite par section (un service en panne
  n'empêche plus le reste du tableau de bord de s'afficher) ;
- une vue Alertes qui reflète l'état réel des conteneurs et recommandations,
  au lieu d'un message statique "tout va bien" codé en dur ;
- un état de chargement, une notification de confirmation/erreur lors de
  l'application d'une optimisation, et un rafraîchissement automatique
  toutes les 15 secondes.

## 6. Structure du projet

```
dockeropt-platform/frontend/   → application React (Vite)
  src/components/              → composants d'interface
  src/components/charts/       → graphiques Recharts
  src/hooks/                   → récupération et historisation des données
  src/lib/                     → client API, formatage
```

Le `docker-compose.yml`, la stack Prometheus/Grafana/cAdvisor et les
microservices métier (api-gateway, user/product/notification-service)
n'ont pas été modifiés — seule l'intégration `frontend` + `backend` de la
plateforme DockerOpt a été revue.

## 7. Déploiement réel de nouveaux microservices depuis l'interface

Le panneau "Connecter un service" contient désormais un vrai formulaire :
vous collez un extrait `docker-compose` (comme celui utilisé en exemple),
cliquez sur **Déployer**, et le backend crée et démarre réellement le
conteneur via l'API Docker (`dockerode`) — aucune simulation.

- Fonctionne pour tout service référençant une image déjà construite
  (`image: ...`), y compris avec pull automatique depuis le registre si
  l'image n'est pas encore présente localement.
- Un service utilisant `build: ...` (code source, pas d'image prête) est
  détecté et un message clair l'explique : il faut le déployer manuellement
  (CI/CD ou `docker compose up` depuis l'hôte) — DockerOpt le détecte alors
  automatiquement dès qu'il tourne, comme n'importe quel conteneur.
- Le conteneur déployé rejoint `dockeropt-network` par défaut et apparaît
  dans "Conteneurs" / "Services" dès le rafraîchissement suivant.
- Le nom du réseau Docker (`dockeropt-network`) est maintenant figé dans
  `docker-compose.yml` (`name: dockeropt-network`) pour que les références
  `external: true` fonctionnent de façon fiable, quel que soit le nom du
  dossier du projet.

## 8. Recommandations d'optimisation : disparition réelle après application

**Avant** : après avoir cliqué "Appliquer", la recommandation pouvait rester
affichée (ou réapparaître) car le prochain calcul se basait encore sur
l'historique d'avant le changement.

**Après** :
- Application optimiste côté interface : l'élément disparaît immédiatement
  de la liste au clic.
- Côté backend : l'historique glissant du conteneur concerné est réinitialisé
  et une période de grâce de 3 minutes est ouverte pour ce type de
  recommandation (CPU ou mémoire), le temps que le redémarrage du conteneur
  et une nouvelle fenêtre d'observation confirment l'effet réel du
  changement — la recommandation ne revient que si le besoin est toujours là.

## 9. Visualiser les conteneurs d'une AUTRE application microservices déjà déployée

Nouvel onglet **Hôtes**, pour le cas où l'entreprise a une application
microservices distincte, déjà développée et tournant sur un autre serveur
Docker :

- Formulaire de connexion (nom, adresse, port, certificats TLS ou connexion
  non chiffrée assumée explicitement) qui **teste réellement la connexion**
  avant de l'enregistrer (aucun hôte injoignable n'est sauvegardé).
- Une fois connecté, **tous ses conteneurs apparaissent automatiquement**
  dans Dashboard / Services / Conteneurs / Optimisation / Alertes, exactement
  comme ceux de l'hôte local — agrégation transparente, sans rien modifier à
  l'application existante.
- Fiabilité : un hôte distant injoignable au moment d'un rafraîchissement ne
  fait jamais échouer le reste de la plateforme (isolation par hôte via
  `Promise.allSettled`) ; son statut passe simplement à "Hors ligne" dans
  l'onglet Hôtes.
- La configuration des hôtes connectés est persistée (volume Docker dédié)
  et rechargée automatiquement au redémarrage du backend.
- Le montage du socket Docker du backend est passé de lecture seule (`:ro`)
  à lecture-écriture dans `docker-compose.yml` : les fonctionnalités
  d'optimisation et de déploiement de services ont besoin d'écrire sur le
  socket (créer/modifier/supprimer des conteneurs), ce qu'un montage en
  lecture seule pouvait empêcher de façon incohérente selon l'environnement.

## 10. Correction du bug "la recommandation reste dans la liste après Appliquer"

Cause exacte trouvée : le moteur de recommandations et l'endpoint
d'application du correctif utilisaient deux clés d'historique légèrement
différentes en interne — la période de grâce ne ciblait donc pas
toujours le bon conteneur, et l'élément pouvait réapparaître. Corrections :

- Les deux endpoints utilisent maintenant exactement la même clé
  (`hôte:idConteneur`).
- Le masquage optimiste côté interface ne s'active plus que si le backend
  confirme un **succès réel** (avant, une application échouée pouvait quand
  même faire disparaître l'élément — trompeur).
- La durée de masquage local est alignée sur la fenêtre de grâce du backend
  (3 minutes) au lieu d'une estimation arbitraire de 20 secondes.

## 11. cAdvisor conservé — clarification de son rôle réel

**Pourquoi la plateforme continue de fonctionner même en arrêtant cAdvisor ?**
Parce que cAdvisor n'est en réalité jamais la source des données affichées
dans DockerOpt (Dashboard, Conteneurs, Optimisation, Alertes). Ces vues lisent
les métriques CPU/RAM/réseau **directement depuis l'API du moteur Docker**
via le backend (`dockerode` → `container.stats()`), exactement comme le fait
la commande `docker stats`. cAdvisor alimente uniquement Prometheus/Grafana
pour le tableau de bord de supervision secondaire (`grafana/dashboards/`) —
le couper n'a donc aucun effet sur l'interface principale de DockerOpt.
C'est un comportement normal, pas un dysfonctionnement.

**Correction conservée indépendamment de ce choix** : la règle d'alerte CPU
dans `prometheus/alert.rules.yml` utilisait `node_cpu_seconds_total`, une
métrique de l'HÔTE (node-exporter) sans label `container` — elle ne pouvait
donc jamais correspondre à un conteneur précis. Elle utilise maintenant la
véritable métrique cAdvisor par conteneur
(`container_cpu_usage_seconds_total`).

## 12. Mode clair / sombre et barre latérale réductible

- Un bouton (icône soleil/lune) dans la barre supérieure bascule entre mode
  sombre (par défaut) et mode clair. Le choix est mémorisé
  (`localStorage`) et respecte la préférence système au premier lancement.
  Techniquement, les couleurs de surface/texte sont pilotées par des
  variables CSS (`--ink-*`, `--text-*`) redéfinies selon le thème actif —
  aucune classe n'a dû être dupliquée dans les composants. Les graphiques
  (Recharts, qui exigent des couleurs littérales) suivent le thème via un
  contexte React dédié (`ThemeProvider` / `useTheme`).
- Sur grand écran, un bouton dans la barre supérieure réduit la barre
  latérale à une colonne d'icônes (72px) pour gagner de l'espace, avec les
  info-bulles au survol pour retrouver le libellé de chaque section. L'état
  réduit/déployé est mémorisé (`localStorage`) et persiste d'une session à
  l'autre. Sur mobile/tablette, la barre latérale reste un tiroir complet
  (aucun intérêt à la réduire sur petit écran).

## 13. Sécurisation des conteneurs — nouvel onglet Sécurité

Deux volets distincts, pour rester à la fois complet et fiable :

- **Audit de configuration** (toujours actif, instantané, zéro dépendance
  externe) : chaque conteneur actif est analysé directement via les données
  déjà renvoyées par l'API Docker (`inspect`), sans outil tiers. Détecte :
  mode privilégié, socket Docker monté dans le conteneur, réseau/PID/IPC de
  l'hôte partagé, capacités Linux additionnelles, seccomp/AppArmor
  désactivé, exécution en root, absence de limites CPU/mémoire, image sans
  tag figé (`:latest`), système de fichiers racine modifiable, port publié
  sur toutes les interfaces. Chaque conteneur reçoit un score /100 et une
  liste de constats avec remédiation concrète.
- **Scan de vulnérabilités d'image** (Trivy, à la demande uniquement) :
  bouton "Scanner" par conteneur, résultats mis en cache 1h (le scan est
  plus lent, on évite de le relancer inutilement). Si Trivy n'est pas
  disponible (réseau, installation), l'audit de configuration reste
  pleinement fonctionnel — dégradation propre, pas de plantage.
- Les constats critiques/avertissements remontent aussi automatiquement
  dans l'onglet Alertes, aux côtés des alertes d'optimisation.
- Volontairement **exclu du rafraîchissement rapide (15s)** : l'audit
  inspecte chaque conteneur individuellement, plus coûteux que les autres
  vues ; il se charge à l'ouverture de l'onglet, avec un bouton de
  rafraîchissement manuel.

## 14. Mode clair affiné — palette "slate" professionnelle

La première version du mode clair utilisait une palette de gris ad-hoc peu
travaillée. Remplacée par une échelle slate cohérente (mêmes valeurs que
Tailwind Slate, éprouvées pour la lisibilité) :
- Corps de page légèrement teinté (slate-50), cartes blanches distinguées
  par une **ombre douce en plusieurs couches** plutôt qu'une différence de
  couleur — c'est ce qui donne un rendu "propre" aux interfaces comme
  Linear ou Vercel en mode clair, au lieu d'un simple gris plat.
  Techniquement : `--panel-shadow` devient une variable CSS par thème
  (ombre dense en sombre, ombre douce multi-couche en clair) au lieu d'un
  seul jeu de valeurs figé.
- Texte principal quasi noir (slate-900) pour un contraste net, texte
  secondaire/tertiaire calés sur slate-600/500 pour rester lisibles sans
  être criards.
- Graphiques (Recharts) et bande de pression système alignés sur la même
  échelle de gris pour ne plus détonner du reste de l'interface une fois
  le thème basculé.

## 15. Correctif critique — plantage à l'ouverture de l'onglet Sécurité

**Cause exacte** (retrouvée en rejouant le montage complet de l'application) :
juste après un clic sur "Sécurité", il existe un court instant où l'audit
n'est pas encore chargé (`audit = null`) mais où l'indicateur de chargement
n'est pas encore passé à `true` non plus (l'effet qui déclenche le
chargement ne s'exécute qu'après ce premier rendu). La vue essayait alors
d'afficher directement les cartes de score, et la carte "Score moyen" — qui
n'a pas d'icône de secours puisqu'elle affiche normalement un anneau —
tentait de rendre une icône `undefined`, provoquant le plantage React
("Element type is invalid... but got: undefined").

**Corrections apportées :**
- `SecurityView` affiche désormais son état de chargement dès que l'audit
  est manquant (`!audit`), plus seulement quand `loading` est explicitement
  vrai — élimine l'instant de rendu incohérent.
- `StatCard` a été blindé : si ni anneau ni icône ne sont fournis, il
  affiche un simple pastillage neutre plutôt que de planter — un filet de
  sécurité pour éviter qu'un bug similaire ne casse toute la page à l'avenir.

## 16. Identité visuelle — blanc & orange en clair, "console cybersécurité" en sombre

- **Mode clair** : l'accent principal (boutons, statut actif, anneaux
  "sain") passe du cyan à un **orange** (`#EA580C`), sur fond blanc/gris
  très clair. Piloté par une nouvelle variable CSS `--accent`, partagée par
  toute l'application (classes Tailwind `signal-accent` + un petit
  utilitaire `getAccentHex(theme)` pour les rares éléments SVG/Recharts qui
  n'acceptent pas les classes CSS).
- **Mode sombre** : identité "console de cybersécurité" — accent cyan/bleu
  conservé, avec un **arrière-plan animé subtil** : grille technique en
  lente dérive diagonale + deux lueurs bleu/cyan qui pulsent doucement.
  Entièrement en CSS (`background-position` et `transform`/`opacity`
  uniquement — accéléré matériellement), donc sans coût de performance ;
  désactivé automatiquement en mode clair et pour les utilisateurs ayant
  activé "mouvement réduit" dans leur système.

## 17. Retrait des fonctionnalités "Connecter un service" et "Connecter un hôte"

Les deux fonctionnalités (déploiement de service depuis un extrait
docker-compose, et connexion à un serveur Docker distant) ont été retirées
à la demande, côté interface **et** backend, pour ne pas laisser de code
mort :
- Suppression des panneaux et boutons associés (`ConnectServicePanel`,
  `HostsView`, entrées de la barre latérale).
- Suppression des endpoints `/api/services/deploy`, `/api/services/undeploy`,
  `/api/hosts` (GET/POST/DELETE) et de la dépendance `js-yaml` devenue
  inutile.
- Le socket Docker reste monté en lecture-écriture (toujours nécessaire
  pour l'application des optimisations), mais le volume de persistance
  dédié aux hôtes distants a été retiré de `docker-compose.yml`.
- L'abstraction interne "client par hôte" est conservée à l'identique en
  interne (elle simplifie le code des autres endpoints), simplement plus
  aucune interface ne permet d'y ajouter un hôte — un seul, l'hôte local,
  existe désormais.

## 18. Nouvelle identité visuelle — cybersécurité, dans les deux thèmes

- **Mode clair** : l'accent passe à un **vert émeraude** (`#059669`) plutôt
  que l'orange précédent — plus proche du vocabulaire visuel de la
  sécurité (validé/sain), sur un fond blanc/gris très clair.
- **Mode sombre** : cyan électrique conservé sur fond noir profond.
- **Animation d'arrière-plan désormais active dans les deux thèmes** (elle
  n'existait qu'en sombre auparavant) : grille technique en lente dérive
  diagonale + deux lueurs bleu/vert qui pulsent doucement. Intensité
  fortement réduite en mode clair pour rester discrète sur fond blanc.
  Entièrement en CSS (`background-position` et `transform`/`opacity`
  uniquement, accéléré matériellement) — aucun coût de performance ;
  désactivée automatiquement pour les utilisateurs ayant réduit les
  animations dans leur système.
- Un nouveau composant partagé `PageHeader` (titre + description, et une
  zone d'action optionnelle à droite) a été appliqué à toutes les pages
  (Tableau de bord, Services, Conteneurs, Optimisation, Sécurité, Alertes)
  pour une mise en page cohérente et une meilleure lisibilité d'ensemble.

## 19. Globe filaire animé et palette sombre affinée

- Ajout d'un **globe filaire en rotation 3D** (`WireframeGlobe`), entièrement
  en CSS (`transform-style: preserve-3d` + rotation continue des méridiens/
  parallèles, aucune image ni WebGL) — cohérent avec le thème cybersécurité
  de la plateforme plutôt qu'une photo de Terre. Quelques "nœuds" lumineux
  pulsent à sa surface, évoquant des points d'infrastructure supervisés.
  Placé dans un nouveau panneau "vitre" décoré (`panel-glow` : bordure
  lumineuse dégradée, fond très transparent, halo flouté) en tête du
  Tableau de bord.
- Léger champ d'étoiles ajouté à l'arrière-plan animé (mode sombre
  uniquement), en complément de la grille technique déjà en place.
- Palette sombre affinée : glissée d'un noir-bleu pur vers une teinte
  **ardoise/sarcelle profonde**, plus proche des interfaces admin
  premium (fond légèrement teinté plutôt que noir absolu).
- `StatCard` repensé : gros chiffre en avant, icône discrète en coin, fine
  barre de progression en dégradé sous la valeur (colorée selon le niveau
  — vert/ambre/rouge) au lieu d'un anneau circulaire, pour un rendu plus
  proche des tableaux de bord admin modernes tout en gardant le code
  couleur par seuil.

## 20. Compte administrateur — authentification réelle

La plateforme est désormais protégée par un compte admin unique (accès
interne, pas de gestion multi-utilisateurs) :

- **Backend** : connexion (`POST /api/auth/login`) avec identifiants
  définis en variables d'environnement (`ADMIN_EMAIL`, `ADMIN_PASSWORD`),
  mot de passe comparé via `bcryptjs` (jamais stocké ni comparé en clair),
  session par jeton JWT (24h, `JWT_SECRET`). Toutes les routes `/api/*`
  exigent désormais ce jeton — seuls `/api/auth/login`, `/health` et
  `/metrics` restent publics (sondes de santé et Prometheus n'envoient pas
  de jeton).
- **Frontend** : page de connexion, session persistée (revalidée auprès du
  backend à chaque chargement, pas seulement supposée valide), et
  déconnexion automatique si le jeton expire ou devient invalide (toute
  réponse 401 renvoie à l'écran de connexion). Le chargement des données
  (conteneurs, système, optimisation...) ne démarre qu'une fois la session
  confirmée — aucun appel n'est fait tant que l'utilisateur n'est pas
  authentifié.
- Identifiants par défaut en local : `admin@platform.local` /
  `dockeropt-admin` — **à changer avant toute mise en production** (voir
  `docker-compose.yml`, service `dockeropt-backend`).

## 21. Barre supérieure et latérale enrichies

- Nouvelle **barre de recherche rapide** dans la barre supérieure : filtre
  les conteneurs par nom en direct, résultats cliquables qui ouvrent
  l'onglet Conteneurs.
- **Cloche de notifications** avec badge (nombre d'alertes actives) —
  ouvre directement l'onglet Alertes.
- **Menu du compte** (avatar + email) avec option de déconnexion.
- Logo de la barre latérale remplacé par un bouclier, et badge "Sécurisé —
  Connexion chiffrée" ajouté en pied de barre latérale.

## 22. Transparence et animation 3D repensées

- Remplacement du globe filaire par une **animation 3D différente** de
  même inspiration cybersécurité : un "noyau" central avec plusieurs
  anneaux orbitaux inclinés, chacun tournant indépendamment à sa propre
  vitesse (façon système de données distribué), avec des satellites
  lumineux. Toujours 100% CSS (`transform-style: preserve-3d` +
  animations `transform`/`opacity`), donc léger.
- Cette animation est désormais un **arrière-plan global** (derrière toute
  l'application, pas confinée à un panneau) — visible en filigrane sous
  l'interface plutôt que dans un encart dédié.
- **Transparence augmentée dans les deux thèmes** : panneaux, barre
  latérale et barre supérieure sont plus translucides (flou renforcé,
  opacité réduite), pour bien laisser transparaître l'animation en
  arrière-plan sans sacrifier la lisibilité.

## 23. Rapprochement avec la maquette de référence (SecOps)

- **Cartes de statistiques** : ajout de vrais mini-graphiques (sparklines)
  sous chaque valeur — construits à partir de l'historique réellement
  collecté à chaque rafraîchissement (CPU, mémoire, disque, débit réseau),
  jamais de données inventées. Repli sur la fine barre de progression
  existante pour les stats sans historique disponible (ex: nombre de
  conteneurs).
- **Nouveau donut "Répartition des conteneurs"** sur le tableau de bord :
  regroupe les conteneurs par statut réel (Running / Stopped / Pending /
  Error, mappé depuis les états Docker `running`/`exited`/
  `created,restarting,paused`/`dead`), avec total au centre et légende
  chiffrée — remplace un graphique générique par une vue directement
  utile.
- **En-tête du tableau de bord** agrandi ("Supervision et Optimisation des
  Ressources") pour un effet plus affirmé, dans l'esprit de la maquette.
- **Bascule de thème en pilule** (soleil / lune côte à côte, l'actif
  surligné) au lieu d'un simple bouton.
- **Barre latérale regroupée** par sections ("Principal" / "Surveillance")
  avec libellés — uniquement une organisation visuelle des pages
  existantes, sans lien fictif vers des pages qui n'existent pas.

## 24. Trois correctifs de fiabilité et d'ergonomie

- **Bouton "Actualiser" retiré** de la barre supérieure — le
  rafraîchissement automatique (toutes les 15s) suffit, le bouton manuel
  faisait doublon.
- **Badge de notifications enfin cohérent** : il ne comptait auparavant que
  le nombre total d'alertes, qui restait affiché même après consultation
  de l'onglet Alertes. Chaque alerte a maintenant une identité stable
  (sévérité + titre) ; dès que l'utilisateur ouvre l'onglet Alertes, les
  alertes actuellement affichées sont marquées comme vues et le badge
  disparaît — mais réapparaît immédiatement si une **nouvelle** alerte
  survient entre-temps, même si d'anciennes ont déjà été vues.
- **Scan Trivy corrigé** : le message "Trivy n'est pas installé" venait
  d'une incompatibilité de fond — le script d'installation officiel
  d'Aqua Security télécharge un binaire lié à `glibc`, qui ne peut pas
  s'exécuter sur l'image de base `node:20-alpine` (bibliothèque `musl`).
  L'installation échouait donc silencieusement à chaque build, sans
  erreur visible. Remplacé par `apk add trivy`, qui installe un binaire
  compilé nativement pour Alpine/musl depuis le dépôt "community" —
  compatible par construction, plus simple, et plus rapide à builder
  (plus de téléchargement ni de script tiers).
  ⚠️ Après cette mise à jour, reconstruisez l'image avec
  `docker compose build --no-cache dockeropt-backend` pour forcer la
  réinstallation (un cache Docker de l'ancienne étape échouée pourrait
  sinon être réutilisé).

## 25. Badge de notifications : persistance après rechargement de page

Le badge revenait après un rechargement (F5) même pour des alertes déjà
consultées : l'état "vu" n'était gardé qu'en mémoire (React state), donc
perdu à chaque rechargement complet de la page. Il est maintenant persisté
dans `localStorage` — une alerte marquée comme vue le reste après un F5,
et ne réapparaît dans le badge que si une **nouvelle** alerte survient
(les clés obsolètes sont purgées automatiquement pour ne pas accumuler
indéfiniment).

## 26. Listes Alertes et Recommandations — design épuré

Remplacement des cartes encadrées (une bordure colorée par élément) par
une **liste unique à lignes séparées** (fines séparations, pas de boîte
par élément) : icône ronde par sévérité, contenu, et action à droite —
un rendu plus propre et plus dense, avec un léger surlignage au survol.
Appliqué à la fois à la liste d'alertes et à la liste de recommandations
d'optimisation.

## 27. Trivy — changement de base d'image (Alpine → Debian)

Deux tentatives précédentes (script officiel, puis `apk add trivy`) ont
échoué sur l'image `node:20-alpine`. Plutôt que de continuer à deviner,
changement d'approche à la racine : le backend tourne maintenant sur
`node:20-bookworm-slim` (Debian, glibc native), avec Trivy installé depuis
son **dépôt APT officiel** (méthode la plus fiable et documentée par
l'éditeur). Le binaire `docker` (CLI) n'a jamais été nécessaire — le
backend parle directement au socket Docker via `dockerode` — donc ce
changement de base n'affecte aucune autre fonctionnalité.

Cette fois, l'installation n'échoue plus silencieusement : si `apt-get
install trivy` échoue, **le build entier échoue** (au lieu d'un message
d'erreur découvert seulement en cliquant "Scanner" dans l'interface) —
pour qu'un vrai problème soit visible immédiatement dans les logs de build
plutôt que de rester caché.

Au passage, la fonction de calcul de l'espace disque (repli sans
Prometheus) ne dépend plus des utilitaires `df`/`awk`/`tr` (potentiellement
absents ou différents selon l'image de base) : réécrite avec l'API native
`fs.statfsSync` de Node.js — plus robuste, plus rapide (pas de sous-processus),
et portable quelle que soit l'image de base utilisée.

**Pour appliquer ce correctif :**
```bash
docker compose build --no-cache dockeropt-backend
docker compose up -d
```

## 28. Audit de sécurité — constats enrichis avec des données réelles

Certains messages de l'audit de configuration paraissaient génériques
(le même texte pour chaque conteneur). Ce n'était pas un défaut de
fonctionnement — chaque conteneur est bien inspecté individuellement et
peut recevoir des constats différents — mais le texte ne le montrait pas
toujours assez clairement. Plusieurs constats affichent désormais une
valeur concrète propre au conteneur inspecté :
- Image sans tag figé → affiche l'image exacte utilisée
- Port exposé sur toutes les interfaces → affiche le port précis concerné
- Utilisateur root → affiche la valeur exacte du champ `User` de l'image

## 29. Erreur 504 lors du scan de vulnérabilités

Le proxy nginx coupait la connexion au bout de 60 secondes
(`proxy_read_timeout`), avant même que le backend n'ait eu le temps de
répondre — un scan Trivy peut légitimement dépasser cette durée, surtout
au premier lancement (téléchargement de sa base de données). Délais
harmonisés en cascade sur toute la chaîne, chaque couche laissant à la
précédente le temps de répondre proprement :
`trivy --timeout 150s` → backend (165s) → nginx (185s) → frontend (190s).

**Pour appliquer :**
```bash
docker compose build --no-cache dockeropt-frontend dockeropt-backend
docker compose up -d
```

## 30. Conteneurs arrêtés : rester visibles avec leur statut

Un conteneur arrêté n'a jamais disparu de la liste "Conteneurs" côté
backend (`listContainers({ all: true })` inclut déjà tout), mais il
disparaissait bel et bien de plusieurs endroits où il n'y avait pas
d'alternative visuelle :
- **Services** : la ligne d'un conteneur arrêté n'affichait qu'un point
  rouge, sans texte — remplacé par un libellé explicite "Arrêté".
- **Tableau de bord** : un conteneur arrêté sort logiquement des
  graphiques d'usage CPU/mémoire (rien à mesurer), mais ne réapparaissait
  nulle part ailleurs sur la page. Ajout d'une liste dédiée "Conteneurs
  arrêtés" en bas du tableau de bord — nom + statut, uniquement visible
  s'il y en a au moins un.

## 31. Suppression de Grafana

Retiré du `docker-compose.yml` (service, volume, dossier `grafana/`) et de
toute la documentation — DockerOpt fournit déjà ses propres tableaux de
bord ; Grafana était redondant. Prometheus reste en place (le backend s'en
sert directement pour les métriques système).

## 32. Notifications par email

Le backend surveille désormais en continu (toutes les 60s, configurable)
trois sources : conteneurs arrêtés, recommandations d'optimisation
critiques, failles de sécurité critiques. Dès qu'une situation critique
**nouvelle** apparaît, un email récapitulatif est envoyé à l'administrateur
— jamais renvoyé pour la même cause tant qu'elle persiste (évite le spam),
mais redevient éligible si elle réapparaît après résolution.

- Configuration via variables d'environnement dans `docker-compose.yml`
  (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
  `ALERT_EMAIL_TO`) — désactivé proprement (log d'avertissement, aucune
  erreur) si `SMTP_HOST` n'est pas renseigné.
- Endpoint `POST /api/notifications/test-email` pour vérifier la
  configuration SMTP sans attendre une vraie alerte.

## 33. Journaux par conteneur — panne et causes d'optimisation

Nouveau bouton "Logs" sur chaque conteneur (page Conteneurs), ouvrant une
fenêtre à deux onglets :
- **Journal du conteneur** : les vraies sorties `stdout`/`stderr` du
  conteneur (équivalent `docker logs`), utile pour diagnostiquer une panne
  directement depuis la plateforme.
- **Détections d'optimisation** : un journal horodaté de chaque fois où le
  moteur d'optimisation a détecté un problème pour CE conteneur, avec la
  cause précise (valeur mesurée) et la suggestion — construit à partir
  d'un nouveau journal serveur qui n'enregistre une entrée qu'à
  l'apparition d'un problème (pas à chaque cycle de 15s), pour rester
  lisible.

## 34. Sécurité renforcée : nouveaux contrôles + correction automatique sûre

Deux contrôles supplémentaires dans l'audit de configuration :
- **Absence de HEALTHCHECK** — Docker ne peut pas détecter un service
  bloqué sans lui.
- **Secret potentiellement en clair** — détecte les variables
  d'environnement du type `*_PASSWORD`, `*_SECRET`, `*_TOKEN`, `*_API_KEY`
  avec une vraie valeur (pas un placeholder), et liste les variables
  concernées.

**Correction automatique — volontairement limitée à ce qui est sûr.**
La plupart des constats (mode privilégié, root, capacités Linux,
filesystem en écriture...) exigeraient de recréer le conteneur avec une
configuration différente : le faire automatiquement sans connaître les
besoins réels de l'application pourrait casser le service en production.
Seul le constat "aucune limite de ressources" est corrigé automatiquement
(un bouton "Corriger automatiquement" apparaît uniquement pour celui-ci) —
l'API Docker permet de fixer des limites sur un conteneur déjà en marche,
sans redémarrage, donc sans risque de casse. Pour tous les autres
constats, la remédiation reste manuelle et délibérée, avec des
instructions précises déjà fournies par l'audit.

## Pour lancer en local (développement)

```bash
cd dockeropt-platform/frontend
npm install
npm run dev        # proxy /api vers http://localhost:5000 par défaut
```

## Pour lancer en production (Docker)

```bash
docker compose up -d --build
```
