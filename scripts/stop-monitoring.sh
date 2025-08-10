#!/bin/bash

# Stop Monitoring Stack for Bakery System

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🛑 Stopping Bakery Monitoring Stack..."

# Navigate to project root
cd "$PROJECT_ROOT"

# Check if docker-compose.monitoring.yml exists
if [ ! -f "docker-compose.monitoring.yml" ]; then
    echo "❌ docker-compose.monitoring.yml not found!"
    exit 1
fi

# Stop monitoring stack
docker-compose -f docker-compose.monitoring.yml down

echo "✅ Monitoring stack stopped successfully!"