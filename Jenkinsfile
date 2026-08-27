pipeline {
    agent any
    environment {
        COMPOSE_PROJECT_NAME = 'dockeropt'
        DOCKER_TAG = "${BUILD_NUMBER}"

        // PostgreSQL — credentials globaux réutilisés pour tous les projets
        POSTGRES_HOST     = credentials('POSTGRES_HOST_ID')
        POSTGRES_PORT     = credentials('POSTGRES_PORT_ID')
        POSTGRES_USER     = credentials('POSTGRES_USER_ID')
        POSTGRES_PASSWORD = credentials('POSTGRES_PASSWORD_ID')

        // Compte admin / JWT (spécifiques à dockeropt)
        ADMIN_EMAIL    = credentials('DOCKEROPT_ADMIN_EMAIL_ID')
        ADMIN_PASSWORD = credentials('DOCKEROPT_ADMIN_PASSWORD_ID')
        JWT_SECRET     = credentials('DOCKEROPT_JWT_SECRET_ID')

        // SMTP / alertes (spécifiques à dockeropt)
        SMTP_USER      = credentials('DOCKEROPT_SMTP_USER_ID')
        SMTP_PASSWORD  = credentials('DOCKEROPT_SMTP_PASSWORD_ID')
        SMTP_FROM      = credentials('DOCKEROPT_SMTP_FROM_ID')
        ALERT_EMAIL_TO = credentials('DOCKEROPT_ALERT_EMAIL_ID')
    }
    stages {

        stage('Update repo') {
            steps {
                sh 'git pull origin main'
            }
        }

        stage('Generate .env') {
            steps {
                sh '''
cat > .env <<EOF
COMPOSE_PROJECT_NAME=dockeropt
DOCKEROPT_NETWORK_NAME=dockeropt-network
DOCKEROPT_NETWORK_SUBNET=172.20.0.0/16

API_GATEWAY_IMAGE=./services/api-gateway
API_GATEWAY_CONTAINER_NAME=dockeropt-api-gateway
API_GATEWAY_PORT=5001
API_GATEWAY_USER_SERVICE_URL=http://user-service:5002
API_GATEWAY_PRODUCT_SERVICE_URL=http://product-service:5003
API_GATEWAY_NOTIFICATION_SERVICE_URL=http://notification-service:5004
API_GATEWAY_MEM_LIMIT=256m
API_GATEWAY_CPUS=0.5

USER_SERVICE_IMAGE=./services/user-service
USER_SERVICE_CONTAINER_NAME=dockeropt-user-service
USER_SERVICE_PORT=5002
USER_SERVICE_MEM_LIMIT=256m
USER_SERVICE_CPUS=0.5

PRODUCT_SERVICE_IMAGE=./services/product-service
PRODUCT_SERVICE_CONTAINER_NAME=dockeropt-product-service
PRODUCT_SERVICE_PORT=5003
PRODUCT_SERVICE_MEM_LIMIT=256m
PRODUCT_SERVICE_CPUS=0.5

NOTIFICATION_SERVICE_IMAGE=./services/notification-service
NOTIFICATION_SERVICE_CONTAINER_NAME=dockeropt-notification-service
NOTIFICATION_SERVICE_PORT=5004
NOTIFICATION_SERVICE_MEM_LIMIT=256m
NOTIFICATION_SERVICE_CPUS=0.5

NODE_EXPORTER_IMAGE=prom/node-exporter:latest
NODE_EXPORTER_CONTAINER_NAME=dockeropt-node-exporter
NODE_EXPORTER_PORT=9100

CADVISOR_IMAGE=gcr.io/cadvisor/cadvisor:latest
CADVISOR_CONTAINER_NAME=dockeropt-cadvisor
CADVISOR_PORT=8081

PROMETHEUS_IMAGE=prom/prometheus:latest
PROMETHEUS_CONTAINER_NAME=dockeropt-prometheus
PROMETHEUS_PORT=9090
PROMETHEUS_RETENTION=30d
PROMETHEUS_SCRAPE_INTERVAL=15s
PROMETHEUS_EVALUATION_INTERVAL=15s
PROMETHEUS_SCRAPE_TIMEOUT=10s
PROMETHEUS_DATA_VOLUME=prometheus-data

# --- PostgreSQL (conteneur local du projet, credentials globaux Jenkins) ---
POSTGRES_IMAGE=postgres:16-alpine
POSTGRES_CONTAINER_NAME=dockeropt-postgres
POSTGRES_PORT=${POSTGRES_PORT}
POSTGRES_DB=dockeropt
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DATA_VOLUME=dockeropt-postgres-data

# Connexion du backend au conteneur local : DB_HOST reste "postgres"
# (alias du service dans le réseau docker-compose), le port interne du
# conteneur postgres est toujours 5432 quel que soit POSTGRES_PORT exposé.
DB_HOST=postgres
DB_PORT=5268
DB_NAME=dockeropt
DB_USER=${POSTGRES_USER}
DB_PASSWORD=${POSTGRES_PASSWORD}
DB_POOL_MAX=10
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5268/dockeropt

DOCKEROPT_BACKEND_BUILD=./dockeropt-platform/backend
DOCKEROPT_BACKEND_IMAGE=dockeropt-backend:${DOCKER_TAG}
DOCKEROPT_BACKEND_CONTAINER_NAME=dockeropt-backend
DOCKEROPT_BACKEND_PORT=5000
DOCKEROPT_BACKEND_INTERNAL_PORT=5000
PROMETHEUS_URL=http://prometheus:9090
DOCKER_HOST=unix:///var/run/docker.sock

ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
SMTP_FROM=${SMTP_FROM}
ALERT_EMAIL_TO=${ALERT_EMAIL_TO}
ALERT_CHECK_INTERVAL_MS=15000
PLATFORM_URL=http://localhost:3000

PLATFORM_INFRA_CONTAINERS=dockeropt-backend,dockeropt-frontend,dockeropt-prometheus,dockeropt-cadvisor,dockeropt-node-exporter,dockeropt-postgres
RECO_WINDOW_MS=300000
RECO_MIN_SAMPLES=4
OPTIMIZATION_COOLDOWN_MS=180000
SECURITY_SCAN_TIMEOUT_MS=165000

DOCKEROPT_FRONTEND_BUILD=./dockeropt-platform/frontend
DOCKEROPT_FRONTEND_IMAGE=dockeropt-frontend:${DOCKER_TAG}
DOCKEROPT_FRONTEND_CONTAINER_NAME=dockeropt-frontend
DOCKEROPT_FRONTEND_PORT=3000
DOCKEROPT_FRONTEND_API_URL=http://dockeropt-backend:5000

LOAD_GENERATOR_IMAGE=./services/load-generator
LOAD_GENERATOR_CONTAINER_NAME=dockeropt-load-generator
LOAD_GENERATOR_API_GATEWAY_URL=http://api-gateway:5001
LOAD_GENERATOR_MEM_LIMIT=128m
LOAD_GENERATOR_CPUS=0.25
EOF
                '''
            }
        }

        stage('Build images') {
            steps {
                sh 'docker compose --env-file .env build'
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker compose --env-file .env down --remove-orphans
                    docker compose --env-file .env up -d
                '''
            }
        }

        stage('Health check') {
            steps {
                sh '''
                    sleep 10
                    docker compose --env-file .env ps
                    curl -sf http://localhost:5000/health || echo "Backend health check failed"
                '''
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}