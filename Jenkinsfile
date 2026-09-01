pipeline {
    agent any

    environment {
        // --- SECRETS JENKINS ---
        DB_HOST                     = credentials('POSTGRES_HOST_ID')
        DB_PORT                     = credentials('POSTGRES_PORT_ID')
        DB_USER                     = credentials('POSTGRES_USER_ID')
        DB_PASSWORD                 = credentials('POSTGRES_PASSWORD_ID')
        
        ADMIN_EMAIL                 = credentials('DOCKEROPT_ADMIN_EMAIL_ID')
        ADMIN_PASSWORD              = credentials('DOCKEROPT_ADMIN_PASSWORD_ID')
        JWT_SECRET                  = credentials('DOCKEROPT_JWT_SECRET_ID')
        
        SMTP_USER                   = credentials('DOCKEROPT_SMTP_USER_ID')
        SMTP_PASSWORD               = credentials('DOCKEROPT_SMTP_PASSWORD_ID')
        SMTP_FROM                   = credentials('DOCKEROPT_SMTP_FROM_ID')
        ALERT_EMAIL_TO              = credentials('DOCKEROPT_ALERT_EMAIL_ID')

        // --- CONFIGURATION GLOBAL & RESEAU ---
        DOCKEROPT_NETWORK_NAME      = 'dockeropt-network'
        DOCKEROPT_NETWORK_SUBNET    = '172.28.0.0/16'
        PROMETHEUS_DATA_VOLUME      = 'prometheus-data'
        DB_NAME                     = 'dockeropt'
        DB_POOL_MAX                 = '10'

        // --- PORTS ---
        API_GATEWAY_PORT            = '5001'
        USER_SERVICE_PORT           = '5002'
        PRODUCT_SERVICE_PORT        = '5003'
        NOTIFICATION_SERVICE_PORT   = '5004'
        NODE_EXPORTER_PORT          = '9100'
        CADVISOR_HOST_PORT          = '8081'
        PROMETHEUS_PORT             = '9090'
        BACKEND_HOST_PORT           = '5000'
        FRONTEND_HOST_PORT          = '80'
        SMTP_PORT                   = '587'
        SMTP_SECURE                 = 'false'
        SMTP_HOST                   = 'smtp.gmail.com'

        // --- NAMES & IMAGES ---
        API_GATEWAY_CONTAINER_NAME          = 'api-gateway'
        USER_SERVICE_CONTAINER_NAME         = 'user-service'
        PRODUCT_SERVICE_CONTAINER_NAME      = 'product-service'
        NOTIFICATION_SERVICE_CONTAINER_NAME = 'notification-service'
        NODE_EXPORTER_CONTAINER_NAME        = 'node-exporter'
        CADVISOR_CONTAINER_NAME             = 'cadvisor'
        PROMETHEUS_CONTAINER_NAME           = 'prometheus'
        DOCKEROPT_BACKEND_CONTAINER_NAME    = 'dockeropt-backend'
        DOCKEROPT_FRONTEND_CONTAINER_NAME   = 'dockeropt-frontend'

        NODE_EXPORTER_IMAGE         = 'prom/node-exporter:latest'
        CADVISOR_IMAGE              = 'gcr.io/cadvisor/cadvisor:latest'
        PROMETHEUS_IMAGE            = 'prom/prometheus:latest'
        DOCKEROPT_BACKEND_IMAGE     = "dockeropt-backend:${BUILD_NUMBER}"
        DOCKEROPT_FRONTEND_IMAGE    = "dockeropt-frontend:${BUILD_NUMBER}"

        // --- CONTEXTES DE BUILD (CHEMINS) ---
        API_GATEWAY_IMAGE           = './api-gateway'
        USER_SERVICE_IMAGE          = './user-service'
        PRODUCT_SERVICE_IMAGE       = './product-service'
        NOTIFICATION_SERVICE_IMAGE  = './notification-service'
        DOCKEROPT_BACKEND_BUILD     = './backend'
        DOCKEROPT_FRONTEND_BUILD    = './frontend'

        // --- URLS DES SERVICES ---
        API_GATEWAY_USER_SERVICE_URL         = 'http://user-service:5002'
        API_GATEWAY_PRODUCT_SERVICE_URL      = 'http://product-service:5003'
        API_GATEWAY_NOTIFICATION_SERVICE_URL = 'http://notification-service:5004'
        PROMETHEUS_URL                       = 'http://prometheus:9090'
        DOCKEROPT_FRONTEND_API_URL           = 'http://192.168.1.201:5000'

        // --- LIMITES RESSOURCES & PROMETHEUS ---
        API_GATEWAY_CPUS            = '0.5'
        API_GATEWAY_MEM_LIMIT       = '512M'
        USER_SERVICE_CPUS           = '0.5'
        USER_SERVICE_MEM_LIMIT      = '512M'
        PRODUCT_SERVICE_CPUS        = '0.5'
        PRODUCT_SERVICE_MEM_LIMIT   = '512M'
        NOTIFICATION_SERVICE_CPUS   = '0.5'
        NOTIFICATION_SERVICE_MEM_LIMIT = '512M'
        PROMETHEUS_RETENTION        = '15d'
    }

    stages {
        stage('Deploy with Docker Compose') {
            steps {
                script {
                    // Calcul dynamique du DATABASE_URL pour PostgreSQL distant
                    def DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
                    
                    sh """
                        export DATABASE_URL="${DATABASE_URL}"
                        
                        # Arrêt et re-déploiement du stack Docker
                        docker compose down --remove-orphans || true
                        docker compose up -d --build
                    """
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}