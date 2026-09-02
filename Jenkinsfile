def createEnvFile() {
    withCredentials([
        string(credentialsId: 'POSTGRES_HOST_ID', variable: 'CRED_POSTGRES_HOST'),
        string(credentialsId: 'POSTGRES_PORT_ID', variable: 'CRED_POSTGRES_PORT'),
        string(credentialsId: 'POSTGRES_USER_ID', variable: 'CRED_POSTGRES_USER'),
        string(credentialsId: 'POSTGRES_PASSWORD_ID', variable: 'CRED_POSTGRES_PASSWORD'),
        string(credentialsId: 'DOCKEROPT_ADMIN_EMAIL_ID', variable: 'CRED_ADMIN_EMAIL'),
        string(credentialsId: 'DOCKEROPT_ADMIN_PASSWORD_ID', variable: 'CRED_ADMIN_PASSWORD'),
        string(credentialsId: 'DOCKEROPT_JWT_SECRET_ID', variable: 'CRED_JWT_SECRET'),
        string(credentialsId: 'DOCKEROPT_SMTP_USER_ID', variable: 'CRED_SMTP_USER'),
        string(credentialsId: 'DOCKEROPT_SMTP_PASSWORD_ID', variable: 'CRED_SMTP_PASSWORD'),
        string(credentialsId: 'DOCKEROPT_SMTP_FROM_ID', variable: 'CRED_SMTP_FROM'),
        string(credentialsId: 'DOCKEROPT_ALERT_EMAIL_ID', variable: 'CRED_ALERT_EMAIL')
    ]) {
        sh '''
            set +x
            echo "Génération du fichier .env temporaire..."

            cat <<EOF > .env
# --- Base de données (PostgreSQL natif externe, hors conteneurs) ---
POSTGRES_HOST=${CRED_POSTGRES_HOST}
POSTGRES_PORT=${CRED_POSTGRES_PORT}
POSTGRES_USER=${CRED_POSTGRES_USER}
POSTGRES_PASSWORD=${CRED_POSTGRES_PASSWORD}
POSTGRES_DB=dockeropt

# IMPORTANT: DB_HOST/DB_PORT pointent vers le PostgreSQL natif du serveur
# (adresse réelle + port 5435 fournis par les credentials Jenkins), et non
# vers un service "postgres" conteneurisé qui n'existe pas dans ce compose.
DB_HOST=${CRED_POSTGRES_HOST}
DB_PORT=${CRED_POSTGRES_PORT}
DB_NAME=dockeropt
DB_USER=${CRED_POSTGRES_USER}
DB_PASSWORD=${CRED_POSTGRES_PASSWORD}
DATABASE_URL=postgres://${CRED_POSTGRES_USER}:${CRED_POSTGRES_PASSWORD}@${CRED_POSTGRES_HOST}:${CRED_POSTGRES_PORT}/dockeropt
DB_POOL_MAX=10

# --- Admin & Sécurité ---
ADMIN_EMAIL=${CRED_ADMIN_EMAIL}
ADMIN_PASSWORD=${CRED_ADMIN_PASSWORD}
JWT_SECRET=${CRED_JWT_SECRET}
JWT_EXPIRES_IN=7d

# --- Configuration SMTP ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${CRED_SMTP_USER}
SMTP_PASSWORD=${CRED_SMTP_PASSWORD}
SMTP_FROM=${CRED_SMTP_FROM}
ALERT_EMAIL_TO=${CRED_ALERT_EMAIL}

# --- Réseau & Volumes ---
DOCKEROPT_NETWORK_NAME=dockeropt_net
DOCKEROPT_NETWORK_SUBNET=172.28.0.0/16
PROMETHEUS_DATA_VOLUME=prometheus_data

# --- Frontend & Backend (Contextes de build dans dockeropt-platform) ---
DOCKEROPT_FRONTEND_BUILD=./dockeropt-platform/frontend
DOCKEROPT_FRONTEND_IMAGE=dockeropt-frontend:latest
DOCKEROPT_FRONTEND_CONTAINER_NAME=dockeropt_frontend
FRONTEND_HOST_PORT=3000
DOCKEROPT_FRONTEND_API_URL=http://localhost:5000

DOCKEROPT_BACKEND_BUILD=./dockeropt-platform/backend
DOCKEROPT_BACKEND_IMAGE=dockeropt-backend:latest
DOCKEROPT_BACKEND_CONTAINER_NAME=dockeropt_backend
BACKEND_HOST_PORT=5000

# --- Microservices (Ports 5001 - 5004) ---
# NOTE: ces 4 services sont maintenant construits depuis leur propre code
# source (comme frontend/backend), au lieu d'utiliser l'image node:18-alpine
# brute sans commande, qui provoquait une boucle de redémarrage (exit 0).
DOCKEROPT_API_GATEWAY_BUILD=./dockeropt-platform/api-gateway
API_GATEWAY_IMAGE=dockeropt-api-gateway:latest
API_GATEWAY_CONTAINER_NAME=dockeropt_api_gateway
API_GATEWAY_PORT=5001
API_GATEWAY_USER_SERVICE_URL=http://user-service:5002
API_GATEWAY_PRODUCT_SERVICE_URL=http://product-service:5003
API_GATEWAY_NOTIFICATION_SERVICE_URL=http://notification-service:5004
API_GATEWAY_CPUS=0.5
API_GATEWAY_MEM_LIMIT=512m

DOCKEROPT_USER_SERVICE_BUILD=./dockeropt-platform/user-service
USER_SERVICE_IMAGE=dockeropt-user-service:latest
USER_SERVICE_CONTAINER_NAME=dockeropt_user_service
USER_SERVICE_PORT=5002
USER_SERVICE_CPUS=0.5
USER_SERVICE_MEM_LIMIT=512m

DOCKEROPT_PRODUCT_SERVICE_BUILD=./dockeropt-platform/product-service
PRODUCT_SERVICE_IMAGE=dockeropt-product-service:latest
PRODUCT_SERVICE_CONTAINER_NAME=dockeropt_product_service
PRODUCT_SERVICE_PORT=5003
PRODUCT_SERVICE_CPUS=0.5
PRODUCT_SERVICE_MEM_LIMIT=512m

DOCKEROPT_NOTIFICATION_SERVICE_BUILD=./dockeropt-platform/notification-service
NOTIFICATION_SERVICE_IMAGE=dockeropt-notification-service:latest
NOTIFICATION_SERVICE_CONTAINER_NAME=dockeropt_notification_service
NOTIFICATION_SERVICE_PORT=5004
NOTIFICATION_SERVICE_CPUS=0.5
NOTIFICATION_SERVICE_MEM_LIMIT=512m

# --- Monitoring ---
CADVISOR_IMAGE=gcr.io/cadvisor/cadvisor:latest
CADVISOR_CONTAINER_NAME=dockeropt_cadvisor
CADVISOR_HOST_PORT=8083

PROMETHEUS_IMAGE=prom/prometheus:latest
PROMETHEUS_CONTAINER_NAME=dockeropt_prometheus
PROMETHEUS_PORT=9090
PROMETHEUS_RETENTION=15d
PROMETHEUS_URL=http://prometheus:9090

NODE_EXPORTER_IMAGE=prom/node-exporter:latest
NODE_EXPORTER_CONTAINER_NAME=dockeropt_node_exporter
NODE_EXPORTER_PORT=9100
EOF
            chmod 600 .env
            echo "Fichier .env temporaire prêt."
        '''
    }
}

pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'dockeropt'
        DEPLOY_DIR = '/opt/dockeropt'
        // Désactive le mode "bake" de docker compose (build parallèle via buildx bake).
        // Ce mode peut masquer/mal résoudre les chemins relatifs de contexte de build
        // quand plusieurs services sont construits en même temps ; on repasse en
        // build séquentiel classique, plus lent mais avec des erreurs plus lisibles.
        COMPOSE_BAKE = 'false'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Environment') {
            steps {
                script {
                    createEnvFile()
                }
            }
        }

        // Vérifie AVANT de builder que les Dockerfile attendus existent bien
        // aux chemins déclarés dans le .env, pour TOUS les services applicatifs
        // (frontend, backend, et les 4 microservices). Échoue avec un message
        // clair + un état complet du workspace si un fichier manque, au lieu
        // de laisser Docker Compose échouer avec une erreur peu explicite.
        stage('Verify Build Context') {
            steps {
                sh '''
                    set -e
                    echo "=========================================="
                    echo "VERIFICATION DES CONTEXTES DE BUILD"
                    echo "=========================================="

                    export $(grep -v '^#' .env | xargs -d '\\n')

                    echo "--- Arborescence du workspace (3 niveaux) ---"
                    find . -maxdepth 3 -type d -not -path "*/.git*" -not -path "*/node_modules*"

                    echo ""
                    echo "--- Recherche de tous les Dockerfile du repo ---"
                    find . -iname "Dockerfile*" -not -path "*/node_modules/*" -not -path "*/.git/*"

                    for svc in \\
                        "FRONTEND:${DOCKEROPT_FRONTEND_BUILD}" \\
                        "BACKEND:${DOCKEROPT_BACKEND_BUILD}" \\
                        "API_GATEWAY:${DOCKEROPT_API_GATEWAY_BUILD}" \\
                        "USER_SERVICE:${DOCKEROPT_USER_SERVICE_BUILD}" \\
                        "PRODUCT_SERVICE:${DOCKEROPT_PRODUCT_SERVICE_BUILD}" \\
                        "NOTIFICATION_SERVICE:${DOCKEROPT_NOTIFICATION_SERVICE_BUILD}"
                    do
                        name="${svc%%:*}"
                        path="${svc#*:}"
                        echo ""
                        echo "--- Contexte ${name} attendu: ${path} ---"
                        if [ ! -f "${path}/Dockerfile" ]; then
                            echo "ERREUR: Dockerfile introuvable dans ${path}"
                            ls -la "${path}" 2>/dev/null || echo "Le dossier ${path} n'existe pas du tout."
                            exit 1
                        fi
                        echo "OK: ${path}/Dockerfile trouvé."
                    done
                '''
            }
        }

        stage('Clean Docker Build Cache') {
            steps {
                sh '''
                    set -e
                    echo "=========================================="
                    echo "NETTOYAGE DU CACHE DOCKER BUILD"
                    echo "=========================================="
                    docker builder prune -af || true
                '''
            }
        }

        stage('Validate Docker Compose') {
            steps {
                script {
                    if (!fileExists('.env')) { createEnvFile() }
                }
                sh '''
                    set -e
                    echo "=========================================="
                    echo "VALIDATION DOCKER COMPOSE"
                    echo "=========================================="

                    docker compose --env-file .env config -q
                    echo "Docker Compose configuration OK."
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    if (!fileExists('.env')) { createEnvFile() }
                }
                sh '''
                    set -e
                    echo "=========================================="
                    echo "BUILD DES IMAGES DOCKER (SANS CACHE)"
                    echo "=========================================="

                    docker compose --env-file .env build --no-cache
                    echo "Build terminé avec succès."
                '''
            }
        }

        stage('Deploy') {
            steps {
                script {
                    if (!fileExists('.env')) { createEnvFile() }
                }
                sh '''
                    set -e
                    echo "=========================================="
                    echo "DEPLOIEMENT DOCKEROPT"
                    echo "=========================================="

                    docker compose --env-file .env up -d --remove-orphans
                    echo "Déploiement terminé."
                '''
            }
        }

        stage('Verify Containers') {
            steps {
                script {
                    if (!fileExists('.env')) { createEnvFile() }
                }
                sh '''
                    set -e
                    echo "=========================================="
                    echo "ETAT DES SERVICES DOCKEROPT"
                    echo "=========================================="

                    docker compose --env-file .env ps

                    echo ""
                    echo "=========================================="
                    echo "CONTENEURS DOCKER"
                    echo "=========================================="

                    docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
                '''
            }
        }
    }

    post {
        success {
            echo '''
==========================================
DockerOpt deployment SUCCESS
==========================================
'''
        }

        failure {
            echo '''
==========================================
DockerOpt deployment FAILED
==========================================
'''
        }

        always {
            sh '''
                echo "Nettoyage des secrets temporaires..."
                rm -f .env .env.jenkins || true
                echo "Nettoyage terminé."
            '''
            cleanWs()
        }
    }
}