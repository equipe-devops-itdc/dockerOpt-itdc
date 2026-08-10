#!/bin/bash
# DockerOpt - Script d'arrêt de tous les services

CONTAINERS="dockeropt-frontend dockeropt-backend dockeropt-grafana dockeropt-prometheus dockeropt-cadvisor dockeropt-node-exporter dockeropt-notification-service dockeropt-product-service dockeropt-user-service dockeropt-api-gateway dockeropt-load-generator"

echo "🛑 Arrêt des services DockerOpt..."

for container in $CONTAINERS; do
    if docker ps -q -f name="$container" &>/dev/null; then
        echo "  Arrêt de $container..."
        docker rm -f "$container" 2>/dev/null || true
    fi
done

echo "✅ Tous les services arrêtés"
echo ""
echo "Pour supprimer les volumes : docker volume rm prometheus-data grafana-data"