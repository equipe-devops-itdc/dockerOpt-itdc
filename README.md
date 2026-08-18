# 🐳 DockerOpt - Optimisation des Ressources pour Architectures Microservices

## Description
Plateforme d'analyse, de surveillance et d'optimisation de l'utilisation des ressources système pour les applications microservices déployées sous Docker.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     🌐 DockerOpt Frontend                    │
│                   (Dashboard Web - Port 8080)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   ⚙️ DockerOpt Backend                       │
│              (API d'Optimisation - Port 5000)                │
└────┬──────────┬──────────┬──────────┬───────────────────────┘
     │          │          │          │
┌────▼──┐ ┌────▼──┐ ┌────▼──┐ ┌────▼────────────┐
│API    │ │User  │ │Product│ │Notification      │
│Gateway│ │Service│ │Service│ │Service           │
│:3000  │ │:3001  │ │:3002  │ │:3003             │
└───┬───┘ └───────┘ └───────┘ └──────────────────┘
    │
┌───▼──────────────────────────────────────────────────────────┐
│                    Monitoring Stack                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │Prometheus│  │cAdvisor  │  │Node      │                    │
│  │:9090     │  │:8081     │  │Exporter  │                    │
│  └──────────┘  └──────────┘  │:9100     │                    │
│                               └──────────┘                    │
└──────────────────────────────────────────────────────────────┘


                         GitHub
                            │
                            │ push main
                            ▼
                    GitHub Actions
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       Test Backend                Test Frontend
              │                           │
              ▼                           ▼
       Build Backend                Build Frontend
              │                           │
              ▼                           ▼
          GHCR image                   GHCR image
              │                           │
              ▼                           ▼
         Trivy Scan                  Trivy Scan
              │                           │
              └─────────────┬─────────────┘
                            │
                            ▼
                       SSH Deploy
                            │
                            ▼
                    Docker Standalone
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
            Backend :5000       Frontend :8080
                  │
                  ▼
              PostgreSQL
                  │
                  ▼
              Prometheus
                  │
                  ▼
              cAdvisor
                  │
                  ▼
             Docker Host
```

## Architecture Détaillée

### Microservices (Node.js/Express)
| Service | Rôle | Port |
|---------|------|------|
| **API Gateway** | Point d'entrée, routage des requêtes | 3000 |
| **User Service** | Gestion des utilisateurs | 3001 |
| **Product Service** | Catalogue produits | 3002 |
| **Notification Service** | Notifications (email/SMS) | 3003 |

### Monitoring Stack
| Service | Rôle | Port |
|---------|------|------|
| **Prometheus** | Collecte & stockage des métriques | 9090 |
| **cAdvisor** | Métriques Docker/containers | 8081 |
| **Node Exporter** | Métriques système hôte | 9100 |

### DockerOpt Platform
| Service | Rôle | Port |
|---------|------|------|
| **DockerOpt Backend** | API d'optimisation & analyse | 5000 |
| **DockerOpt Frontend** | Dashboard web interactif | 8080 |

## 🛠️ Fonctionnalités

### Supervision en Temps Réel
- Utilisation CPU par conteneur
- Mémoire RAM (usage, limite, %)
- Trafic réseau (Rx/Tx)
- Latence des requêtes HTTP
- État de santé des services

###  Optimisation Intelligente
- Analyse de l'efficacité des ressources
- Recommandations automatiques :
  -  Augmentation CPU/Mémoire si > 80%
  -  Réduction CPU/Mémoire si < 30%
- Application en un clic
- Prédictions de charge (H+1, H+6, H+24)

###  Alerting
- Seuils CPU élevés (warning > 80%, critical > 90%)
- Seuils mémoire élevés (warning > 80%, critical > 90%)
- Détection de services down
- Alertes de latence élevée

## Démarrage Rapide

### Prérequis
- Docker 24+ 
- Docker Compose v2+

### Installation & Lancement

```bash
# 1. Cloner / se placer dans le projet
cd dockeropt

# 2. Lancer toute l'infrastructure
docker-compose up -d --build

# 3. Vérifier que tout est opérationnel
docker-compose ps

# 4. Accéder aux interfaces
#    - Dashboard DockerOpt : http://localhost:8080
#    - Prometheus         : http://localhost:9090
```

### Lancer le générateur de charge (tests)

```bash
docker-compose --profile test up -d load-generator
```

### Arrêter l'infrastructure

```bash
docker-compose down
# Supprimer aussi les volumes de données
docker-compose down -v
```

## API Endpoints

### DockerOpt Backend (port 5000)
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Santé du service |
| `GET /metrics` | Métriques Prometheus |
| `GET /api/containers` | Liste des conteneurs avec stats |
| `GET /api/containers/:id` | Détails d'un conteneur |
| `GET /api/analysis/system` | Analyse système complète |
| `GET /api/optimize/recommendations` | Recommandations d'optimisation |
| `POST /api/optimize/apply` | Appliquer une optimisation |
| `GET /api/predict/resource/:name` | Prédictions de charge |

##  Accès aux Interfaces

| Interface | URL | Credentials |
|-----------|-----|-------------|
| DockerOpt Dashboard | http://localhost:8080 | admin@platform.local / change-me-in-production |
| Prometheus | http://localhost:9090 | - |
| cAdvisor | http://localhost:8081 | - |

**Avant toute mise en production**, changez `ADMIN_EMAIL`, `ADMIN_PASSWORD`
et `JWT_SECRET` dans `docker-compose.yml` (service `dockeropt-backend`) —
les valeurs par défaut ne sont là que pour démarrer rapidement en local.

## Notifications par email (optionnel)

Pour activer les alertes par email, renseignez ces variables dans
`docker-compose.yml` (service `dockeropt-backend`) :

```yaml
- SMTP_HOST=smtp.gmail.com
- SMTP_PORT=587
- SMTP_USER=votre-adresse@gmail.com
- SMTP_PASSWORD=un-mot-de-passe-d-application
- ALERT_EMAIL_TO=admin@platform.local
```

Sans `SMTP_HOST`, les notifications restent désactivées (aucune erreur,
juste un avertissement dans les logs). Testez la configuration avec :
```bash
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Authorization: Bearer <votre jeton>"
```

## Scénarios de Test

### 1. Test d'optimisation CPU
```bash
# Appliquer une augmentation des CPU
curl -X POST http://localhost:5000/api/optimize/apply \
  -H "Content-Type: application/json" \
  -d '{"container":"dockeropt-api-gateway","action":"increase_cpu"}'
```

### 2. Voir les recommandations
```bash
curl http://localhost:5000/api/optimize/recommendations | jq .
```

### 3. Générer du trafic
```bash
docker-compose --profile test up -d load-generator
```

##  Dépannage

### Prometheus n'est pas prêt
```bash
# Attendre 30-60s le temps que Prometheus initialise
docker-compose logs prometheus
```

### Les métriques ne s'affichent pas
```bash
# Vérifier les scrapes targets
curl http://localhost:9090/api/v1/targets
```

### Redémarrer un service spécifique
```bash
docker-compose restart dockeropt-backend
```

##  Structure du Projet

```
dockeropt/
├── docker-compose.yml           # Orchestration complète
├── README.md                    # Documentation
├── services/
│   ├── api-gateway/            # API Gateway
│   ├── user-service/           # Service Utilisateurs
│   ├── product-service/        # Service Produits
│   ├── notification-service/   # Service Notifications
│   └── load-generator/         # Générateur de charge (test)
├── dockeropt-platform/
│   ├── backend/                # API DockerOpt
│   └── frontend/               # Dashboard Web
├── prometheus/
│   ├── prometheus.yml          # Configuration Prometheus
│   └── alert.rules.yml         # Règles d'alerting
    ├── datasources/            # Sources de données
    └── dashboards/             # Dashboards pré-configurés
```

##  Licence
Projet académique - Master 2 Informatique

## Configuration sécurisée

Les variables Docker Compose sont centralisées dans `.env` (non versionné). PostgreSQL stocke le compte administrateur et l'historique d'optimisation. Les métriques affichées proviennent de Prometheus (node-exporter pour l'hôte et cAdvisor pour les conteneurs), sans valeurs simulées.

Lancement : `docker compose --env-file .env up -d --build`
