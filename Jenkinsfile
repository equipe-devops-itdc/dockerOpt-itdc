pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'dockeropt'
        DEPLOY_DIR = '/opt/dockeropt'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Environment') {
            steps {
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
                        echo "Création du fichier .env complet..."

                        cat <<EOF > .env
# --- Base de données ---
POSTGRES_HOST=${CRED_POSTGRES_HOST}
POSTGRES_PORT=${CRED_POSTGRES_PORT}
POSTGRES_USER=${CRED_POSTGRES_USER}
POSTGRES_PASSWORD=${CRED_POSTGRES_PASSWORD}
POSTGRES_DB=dockeropt

DB_HOST=postgres
DB_PORT=5432
DB_NAME=dockeropt
DB_USER=${CRED_POSTGRES_USER}
DB_PASSWORD=${CRED_POSTGRES_PASSWORD}
DATABASE_URL=postgres://${CRED_POSTGRES_USER}:${CRED_POSTGRES_PASSWORD}@postgres:5432/dockeropt
DB_POOL_MAX=10

# --- Admin & Sécurité ---
ADMIN_EMAIL=${CRED_ADMIN_EMAIL}
ADMIN_PASSWORD=${CRED_ADMIN_PASSWORD}
JWT_SECRET=${CRED_JWT_SECRET}
JWT_EXPIRES_IN=7d

# --- Mail & Alerting ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${CRED_SMTP_USER}
SMTP_PASSWORD=${CRED_SMTP_PASSWORD}
SMTP_FROM=${CRED_SMTP_FROM}
ALERT_EMAIL_TO=${CRED_ALERT_EMAIL}

# --- Réseau & Volumes Docker ---
DOCKEROPT_NETWORK_NAME=dockeropt_net
DOCKEROPT_NETWORK_SUBNET=172.28.0.0/16
PROMETHEUS_DATA_VOLUME=prometheus_data

# --- API Gateway ---
API_GATEWAY_IMAGE=dockeropt-api-gateway:latest
API_GATEWAY_CONTAINER_NAME=dockeropt_api_gateway
API_GATEWAY_PORT=8000
API_GATEWAY_USER_SERVICE_URL=http://user-service:3001
API_GATEWAY_PRODUCT_SERVICE_URL=http://product-service:3002
API_GATEWAY_NOTIFICATION_SERVICE_URL=http://notification-service:3003
API_GATEWAY_CPUS=0.5
API_GATEWAY_MEM_LIMIT=512m

# --- User Service ---
USER_SERVICE_IMAGE=dockeropt-user-service:latest
USER_SERVICE_CONTAINER_NAME=dockeropt_user_service
USER_SERVICE_PORT=3001
USER_SERVICE_CPUS=0.5
USER_SERVICE_MEM_LIMIT=512m

# --- Product Service ---
PRODUCT_SERVICE_IMAGE=dockeropt-product-service:latest
PRODUCT_SERVICE_CONTAINER_NAME=dockeropt_product_service
PRODUCT_SERVICE_PORT=3002
PRODUCT_SERVICE_CPUS=0.5
PRODUCT_SERVICE_MEM_LIMIT=512m

# --- Notification Service ---
NOTIFICATION_SERVICE_IMAGE=dockeropt-notification-service:latest
NOTIFICATION_SERVICE_CONTAINER_NAME=dockeropt_notification_service
NOTIFICATION_SERVICE_PORT=3003
NOTIFICATION_SERVICE_CPUS=0.5
NOTIFICATION_SERVICE_MEM_LIMIT=512m

# --- Backend ---
DOCKEROPT_BACKEND_IMAGE=dockeropt-backend:latest
DOCKEROPT_BACKEND_CONTAINER_NAME=dockeropt_backend
BACKEND_HOST_PORT=5000
DOCKEROPT_BACKEND_BUILD=.

# --- Frontend ---
DOCKEROPT_FRONTEND_IMAGE=dockeropt-frontend:latest
DOCKEROPT_FRONTEND_CONTAINER_NAME=dockeropt_frontend
FRONTEND_HOST_PORT=80
DOCKEROPT_FRONTEND_API_URL=http://localhost:5000
DOCKEROPT_FRONTEND_BUILD=.

# --- Monitoring & Supervisions ---
PROMETHEUS_IMAGE=prom/prometheus:latest
PROMETHEUS_CONTAINER_NAME=dockeropt_prometheus
PROMETHEUS_PORT=9090
PROMETHEUS_RETENTION=15d
PROMETHEUS_URL=http://prometheus:9090

CADVISOR_IMAGE=gcr.io/cadvisor/cadvisor:latest
CADVISOR_CONTAINER_NAME=dockeropt_cadvisor
CADVISOR_HOST_PORT=8080

NODE_EXPORTER_IMAGE=prom/node-exporter:latest
NODE_EXPORTER_CONTAINER_NAME=dockeropt_node_exporter
NODE_EXPORTER_PORT=9100
EOF

                        chmod 600 .env
                        echo "Fichier .env complété avec succès."
                    '''
                }
            }
        }

        stage('Validate Docker Compose') {
            steps {
                sh '''
                    set -e

                    if [ ! -f .env ]; then
                        echo "ERREUR: Le fichier .env est introuvable."
                        exit 1
                    fi

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
                sh '''
                    set -e

                    if [ ! -f .env ]; then
                        echo "ERREUR: Fichier .env manquant."
                        exit 1
                    fi

                    echo "=========================================="
                    echo "BUILD DES IMAGES DOCKER"
                    echo "=========================================="

                    docker compose --env-file .env build

                    echo "Build terminé avec succès."
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -e

                    if [ ! -f .env ]; then
                        echo "ERREUR: Fichier .env manquant."
                        exit 1
                    fi

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
                sh '''
                    set -e

                    if [ ! -f .env ]; then
                        echo "ERREUR: Fichier .env manquant."
                        exit 1
                    fi

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