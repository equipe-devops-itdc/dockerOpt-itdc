pipeline {

    agent any

    environment {

        // ==========================================================
        // DOCKER
        // ==========================================================

        COMPOSE_PROJECT_NAME = 'dockeropt'

        DOCKER_TAG = "${BUILD_NUMBER}"


        // ==========================================================
        // POSTGRESQL
        // ==========================================================

        POSTGRES_HOST = credentials('POSTGRES_HOST_ID')

        POSTGRES_PORT = credentials('POSTGRES_PORT_ID')

        POSTGRES_USER = credentials('POSTGRES_USER_ID')

        POSTGRES_PASSWORD = credentials('POSTGRES_PASSWORD_ID')


        // ==========================================================
        // ADMIN / JWT
        // ==========================================================

        ADMIN_EMAIL = credentials('DOCKEROPT_ADMIN_EMAIL_ID')

        ADMIN_PASSWORD = credentials('DOCKEROPT_ADMIN_PASSWORD_ID')

        JWT_SECRET = credentials('DOCKEROPT_JWT_SECRET_ID')


        // ==========================================================
        // SMTP
        // ==========================================================

        SMTP_USER = credentials('DOCKEROPT_SMTP_USER_ID')

        SMTP_PASSWORD = credentials('DOCKEROPT_SMTP_PASSWORD_ID')

        SMTP_FROM = credentials('DOCKEROPT_SMTP_FROM_ID')

        ALERT_EMAIL_TO = credentials('DOCKEROPT_ALERT_EMAIL_ID')
    }


    stages {


        // ==========================================================
        // UPDATE REPOSITORY
        // ==========================================================

        stage('Update repo') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "UPDATE REPOSITORY"
                    echo "=========================================="

                    git fetch origin main

                    git reset --hard origin/main
                '''
            }
        }


        // ==========================================================
        // GENERATE .ENV
        // ==========================================================

        stage('Generate .env') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "GENERATE .ENV"
                    echo "=========================================="


                    cat > .env <<EOF

# ==========================================================
# DOCKER
# ==========================================================

COMPOSE_PROJECT_NAME=dockeropt

DOCKEROPT_NETWORK_NAME=dockeropt-network
DOCKEROPT_NETWORK_SUBNET=172.20.0.0/16


# ==========================================================
# API GATEWAY
# ==========================================================

API_GATEWAY_IMAGE=./services/api-gateway

API_GATEWAY_CONTAINER_NAME=dockeropt-api-gateway

API_GATEWAY_PORT=5001

API_GATEWAY_USER_SERVICE_URL=http://user-service:5002

API_GATEWAY_PRODUCT_SERVICE_URL=http://product-service:5003

API_GATEWAY_NOTIFICATION_SERVICE_URL=http://notification-service:5004

API_GATEWAY_MEM_LIMIT=256m

API_GATEWAY_CPUS=0.5


# ==========================================================
# USER SERVICE
# ==========================================================

USER_SERVICE_IMAGE=./services/user-service

USER_SERVICE_CONTAINER_NAME=dockeropt-user-service

USER_SERVICE_PORT=5002

USER_SERVICE_MEM_LIMIT=256m

USER_SERVICE_CPUS=0.5


# ==========================================================
# PRODUCT SERVICE
# ==========================================================

PRODUCT_SERVICE_IMAGE=./services/product-service

PRODUCT_SERVICE_CONTAINER_NAME=dockeropt-product-service

PRODUCT_SERVICE_PORT=5003

PRODUCT_SERVICE_MEM_LIMIT=256m

PRODUCT_SERVICE_CPUS=0.5


# ==========================================================
# NOTIFICATION SERVICE
# ==========================================================

NOTIFICATION_SERVICE_IMAGE=./services/notification-service

NOTIFICATION_SERVICE_CONTAINER_NAME=dockeropt-notification-service

NOTIFICATION_SERVICE_PORT=5004

NOTIFICATION_SERVICE_MEM_LIMIT=256m

NOTIFICATION_SERVICE_CPUS=0.5


# ==========================================================
# NODE EXPORTER
# ==========================================================

NODE_EXPORTER_IMAGE=prom/node-exporter:latest

NODE_EXPORTER_CONTAINER_NAME=dockeropt-node-exporter

NODE_EXPORTER_PORT=9100


# ==========================================================
# CADVISOR
# ==========================================================

CADVISOR_IMAGE=gcr.io/cadvisor/cadvisor:latest

CADVISOR_CONTAINER_NAME=dockeropt-cadvisor

CADVISOR_INTERNAL_PORT=8080


# ==========================================================
# PROMETHEUS
# ==========================================================

PROMETHEUS_IMAGE=prom/prometheus:latest

PROMETHEUS_CONTAINER_NAME=dockeropt-prometheus

PROMETHEUS_PORT=9090

PROMETHEUS_RETENTION=30d

PROMETHEUS_SCRAPE_INTERVAL=15s

PROMETHEUS_EVALUATION_INTERVAL=15s

PROMETHEUS_SCRAPE_TIMEOUT=10s

PROMETHEUS_DATA_VOLUME=prometheus-data


# ==========================================================
# POSTGRESQL
# ==========================================================

POSTGRES_IMAGE=postgres:16-alpine

POSTGRES_CONTAINER_NAME=dockeropt-postgres

# ==========================================================
# IMPORTANT
#
# Cette valeur vient du credential Jenkins :
#
# POSTGRES_PORT_ID
#
# AUCUN port PostgreSQL n'est écrit en dur ici.
# ==========================================================

POSTGRES_PORT=${POSTGRES_PORT}

POSTGRES_DB=dockeropt

POSTGRES_USER=${POSTGRES_USER}

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

POSTGRES_DATA_VOLUME=dockeropt-postgres-data


# ==========================================================
# DATABASE
# ==========================================================

DB_HOST=postgres

DB_PORT=${POSTGRES_PORT}

DB_NAME=dockeropt

DB_USER=${POSTGRES_USER}

DB_PASSWORD=${POSTGRES_PASSWORD}

DB_POOL_MAX=10

DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:${POSTGRES_PORT}/dockeropt


# ==========================================================
# DOCKEROPT BACKEND
# ==========================================================

DOCKEROPT_BACKEND_BUILD=./dockeropt-platform/backend

DOCKEROPT_BACKEND_IMAGE=dockeropt-backend:${DOCKER_TAG}

DOCKEROPT_BACKEND_CONTAINER_NAME=dockeropt-backend

DOCKEROPT_BACKEND_INTERNAL_PORT=5000

PROMETHEUS_URL=http://prometheus:9090

DOCKER_HOST=unix:///var/run/docker.sock


# ==========================================================
# ADMIN / JWT
# ==========================================================

ADMIN_EMAIL=${ADMIN_EMAIL}

ADMIN_PASSWORD=${ADMIN_PASSWORD}

JWT_SECRET=${JWT_SECRET}

JWT_EXPIRES_IN=24h


# ==========================================================
# SMTP
# ==========================================================

SMTP_HOST=smtp.gmail.com

SMTP_PORT=587

SMTP_SECURE=false

SMTP_USER=${SMTP_USER}

SMTP_PASSWORD=${SMTP_PASSWORD}

SMTP_FROM=${SMTP_FROM}

ALERT_EMAIL_TO=${ALERT_EMAIL_TO}

ALERT_CHECK_INTERVAL_MS=15000


# ==========================================================
# PLATFORM
# ==========================================================

PLATFORM_URL=http://localhost:3000

PLATFORM_INFRA_CONTAINERS=dockeropt-backend,dockeropt-frontend,dockeropt-prometheus,dockeropt-cadvisor,dockeropt-node-exporter,dockeropt-postgres

RECO_WINDOW_MS=300000

RECO_MIN_SAMPLES=4

OPTIMIZATION_COOLDOWN_MS=180000

SECURITY_SCAN_TIMEOUT_MS=165000


# ==========================================================
# FRONTEND
# ==========================================================

DOCKEROPT_FRONTEND_BUILD=./dockeropt-platform/frontend

DOCKEROPT_FRONTEND_IMAGE=dockeropt-frontend:${DOCKER_TAG}

DOCKEROPT_FRONTEND_CONTAINER_NAME=dockeropt-frontend

# Port HOST du frontend
FRONTEND_HOST_PORT=3000

# Port interne nginx
FRONTEND_INTERNAL_PORT=80

DOCKEROPT_FRONTEND_API_URL=http://dockeropt-backend:5000


# ==========================================================
# LOAD GENERATOR
# ==========================================================

LOAD_GENERATOR_IMAGE=./services/load-generator

LOAD_GENERATOR_CONTAINER_NAME=dockeropt-load-generator

LOAD_GENERATOR_API_GATEWAY_URL=http://api-gateway:5001

LOAD_GENERATOR_MEM_LIMIT=128m

LOAD_GENERATOR_CPUS=0.25

EOF


                    echo "=========================================="
                    echo ".env generated successfully"
                    echo "=========================================="
                '''
            }
        }


        // ==========================================================
        // VALIDATE COMPOSE
        // ==========================================================

        stage('Validate Compose') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "VALIDATING DOCKER COMPOSE"
                    echo "=========================================="

                    docker compose --env-file .env config > /tmp/docker-compose-config.yml

                    echo "Docker Compose configuration: OK"
                '''
            }
        }


        // ==========================================================
        // DOCKER CHECK
        // ==========================================================

        stage('Docker check') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "DOCKER CHECK"
                    echo "=========================================="

                    docker --version

                    docker compose version

                    echo "Checking Docker daemon..."

                    docker info > /dev/null

                    echo "Checking Docker Hub DNS..."

                    if getent hosts auth.docker.io > /dev/null 2>&1
                    then
                        echo "DNS auth.docker.io: OK"
                    else
                        echo "WARNING: auth.docker.io DNS resolution failed"
                    fi
                '''
            }
        }


        // ==========================================================
        // BUILD IMAGES
        // ==========================================================

        stage('Build images') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "BUILDING DOCKER IMAGES"
                    echo "=========================================="


                    echo "Testing Docker Hub connectivity..."

                    if ! getent hosts auth.docker.io > /dev/null 2>&1
                    then
                        echo ""
                        echo "ERROR: Cannot resolve auth.docker.io"
                        echo ""
                        echo "Docker cannot access Docker Hub."
                        echo "This is a server DNS/network problem."
                        echo ""
                        exit 1
                    fi


                    echo "Docker Hub DNS: OK"


                    echo "Pulling required base images..."


                    docker pull node:20-alpine

                    docker pull node:20-bookworm-slim

                    docker pull nginx:alpine

                    docker pull postgres:16-alpine

                    docker pull prom/prometheus:latest

                    docker pull prom/node-exporter:latest

                    docker pull gcr.io/cadvisor/cadvisor:latest


                    echo ""
                    echo "Base images downloaded successfully."
                    echo ""


                    echo "Building project images..."


                    docker compose --env-file .env build
                '''
            }
        }


        // ==========================================================
        // DEPLOY
        // ==========================================================

        stage('Deploy') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "STOPPING OLD DEPLOYMENT"
                    echo "=========================================="


                    docker compose --env-file .env down --remove-orphans || true


                    echo "=========================================="
                    echo "STARTING DEPLOYMENT"
                    echo "=========================================="


                    docker compose --env-file .env up -d


                    echo ""
                    echo "Deployment started."
                '''
            }
        }


        // ==========================================================
        // HEALTH CHECK
        // ==========================================================

        stage('Health check') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "WAITING FOR CONTAINERS"
                    echo "=========================================="


                    sleep 20


                    echo "=========================================="
                    echo "CONTAINER STATUS"
                    echo "=========================================="


                    docker compose --env-file .env ps


                    echo ""
                    echo "=========================================="
                    echo "POSTGRESQL HEALTH CHECK"
                    echo "=========================================="


                    if docker exec dockeropt-postgres \
                        pg_isready \
                        -h localhost \
                        -p "${POSTGRES_PORT}" \
                        -U "${POSTGRES_USER}" \
                        -d dockeropt
                    then

                        echo "PostgreSQL: OK"

                    else

                        echo "PostgreSQL: FAILED"

                        docker logs dockeropt-postgres --tail 100 || true

                        exit 1

                    fi


                    echo ""
                    echo "=========================================="
                    echo "BACKEND HEALTH CHECK"
                    echo "=========================================="


                    if docker exec dockeropt-backend \
                        wget -qO- \
                        http://localhost:5000/health \
                        > /dev/null 2>&1
                    then

                        echo "Backend: OK"

                    else

                        echo "Backend: FAILED"

                        docker logs dockeropt-backend --tail 100 || true

                        exit 1

                    fi


                    echo ""
                    echo "=========================================="
                    echo "FRONTEND HEALTH CHECK"
                    echo "=========================================="


                    if docker exec dockeropt-frontend \
                        wget -qO- \
                        http://localhost/ \
                        > /dev/null 2>&1
                    then

                        echo "Frontend: OK"

                    else

                        echo "Frontend: FAILED"

                        docker logs dockeropt-frontend --tail 100 || true

                        exit 1

                    fi


                    echo ""
                    echo "=========================================="
                    echo "DEPLOYMENT SUCCESSFUL"
                    echo "=========================================="


                    docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
                '''
            }
        }
    }


    // ==========================================================
    // POST
    // ==========================================================

    post {

        always {

            echo "Cleaning Jenkins workspace..."

            cleanWs()
        }
    }
}