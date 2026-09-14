pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'dockeropt'
        DOCKER_BUILDKIT = '1'
        COMPOSE_DOCKER_CLI_BUILD = '1'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Nettoyage Pre-build') {
            steps {
                sh label: 'Clean Workspace Files', script: '''
                    rm -f "${WORKSPACE}/.env"
                '''
            }
        }

        stage('Génération Configuration') {
            steps {
                withCredentials([
                    string(credentialsId: 'POSTGRES_HOST_ID', variable: 'CRED_POSTGRES_HOST_RAW'),
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
                    sh label: 'Création du fichier .env', script: '''
                        set -x
                        CLEAN_HOST=$(echo "${CRED_POSTGRES_HOST_RAW}" | sed -e 's|^https://||' -e 's|^http://||' -e 's|/.*||')

                        cat <<EOF > "${WORKSPACE}/.env"
POSTGRES_HOST=${CLEAN_HOST}
POSTGRES_PORT=${CRED_POSTGRES_PORT}
POSTGRES_USER=${CRED_POSTGRES_USER}
POSTGRES_PASSWORD=${CRED_POSTGRES_PASSWORD}
POSTGRES_DB=dockeropt

DB_HOST=${CLEAN_HOST}
DB_PORT=${CRED_POSTGRES_PORT}
DB_NAME=dockeropt
DB_USER=${CRED_POSTGRES_USER}
DB_PASSWORD=${CRED_POSTGRES_PASSWORD}
DATABASE_URL=postgres://${CRED_POSTGRES_USER}:${CRED_POSTGRES_PASSWORD}@${CLEAN_HOST}:${CRED_POSTGRES_PORT}/dockeropt
DB_POOL_MAX=10

ADMIN_EMAIL=${CRED_ADMIN_EMAIL}
ADMIN_PASSWORD=${CRED_ADMIN_PASSWORD}
JWT_SECRET=${CRED_JWT_SECRET}
JWT_EXPIRES_IN=7d

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${CRED_SMTP_USER}
SMTP_PASSWORD=${CRED_SMTP_PASSWORD}
SMTP_FROM=${CRED_SMTP_FROM}
ALERT_EMAIL_TO=${CRED_ALERT_EMAIL}

DOCKEROPT_NETWORK_NAME=dockeropt_net
DOCKEROPT_NETWORK_SUBNET=172.28.0.0/16
PROMETHEUS_DATA_VOLUME=prometheus_data

# ---- FRONTEND (3000+) ----
DOCKEROPT_FRONTEND_BUILD=./dockeropt-platform/frontend
DOCKEROPT_FRONTEND_IMAGE=dockeropt-frontend:latest
DOCKEROPT_FRONTEND_CONTAINER_NAME=dockeropt_frontend
FRONTEND_HOST_PORT=3000
DOCKEROPT_FRONTEND_API_URL=/api

# ---- BACKEND (5000+) ----
DOCKEROPT_BACKEND_BUILD=./dockeropt-platform/backend
DOCKEROPT_BACKEND_IMAGE=dockeropt-backend:latest
DOCKEROPT_BACKEND_CONTAINER_NAME=dockeropt_backend
BACKEND_HOST_PORT=5000

API_GATEWAY_IMAGE=node:18-alpine
API_GATEWAY_CONTAINER_NAME=dockeropt_api_gateway
API_GATEWAY_PORT=5001
API_GATEWAY_USER_SERVICE_URL=http://user-service:5002
API_GATEWAY_PRODUCT_SERVICE_URL=http://product-service:5003
API_GATEWAY_NOTIFICATION_SERVICE_URL=http://notification-service:5004
API_GATEWAY_CPUS=0.5
API_GATEWAY_MEM_LIMIT=512m

USER_SERVICE_IMAGE=node:18-alpine
USER_SERVICE_CONTAINER_NAME=dockeropt_user_service
USER_SERVICE_PORT=5002
USER_SERVICE_CPUS=0.5
USER_SERVICE_MEM_LIMIT=512m

PRODUCT_SERVICE_IMAGE=node:18-alpine
PRODUCT_SERVICE_CONTAINER_NAME=dockeropt_product_service
PRODUCT_SERVICE_PORT=5003
PRODUCT_SERVICE_CPUS=0.5
PRODUCT_SERVICE_MEM_LIMIT=512m

NOTIFICATION_SERVICE_IMAGE=node:18-alpine
NOTIFICATION_SERVICE_CONTAINER_NAME=dockeropt_notification_service
NOTIFICATION_SERVICE_PORT=5004
NOTIFICATION_SERVICE_CPUS=0.5
NOTIFICATION_SERVICE_MEM_LIMIT=512m

# ---- INFRA / MONITORING ----
CADVISOR_IMAGE=gcr.io/cadvisor/cadvisor:latest
CADVISOR_CONTAINER_NAME=dockeropt_cadvisor
CADVISOR_HOST_PORT=8085

PROMETHEUS_IMAGE=prom/prometheus:latest
PROMETHEUS_CONTAINER_NAME=dockeropt_prometheus
PROMETHEUS_PORT=9090
PROMETHEUS_RETENTION=15d
PROMETHEUS_URL=http://prometheus:9090

NODE_EXPORTER_IMAGE=prom/node-exporter:latest
NODE_EXPORTER_CONTAINER_NAME=dockeropt_node_exporter
NODE_EXPORTER_PORT=9100
EOF
                        chmod 600 "${WORKSPACE}/.env"
                        ls -la "${WORKSPACE}/.env"
                    '''
                }
            }
        }

        stage('Validation Compose') {
            steps {
                sh label: 'Vérification syntaxe docker compose', script: 'docker compose --env-file .env config'
            }
        }

        stage('Build Images') {
            steps {
                sh label: 'Build des conteneurs', script: 'docker compose --env-file .env build'
            }
        }

        stage('Deploy') {
            steps {
                sh label: 'Libération des ports avant déploiement', script: '''
                    get_env() {
                        grep -m1 "^$1=" .env | cut -d '=' -f2-
                    }
                    FRONTEND_HOST_PORT=$(get_env FRONTEND_HOST_PORT)
                    BACKEND_HOST_PORT=$(get_env BACKEND_HOST_PORT)
                    API_GATEWAY_PORT=$(get_env API_GATEWAY_PORT)
                    USER_SERVICE_PORT=$(get_env USER_SERVICE_PORT)
                    PRODUCT_SERVICE_PORT=$(get_env PRODUCT_SERVICE_PORT)
                    NOTIFICATION_SERVICE_PORT=$(get_env NOTIFICATION_SERVICE_PORT)
                    CADVISOR_HOST_PORT=$(get_env CADVISOR_HOST_PORT)
                    PROMETHEUS_PORT=$(get_env PROMETHEUS_PORT)
                    NODE_EXPORTER_PORT=$(get_env NODE_EXPORTER_PORT)

                    for p in "$FRONTEND_HOST_PORT" "$BACKEND_HOST_PORT" \
                             "$API_GATEWAY_PORT" "$USER_SERVICE_PORT" \
                             "$PRODUCT_SERVICE_PORT" "$NOTIFICATION_SERVICE_PORT" \
                             "$CADVISOR_HOST_PORT" "$PROMETHEUS_PORT" "$NODE_EXPORTER_PORT"; do
                        [ -z "$p" ] && continue
                        cids=$(docker ps -aq --filter "publish=$p")
                        if [ -n "$cids" ]; then
                            echo "Port $p occupé par un conteneur existant -> arrêt/suppression ($cids)"
                            docker rm -f $cids || true
                        else
                            if command -v fuser >/dev/null 2>&1; then
                                if fuser "${p}/tcp" >/dev/null 2>&1; then
                                    echo "Port $p tenu par un process hors Docker -> tentative de libération (fuser)"
                                    fuser -k -9 "${p}/tcp" 2>/dev/null || true
                                    sleep 1
                                fi
                            fi
                        fi
                    done
                '''
                sh label: 'Déploiement des services', script: 'docker compose --env-file .env up -d --force-recreate --remove-orphans'
            }
        }

        stage('Health Check') {
            steps {
                sh label: 'Vérification de l\'état des conteneurs', script: '''
                    sleep 5
                    docker compose --env-file .env ps
                    echo "--- Prometheus ---"
                    PROMETHEUS_PORT=$(grep -m1 "^PROMETHEUS_PORT=" .env | cut -d '=' -f2-)
                    curl -sf "http://localhost:${PROMETHEUS_PORT:-9090}/-/healthy" \
                        && echo "Prometheus OK" \
                        || echo "ATTENTION : Prometheus ne répond pas — voir 'docker compose logs prometheus'"
                '''
            }
        }
    }

    post {
        failure {
            sh label: 'Recupération des logs', script: '''
                if [ -f .env ]; then
                    docker compose --env-file .env logs --tail=100 || true
                fi
            '''
        }
    }
}