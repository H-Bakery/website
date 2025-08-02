#!/bin/bash

# API Health Check Script
# Comprehensive health check for the bakery API service
# Version: 1.0.0

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:5000}"
TIMEOUT=5
CRITICAL_ENDPOINTS=(
    "/health"
    "/api/products"
    "/api/auth/status"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Health status
HEALTH_STATUS="healthy"
HEALTH_DETAILS=""

# Function to check endpoint
check_endpoint() {
    local endpoint="$1"
    local expected_status="${2:-200}"
    local url="${API_BASE_URL}${endpoint}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "000")
    
    if [[ "$response" == "$expected_status" ]]; then
        echo -e "${GREEN}✓${NC} $endpoint - HTTP $response"
        return 0
    else
        echo -e "${RED}✗${NC} $endpoint - HTTP $response (expected $expected_status)"
        HEALTH_STATUS="unhealthy"
        HEALTH_DETAILS+="$endpoint failed with HTTP $response; "
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    local db_check_endpoint="/api/health/db"
    local url="${API_BASE_URL}${db_check_endpoint}"
    
    response=$(curl -s --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo '{"status":"error"}')
    db_status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [[ "$db_status" == "connected" ]] || [[ "$db_status" == "ok" ]]; then
        echo -e "${GREEN}✓${NC} Database connectivity - OK"
        return 0
    else
        echo -e "${RED}✗${NC} Database connectivity - Failed"
        HEALTH_STATUS="unhealthy"
        HEALTH_DETAILS+="Database connection failed; "
        return 1
    fi
}

# Function to check response time
check_response_time() {
    local endpoint="$1"
    local max_time="${2:-2000}" # milliseconds
    local url="${API_BASE_URL}${endpoint}"
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "999")
    response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
    
    if [[ $response_time_ms -lt $max_time ]]; then
        echo -e "${GREEN}✓${NC} $endpoint response time - ${response_time_ms}ms"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $endpoint response time - ${response_time_ms}ms (threshold: ${max_time}ms)"
        if [[ $response_time_ms -gt $((max_time * 2)) ]]; then
            HEALTH_STATUS="degraded"
            HEALTH_DETAILS+="Slow response time on $endpoint; "
        fi
        return 1
    fi
}

# Function to check memory usage
check_memory_usage() {
    # Get PM2 process info
    if command -v pm2 &> /dev/null; then
        memory_usage=$(pm2 jlist | jq -r '.[] | select(.name=="bakery-api") | .monit.memory' 2>/dev/null || echo "0")
        memory_mb=$((memory_usage / 1024 / 1024))
        max_memory=500 # MB
        
        if [[ $memory_mb -lt $max_memory ]]; then
            echo -e "${GREEN}✓${NC} Memory usage - ${memory_mb}MB"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} Memory usage - ${memory_mb}MB (threshold: ${max_memory}MB)"
            if [[ $memory_mb -gt $((max_memory * 2)) ]]; then
                HEALTH_STATUS="degraded"
                HEALTH_DETAILS+="High memory usage: ${memory_mb}MB; "
            fi
            return 1
        fi
    fi
}

# Main health check
main() {
    echo "======================================"
    echo "API Health Check"
    echo "======================================"
    echo "Target: $API_BASE_URL"
    echo "Time: $(date)"
    echo ""
    
    # Check critical endpoints
    echo "Checking critical endpoints:"
    for endpoint in "${CRITICAL_ENDPOINTS[@]}"; do
        check_endpoint "$endpoint"
    done
    echo ""
    
    # Check database
    echo "Checking database connectivity:"
    check_database
    echo ""
    
    # Check response times
    echo "Checking response times:"
    check_response_time "/api/products" 1000
    echo ""
    
    # Check memory usage
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
        # Output JSON format for monitoring systems
        timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        cat << EOF
{
    "service": "bakery-api",
    "status": "$HEALTH_STATUS",
    "timestamp": "$timestamp",
    "details": "$HEALTH_DETAILS",
    "checks": {
        "endpoints": $(check_endpoint "/health" >/dev/null 2>&1 && echo "true" || echo "false"),
        "database": $(check_database >/dev/null 2>&1 && echo "true" || echo "false"),
        "performance": $(check_response_time "/api/products" 1000 >/dev/null 2>&1 && echo "true" || echo "false")
    }
}
EOF
        ;;
    --nagios)
        # Nagios-compatible output
        main >/dev/null 2>&1
        case "$HEALTH_STATUS" in
            "healthy") echo "OK - API is healthy"; exit 0 ;;
            "degraded") echo "WARNING - API is degraded: $HEALTH_DETAILS"; exit 1 ;;
            "unhealthy") echo "CRITICAL - API is unhealthy: $HEALTH_DETAILS"; exit 2 ;;
        esac
        ;;
    *)
        main
        ;;
esac