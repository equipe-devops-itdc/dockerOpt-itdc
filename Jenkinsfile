```groovy
pipeline {

    agent any


    // ==========================================================
    // ENVIRONMENT
    // ==========================================================

    environment {

        // ------------------------------------------------------
        // DOCKER
        // ------------------------------------------------------

        COMPOSE_PROJECT_NAME = 'dockeropt'

        DOCKER_TAG = "${BUILD_NUMBER}"


        // ------------------------------------------------------
        // POSTGRESQL - JENKINS CREDENTIALS
        //
        // PostgreSQL est EXTERNE.
        // Aucun conteneur PostgreSQL dans cette stack.
        // ------------------------------------------------------

        POSTGRES_HOST_RAW = credentials('POSTGRES_HOST_ID')

        POSTGRES_PORT_RAW = credentials('POSTGRES_PORT_ID')

        POSTGRES_USER_RAW = credentials('POSTGRES_USER_ID')

        POSTGRES_PASSWORD = credentials('POSTGRES_PASSWORD_ID')


        // ------------------------------------------------------
        // ADMIN / JWT
        // ------------------------------------------------------

        ADMIN_EMAIL = credentials('DOCKEROPT_ADMIN_EMAIL_ID')

        ADMIN_PASSWORD = credentials('DOCKEROPT_ADMIN_PASSWORD_ID')

        JWT_SECRET = credentials('DOCKEROPT_JWT_SECRET_ID')


        // ------------------------------------------------------
        // SMTP
        // ------------------------------------------------------

        SMTP_USER = credentials('DOCKEROPT_SMTP_USER_ID')

        SMTP_PASSWORD = credentials('DOCKEROPT_SMTP_PASSWORD_ID')

        SMTP_FROM = credentials('DOCKEROPT_SMTP_FROM_ID')

        ALERT_EMAIL_TO = credentials('DOCKEROPT_ALERT_EMAIL_ID')
    }


    stages {


        // ======================================================
        // UPDATE REPOSITORY
        // ======================================================

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


        // ======================================================
        // PREPARE POSTGRESQL VARIABLES
        // ======================================================

        stage('Prepare PostgreSQL credentials') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "PREPARING POSTGRESQL CREDENTIALS"
                    echo "=========================================="

                    # Nettoyage des éventuels CR/LF/espaces
                    # présents accidentellement dans les Secret Text.

                    POSTGRES_HOST="$(printf '%s' "${POSTGRES_HOST_RAW}" | tr -d '\\r\\n' | xargs)"

                    POSTGRES_PORT="$(printf '%s' "${POSTGRES_PORT_RAW}" | tr -d '\\r\\n' | xargs)"

                    POSTGRES_USER="$(printf '%s' "${POSTGRES_USER_RAW}" | tr -d '\\r\\n')"

                    # Vérification HOST
                    if [ -z "${POSTGRES_HOST}" ]; then
                        echo "ERROR: POSTGRES_HOST is empty."
                        exit 1
                    fi

                    # Vérification PORT
                    if [ -z "${POSTGRES_PORT}" ]; then
                        echo "ERROR: POSTGRES_PORT is empty."
                        exit 1
                    fi

                    if ! printf '%s' "${POSTGRES_PORT}" | grep -Eq '^[0-9]+$'; then
                        echo "ERROR: POSTGRES_PORT is not numeric."
                        exit 1
                    fi

                    # Vérification USER
                    if [ -z "${POSTGRES_USER}" ]; then
                        echo "ERROR: POSTGRES_USER is empty."
                        exit 1
                    fi

                    echo "PostgreSQL host: configured"
                    echo "PostgreSQL port: ${POSTGRES_PORT}"
                    echo "PostgreSQL user: configured"

                    # Export pour les étapes suivantes.
                    #
                    # Aucun mot de passe n'est écrit ici.
                    cat > .postgres.env <<EOF
POSTGRES_HOST=${POSTGRES_HOST}
POSTGRES_PORT=${POSTGRES_PORT}
POSTGRES_USER=${POSTGRES_USER}
EOF

                    chmod 600 .postgres.env

                    echo "PostgreSQL variables prepared."
                '''
            }
        }


        // ======================================================
        // VERIFY POSTGRESQL
        // ======================================================

        stage('Verify PostgreSQL configuration') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "VERIFY POSTGRESQL CONFIGURATION"
                    echo "=========================================="

                    . ./.postgres.env

                    echo "Host: ${POSTGRES_HOST}"
                    echo "Port: ${POSTGRES_PORT}"
                    echo "User: ${POSTGRES_USER}"

                    echo ""
                    echo "Checking TCP connectivity..."

                    if ! timeout 5 bash -c "</dev/tcp/${POSTGRES_HOST}/${POSTGRES_PORT}"; then

                        echo "ERROR: PostgreSQL TCP port is unreachable."

                        echo "Host: ${POSTGRES_HOST}"
                        echo "Port: ${POSTGRES_PORT}"

                        exit 1
                    fi

                    echo "TCP connection: OK"

                    echo ""
                    echo "Checking PostgreSQL service..."

                    if ! PGCONNECT_TIMEOUT=5 pg_isready \
                        -h "${POSTGRES_HOST}" \
                        -p "${POSTGRES_PORT}" \
                        -U "${POSTGRES_USER}" \
                        -d dockeropt
                    then

                        echo ""
                        echo "ERROR: PostgreSQL does not accept the connection."

                        echo "Host: ${POSTGRES_HOST}"
                        echo "Port: ${POSTGRES_PORT}"
                        echo "User: ${POSTGRES_USER}"
                        echo "Database: dockeropt"

                        exit 1
                    fi

                    echo "PostgreSQL availability: OK"

                    echo ""
                    echo "Checking PostgreSQL authentication..."

                    PGPASSWORD="${POSTGRES_PASSWORD}" \
                    PGCONNECT_TIMEOUT=5 \
                    psql \
                        -h "${POSTGRES_HOST}" \
                        -p "${POSTGRES_PORT}" \
                        -U "${POSTGRES_USER}" \
                        -d dockeropt \
                        -c "SELECT current_database(), current_user;"

                    echo ""
                    echo "PostgreSQL authentication: OK"


                    echo ""
                    echo "Checking PostgreSQL port..."

                    PGPASSWORD="${POSTGRES_PASSWORD}" \
                    psql \
                        -h "${POSTGRES_HOST}" \
                        -p "${POSTGRES_PORT}" \
                        -U "${POSTGRES_USER}" \
                        -d dockeropt \
                        -c "SHOW port;"

                    echo ""
                    echo "=========================================="
                    echo "POSTGRESQL VERIFICATION SUCCESSFUL"
                    echo "=========================================="
                '''
            }
        }


        // ======================================================
        // GENERATE .ENV
        // ======================================================

        stage('Generate .env') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "GENERATING .ENV"
                    echo "=========================================="

                    . ./.postgres.env

                    rm -f .env

                    cat > .env <<EOF

# ==========================================================
# DOCKER
# ==========================================================

COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}

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
# POSTGRESQL EXTERNE
# ==========================================================

POSTGRES_HOST=${POSTGRES_HOST}

POSTGRES_PORT=${POSTGRES_PORT}

POSTGRES_USER=${POSTGRES_USER}

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}


# ==========================================================
# DATABASE
# ==========================================================

DB_HOST=${POSTGRES_HOST}

DB_PORT=${POSTGRES_PORT}

DB_NAME=dockeropt

DB_USER=${POSTGRES_USER}

DB_PASSWORD=${POSTGRES_PASSWORD}

DB_POOL_MAX=10


# ==========================================================
# DATABASE URL
# ==========================================================

DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/dockeropt


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

PLATFORM_INFRA_CONTAINERS=dockeropt-backend,dockeropt-frontend,dockeropt-prometheus,dockeropt-cadvisor,dockeropt-node-exporter

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

FRONTEND_HOST_PORT=3000

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

                    chmod 600 .env

                    echo ".env generated successfully."
                '''
            }
        }


        // ======================================================
        // VALIDATE COMPOSE
        // ======================================================

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


        // ======================================================
        // DOCKER CHECK
        // ======================================================

        stage('Docker check') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "DOCKER CHECK"
                    echo "=========================================="

                    docker --version

                    docker compose version

                    docker info > /dev/null

                    echo "Docker daemon: OK"
                '''
            }
        }


        // ======================================================
        // BUILD IMAGES
        // ======================================================

        stage('Build images') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "BUILDING DOCKER IMAGES"
                    echo "=========================================="

                    docker compose --env-file .env build

                    echo "Docker images built successfully."
                '''
            }
        }


        // ======================================================
        // DEPLOY
        // ======================================================

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

                    echo "Deployment started successfully."
                '''
            }
        }


        // ======================================================
        // TEST POSTGRESQL FROM BACKEND CONTAINER
        // ======================================================

        stage('Verify PostgreSQL from backend container') {

            steps {

                sh '''
                    set -e

                    . ./.postgres.env

                    echo "=========================================="
                    echo "VERIFY POSTGRESQL FROM BACKEND CONTAINER"
                    echo "=========================================="

                    echo "Testing TCP connection from dockeropt-backend..."

                    if docker exec dockeropt-backend \
                        sh -c "timeout 5 bash -c '</dev/tcp/${POSTGRES_HOST}/${POSTGRES_PORT}'"
                    then

                        echo "Backend -> PostgreSQL TCP: OK"

                    else

                        echo "Backend -> PostgreSQL TCP: FAILED"

                        docker logs dockeropt-backend --tail 100 || true

                        exit 1
                    fi
                '''
            }
        }


        // ======================================================
        // WAIT FOR BACKEND
        // ======================================================

        stage('Backend health check') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "BACKEND HEALTH CHECK"
                    echo "=========================================="

                    ATTEMPTS=0
                    MAX_ATTEMPTS=30

                    until docker exec dockeropt-backend \
                        wget -qO- \
                        http://localhost:5000/health \
                        > /dev/null 2>&1
                    do

                        ATTEMPTS=$((ATTEMPTS + 1))

                        if [ "${ATTEMPTS}" -ge "${MAX_ATTEMPTS}" ]; then

                            echo "Backend health check failed."

                            docker logs dockeropt-backend --tail 150 || true

                            exit 1
                        fi

                        echo "Backend not ready yet..."

                        sleep 2

                    done

                    echo "Backend: OK"
                '''
            }
        }


        // ======================================================
        // FRONTEND HEALTH CHECK
        // ======================================================

        stage('Frontend health check') {

            steps {

                sh '''
                    set -e

                    echo "=========================================="
                    echo "FRONTEND HEALTH CHECK"
                    echo "=========================================="

                    ATTEMPTS=0
                    MAX_ATTEMPTS=30

                    until docker exec dockeropt-frontend \
                        wget -qO- \
                        http://localhost/ \
                        > /dev/null 2>&1
                    do

                        ATTEMPTS=$((ATTEMPTS + 1))

                        if [ "${ATTEMPTS}" -ge "${MAX_ATTEMPTS}" ]; then

                            echo "Frontend health check failed."

                            docker logs dockeropt-frontend --tail 100 || true

                            exit 1
                        fi

                        echo "Frontend not ready yet..."

                        sleep 2

                    done

                    echo "Frontend: OK"
                '''
            }
        }


        // ======================================================
        // FINAL STATUS
        // ======================================================

        stage('Final status') {

            steps {

                sh '''
                    set -e

                    echo ""
                    echo "=========================================="
                    echo "FINAL CONTAINER STATUS"
                    echo "=========================================="

                    docker compose --env-file .env ps

                    echo ""

                    docker ps \
                        --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"

                    echo ""
                    echo "=========================================="
                    echo "DEPLOYMENT SUCCESSFUL"
                    echo "=========================================="
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

            sh '''
                rm -f .env .postgres.env || true
            '''

            cleanWs()
        }
    }
}
```
