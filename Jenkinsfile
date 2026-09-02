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
                        echo "Création du fichier .env temporaire..."

                        cat <<EOF > .env
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
EOF

                        chmod 600 .env
                        echo "Fichier .env créé avec succès."
                    '''
                }
            }
        }

        stage('Validate Docker Compose') {
            steps {
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
                sh '''
                    set -e
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