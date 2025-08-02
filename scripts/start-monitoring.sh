#!/bin/bash

# Start Monitoring Stack for Bakery System
# This script starts the complete monitoring infrastructure

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Bakery Monitoring Stack..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to project root
cd "$PROJECT_ROOT"

# Create necessary directories if they don't exist
echo "📁 Creating monitoring directories..."
mkdir -p monitoring/prometheus/alerts
mkdir -p monitoring/grafana/dashboards
mkdir -p logs

# Check if docker-compose.monitoring.yml exists
if [ ! -f "docker-compose.monitoring.yml" ]; then
    echo "❌ docker-compose.monitoring.yml not found!"
    exit 1
fi

# Stop any existing monitoring containers
echo "🛑 Stopping existing monitoring containers..."
docker-compose -f docker-compose.monitoring.yml down 2>/dev/null || true

# Start monitoring stack
echo "🔧 Starting monitoring services..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

services=(
    "prometheus:9090"
    "grafana:3000"
    "jaeger:16686"
    "alertmanager:9093"
    "loki:3100"
)

all_healthy=true
for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" | grep -q "200\|302"; then
        echo "✅ $name is healthy (http://localhost:$port)"
    else
        echo "❌ $name is not responding on port $port"
        all_healthy=false
    fi
done

if [ "$all_healthy" = true ]; then
    echo ""
    echo "🎉 Monitoring stack started successfully!"
    echo ""
    echo "📊 Access points:"
    echo "   Grafana:      http://localhost:3001 (admin/admin)"
    echo "   Prometheus:   http://localhost:9090"
    echo "   Jaeger:       http://localhost:16686"
    echo "   AlertManager: http://localhost:9093"
    echo ""
    echo "📈 Metrics endpoint: http://localhost:5000/metrics"
    echo "🏥 Health check:     http://localhost:5000/health"
    echo ""
    echo "💡 Tip: Import the pre-configured dashboards in Grafana!"
else
    echo ""
    echo "⚠️  Some services failed to start. Check logs with:"
    echo "   docker-compose -f docker-compose.monitoring.yml logs"
fi