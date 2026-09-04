def createEnvFile() {
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
        sh '''
            set -x
            echo "--> Sanitization automatique des variables d'environnement..."
            
            # Nettoyage automatique : suppression de http://, https:// et des slashes
            CLEAN_HOST=$(echo "${CRED_POSTGRES_HOST_RAW}" | sed -e 's|^https://||' -e 's|^http://||' -e 's|/.*||')

            echo "--> Génération dynamique du fichier .env (PostgreSQL Host: ${CLEAN_HOST})..."

            cat <<EOF > .env
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

DOCKEROPT_FRONTEND_BUILD=./dockeropt-platform/frontend
DOCKEROPT_FRONTEND_IMAGE=dockeropt-frontend:latest
DOCKEROPT_FRONTEND_CONTAINER_NAME=dockeropt_frontend
FRONTEND_HOST_PORT=3000
DOCKEROPT_FRONTEND_API_URL=http://localhost:5000

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
            echo "--> Fichier .env généré automatiquement."
        '''
    }
}

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
                script {
                    echo "=== [PHASE 1] Récupération du code source ==="
                    checkout scm
                }
            }
        }

        stage('Environment Setup') {
            steps {
                script {
                    echo "=== [PHASE 2] Génération automatique de la configuration .env ==="
                    createEnvFile()
                }
            }
        }

        stage('Validate Docker Config') {
            steps {
                echo "=== [PHASE 3] Validation de la configuration Docker Compose ==="
                sh 'docker compose --env-file .env config'
            }
        }

        stage('Build Docker Images') {
            steps {
                echo "=== [PHASE 4] Construction automatisée des images Docker ==="
                sh 'docker compose --env-file .env build'
            }
        }

        stage('Deploy Services') {
            steps {
                echo "=== [PHASE 5] Déploiement et recréation des conteneurs ==="
                sh 'docker compose --env-file .env up -d --force-recreate --remove-orphans'
            }
        }

        stage('Automated Healthcheck & Integration Test') {
            steps {
                echo "=== [PHASE 6] Test automatisé de santé et d'authentification ==="
                sh '''
                    echo "Attente du démarrage du backend (10 secondes)..."
                    sleep 10
                    
                    echo "Vérification du statut des conteneurs :"
                    docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"

                    echo "Test d'intégration automatisé (Login API)..."
                    HTTP_STATUS=$(curl -s -o response.json -w "%{http_code}" -X POST http://localhost:5000/api/auth/login \
                      -H "Content-Type: application/json" \
                      -d '{
                        "email": "'"${CRED_ADMIN_EMAIL}"'",
                        "password": "'"${CRED_ADMIN_PASSWORD}"'"
                      }')

                    echo "Code de réponse HTTP : $HTTP_STATUS"
                    cat response.json
                    rm -f response.json

                    if [ "$HTTP_STATUS" -ne 200 ]; then
                        echo "ERREUR : Le test d'authentification a échoué (Code HTTP: $HTTP_STATUS)"
                        exit 1
                    fi
                    
                    echo "--> Authentification validée avec succès dans le pipeline !"
                '''
            }
        }
    }

    post {
        success {
            echo '==========================================='
            echo '   DEPLOIEMENT ET TESTS CI/CD : SUCCÈS !'
            echo '==========================================='
        }

        failure {
            echo '==========================================='
            echo '   DEPLOIEMENT OU TEST CI/CD : ÉCHEC !'
            echo '==========================================='
            sh 'docker logs dockeropt_backend --tail 50 || true'
        }

        always {
            sh 'rm -f .env .env.jenkins || true'
        }
    }
}