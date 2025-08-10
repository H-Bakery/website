#!/bin/bash

# Landing Page Health Check Script
# Health check for the static bakery landing page
# Version: 1.0.0

set -e

# Configuration
LANDING_BASE_URL="${LANDING_BASE_URL:-http://localhost:3002}"
TIMEOUT=5
CRITICAL_ASSETS=(
    "/"
    "/index.html"
    "/favicon.ico"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Health status
HEALTH_STATUS="healthy"
HEALTH_DETAILS=""

# Function to check static asset
check_asset() {
    local path="$1"
    local url="${LANDING_BASE_URL}${path}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]] || [[ "$response" == "304" ]]; then
        echo -e "${GREEN}✓${NC} $path - HTTP $response"
        return 0
    else
        echo -e "${RED}✗${NC} $path - HTTP $response"
        HEALTH_STATUS="unhealthy"
        HEALTH_DETAILS+="$path failed with HTTP $response; "
        return 1
    fi
}

# Function to check response time
check_response_time() {
    local path="$1"
    local max_time="${2:-1000}" # milliseconds (faster for static)
    local url="${LANDING_BASE_URL}${path}"
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "999")
    response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
    
    if [[ $response_time_ms -lt $max_time ]]; then
        echo -e "${GREEN}✓${NC} $path load time - ${response_time_ms}ms"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $path load time - ${response_time_ms}ms (threshold: ${max_time}ms)"
        HEALTH_STATUS="degraded"
        HEALTH_DETAILS+="Slow response on $path; "
        return 1
    fi
}

# Function to check memory usage (for static server)
check_memory_usage() {
    # Get PM2 process info
    if command -v pm2 &> /dev/null; then
        memory_usage=$(pm2 jlist | jq -r '.[] | select(.name=="bakery-landing") | .monit.memory' 2>/dev/null || echo "0")
        memory_mb=$((memory_usage / 1024 / 1024))
        max_memory=200 # MB (low for static serving)
        
        if [[ $memory_mb -lt $max_memory ]]; then
            echo -e "${GREEN}✓${NC} Memory usage - ${memory_mb}MB"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} Memory usage - ${memory_mb}MB (threshold: ${max_memory}MB)"
            HEALTH_STATUS="degraded"
            HEALTH_DETAILS+="High memory usage: ${memory_mb}MB; "
            return 1
        fi
    fi
}

# Main health check
main() {
    echo "======================================"
    echo "Landing Page Health Check"
    echo "======================================"
    echo "Target: $LANDING_BASE_URL"
    echo "Time: $(date)"
    echo ""
    
    # Check critical assets
    echo "Checking critical assets:"
    for asset in "${CRITICAL_ASSETS[@]}"; do
        check_asset "$asset"
    done
    echo ""
    
    # Check performance
    echo "Checking performance:"
    check_response_time "/" 500
    echo ""
    
    # Check resource usage
    echo "Checking resource usage:"
    check_memory_usage
    echo ""
    
    # Summary
    echo "======================================"
    echo -n "Overall Health Status: "
    
    case "$HEALTH_STATUS" in
        "healthy")
            echo -e "${GREEN}HEALTHY${NC}"
            exit 0
            ;;
        "degraded")
            echo -e "${YELLOW}DEGRADED${NC}"
            echo "Issues: $HEALTH_DETAILS"
            exit 1
            ;;
        "unhealthy")
            echo -e "${RED}UNHEALTHY${NC}"
            echo "Issues: $HEALTH_DETAILS"
            exit 2
            ;;
    esac
}

# Handle arguments
case "${1:-}" in
    --json)
        # Output JSON format
        timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        cat << EOF
{
    "service": "bakery-landing",
    "status": "$HEALTH_STATUS",
    "timestamp": "$timestamp",
    "details": "$HEALTH_DETAILS",
    "checks": {
        "assets": $(check_asset "/" >/dev/null 2>&1 && echo "true" || echo "false"),
        "performance": $(check_response_time "/" 500 >/dev/null 2>&1 && echo "true" || echo "false")
    }
}
EOF
        ;;
    --nagios)
        # Nagios-compatible output
        main >/dev/null 2>&1
        case "$HEALTH_STATUS" in
            "healthy") echo "OK - Landing page is healthy"; exit 0 ;;
            "degraded") echo "WARNING - Landing page is degraded: $HEALTH_DETAILS"; exit 1 ;;
            "unhealthy") echo "CRITICAL - Landing page is unhealthy: $HEALTH_DETAILS"; exit 2 ;;
        esac
        ;;
    *)
        main
        ;;
esac