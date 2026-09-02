pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'dockeropt'
        DEPLOY_DIR = '/opt/dockeropt'
    }

    stages {

        // ==========================================================
        // 1. CHECKOUT
        // ==========================================================

        stage('Checkout') {
            steps {
                checkout scm
            }
        }


        // ==========================================================
        // 2. PREPARE ENVIRONMENT
        // ==========================================================

        stage('Prepare Environment') {
            steps {

                withCredentials([
                    string(
                        credentialsId: 'POSTGRES_HOST_ID',
                        variable: 'CRED_POSTGRES_HOST'
                    ),

                    string(
                        credentialsId: 'POSTGRES_PORT_ID',
                        variable: 'CRED_POSTGRES_PORT'
                    ),

                    string(
                        credentialsId: 'POSTGRES_USER_ID',
                        variable: 'CRED_POSTGRES_USER'
                    ),

                    string(
                        credentialsId: 'POSTGRES_PASSWORD_ID',
                        variable: 'CRED_POSTGRES_PASSWORD'
                    ),

                    string(
                        credentialsId: 'DOCKEROPT_ADMIN_EMAIL_ID',
                        variable: 'CRED_ADMIN_EMAIL'
                    ),

                    string(
                        credentialsId: 'DOCKEROPT_ADMIN_PASSWORD_ID',
                        variable: 'CRED_ADMIN_PASSWORD'
                    ),

                    string(
                        credentialsId: 'DOCKEROPT_JWT_SECRET_ID',
                        variable: 'CRED_JWT_SECRET'
                    ),

                    string(
                        credentialsId: 'DOCKEROPT_SMTP_USER_ID',
                        variable: 'CRED_SMTP_USER'
                    ),

                    string(
                        credentialsId: 'DOCKEROPT_SMTP_PASSWORD_ID',
                        variable: 'CRED_SMTP_PASSWORD'
                    ),

                    string(
                        credentialsId: 'DOCKEROPT_SMTP_FROM_ID',
                        variable: 'CRED_SMTP_FROM'
                    ),

                    string(
                        credentialsId: 'DOCKEROPT_ALERT_EMAIL_ID',
                        variable: 'CRED_ALERT_EMAIL'
                    )
                ]) {

                    sh '''
                        set +x

                        cat > .env.jenkins <<EOF

POSTGRES_HOST=${CRED_POSTGRES_HOST}
POSTGRES_PORT=${CRED_POSTGRES_PORT}
POSTGRES_USER=${CRED_POSTGRES_USER}
POSTGRES_PASSWORD=${CRED_POSTGRES_PASSWORD}
POSTGRES_DB=dockeropt

DB_HOST=${CRED_POSTGRES_HOST}
DB_PORT=${CRED_POSTGRES_PORT}
DB_NAME=dockeropt
DB_USER=${CRED_POSTGRES_USER}
DB_PASSWORD=${CRED_POSTGRES_PASSWORD}

ADMIN_EMAIL=${CRED_ADMIN_EMAIL}
ADMIN_PASSWORD=${CRED_ADMIN_PASSWORD}

JWT_SECRET=${CRED_JWT_SECRET}

SMTP_USER=${CRED_SMTP_USER}
SMTP_PASSWORD=${CRED_SMTP_PASSWORD}
SMTP_FROM=${CRED_SMTP_FROM}

ALERT_EMAIL_TO=${CRED_ALERT_EMAIL}

EOF

                        chmod 600 .env.jenkins
                    '''
                }
            }
        }


        // ==========================================================
        // 3. BUILD
        // ==========================================================

        stage('Build Docker Images') {
            steps {
                sh '''
                    set -e

                    docker compose \
                        --env-file .env \
                        --env-file .env.jenkins \
                        build
                '''
            }
        }


        // ==========================================================
        // 4. DEPLOY
        // ==========================================================

        stage('Deploy') {
            steps {
                sh '''
                    set -e

                    docker compose \
                        --env-file .env \
                        --env-file .env.jenkins \
                        up -d --remove-orphans
                '''
            }
        }


        // ==========================================================
        // 5. VERIFY
        // ==========================================================

        stage('Verify Containers') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "DOCKEROPT CONTAINERS"
                    echo "=========================================="

                    docker compose \
                        --env-file .env \
                        --env-file .env.jenkins \
                        ps

                    echo ""
                    echo "=========================================="
                    echo "DOCKER CONTAINERS"
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

        success {
            echo '=========================================='
            echo 'DockerOpt deployment SUCCESS'
            echo '=========================================='
        }

        failure {
            echo '=========================================='
            echo 'DockerOpt deployment FAILED'
            echo '=========================================='
        }

        always {
            sh '''
                rm -f .env.jenkins || true
            '''

            cleanWs()
        }
    }
}