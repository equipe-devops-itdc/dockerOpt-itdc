#!/bin/bash
# DockerOpt - Script de démarrage de tous les services
# Use: sudo bash scripts/start-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "  DockerOpt - Démarrage de l'infrastructure"
echo "========================================="

# Vérifier Docker
if ! docker info &>/dev/null; then
    echo "❌ Docker n'est pas disponible"
    exit 1
fi

NETWORK="dockeropt-network"

# Créer le réseau si nécessaire
docker network inspect $NETWORK &>/dev/null || docker network create $NETWORK --subnet=172.20.0.0/16

# Créer les volumes
docker volume create prometheus-data &>/dev/null || true
docker volume create grafana-data &>/dev/null || true

# ==================== SERVICES ====================

declare -A SERVICES
SERVICES=(
    ["api-gateway"]="dockeropt-api-gateway:3000"
    ["user-service"]="dockeropt-user-service:3001"
    ["product-service"]="dockeropt-product-service:3002"
    ["notification-service"]="dockeropt-notification-service:3003"
)

echo ""
echo "📦 Démarrage des microservices..."

for service in "${!SERVICES[@]}"; do
    IFS=':' read -r name port <<< "${SERVICES[$service]}"
    echo "  → $name (port $port)"
    docker rm -f "$name" 2>/dev/null || true
    docker run -d \
        --name "$name" \
        --network "$NETWORK" \
        --restart unless-stopped \
        --memory="256m" \
        --cpus="0.5" \
        -p "$port:$port" \
        -e "PORT=$port" \
        "dockeropt-$service"
done

# ==================== MONITORING STACK ====================

echo ""
echo "📊 Démarrage de la stack de monitoring..."

# Node Exporter
docker rm -f dockeropt-node-exporter 2>/dev/null || true
docker run -d \
    --name dockeropt-node-exporter \
    --network "$NETWORK" \
    --restart unless-stopped \
    -p "9100:9100" \
    -v /proc:/host/proc:ro \
    -v /sys:/host/sys:ro \
    -v /:/rootfs:ro \
    prom/node-exporter:latest \
    --path.procfs=/host/proc \
    --path.sysfs=/host/sys \
    --path.rootfs=/rootfs \
    --collector.filesystem.mount-points-exclude='^/(sys|proc|dev|host|etc)($$|/)'
echo "  → node-exporter (port 9100)"

# cAdvisor
docker rm -f dockeropt-cadvisor 2>/dev/null || true
docker run -d \
    --name dockeropt-cadvisor \
    --network "$NETWORK" \
    --restart unless-stopped \
    --privileged \
    -p "8081:8080" \
    -v /:/rootfs:ro \
    -v /var/run:/var/run:ro \
    -v /sys:/sys:ro \
    -v /var/lib/docker/:/var/lib/docker:ro \
    -v /dev/disk/:/dev/disk:ro \
    gcr.io/cadvisor/cadvisor:latest
echo "  → cadvisor (port 8081)"

# Prometheus
docker rm -f dockeropt-prometheus 2>/dev/null || true
docker run -d \
    --name dockeropt-prometheus \
    --network "$NETWORK" \
    --restart unless-stopped \
    -p "9090:9090" \
    -v "$SCRIPT_DIR/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml" \
    -v "$SCRIPT_DIR/prometheus/alert.rules.yml:/etc/prometheus/alert.rules.yml" \
    -v prometheus-data:/prometheus \
    prom/prometheus:latest \
    --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.path=/prometheus \
    --storage.tsdb.retention.time=30d \
    --web.enable-lifecycle
echo "  → prometheus (port 9090)"

# Grafana
docker rm -f dockeropt-grafana 2>/dev/null || true
docker run -d \
    --name dockeropt-grafana \
    --network "$NETWORK" \
    --restart unless-stopped \
    -p "4000:3000" \
    -v "$SCRIPT_DIR/grafana/datasources:/etc/grafana/provisioning/datasources" \
    -v "$SCRIPT_DIR/grafana/dashboards:/etc/grafana/provisioning/dashboards" \
    -v "$SCRIPT_DIR/grafana/config.ini:/etc/grafana/config.ini" \
    -v grafana-data:/var/lib/grafana \
    -e GF_SECURITY_ADMIN_USER=admin \
    -e GF_SECURITY_ADMIN_PASSWORD=admin \
    grafana/grafana:latest
echo "  → grafana (port 4000, admin/admin)"

# ==================== DOCKEROPT PLATFORM ====================

echo ""
echo "⚡ Démarrage de DockerOpt Platform..."

# DockerOpt Backend
docker rm -f dockeropt-backend 2>/dev/null || true
docker run -d \
    --name dockeropt-backend \
    --network "$NETWORK" \
    --restart unless-stopped \
    -p "5000:5000" \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -e PORT=5000 \
    -e PROMETHEUS_URL=http://prometheus:9090 \
    dockeropt-backend
echo "  → dockeropt-backend (port 5000)"

# DockerOpt Frontend
docker rm -f dockeropt-frontend 2>/dev/null || true
docker run -d \
    --name dockeropt-frontend \
    --network "$NETWORK" \
    --restart unless-stopped \
    -p "8080:80" \
    -e API_URL=http://dockeropt-backend:5000 \
    dockeropt-frontend
echo "  → dockeropt-frontend (port 8080)"

echo ""
echo "========================================="
echo "  ✅ DockerOpt démarré !"
echo "========================================="
echo ""
echo "  Dashboard DockerOpt : http://localhost:8080"
echo "  Grafana             : http://localhost:4000 (admin/admin)"
echo "  Prometheus          : http://localhost:9090"
echo "  cAdvisor            : http://localhost:8081"
echo "  API Gateway         : http://localhost:3000"
echo "========================================="