#!/bin/bash

# Shop Health Check Script
# Comprehensive health check for the bakery shop (Next.js) service
# Version: 1.0.0

set -e

# Configuration
SHOP_BASE_URL="${SHOP_BASE_URL:-http://localhost:3000}"
API_BASE_URL="${API_BASE_URL:-http://localhost:5000}"
TIMEOUT=5
CRITICAL_PAGES=(
    "/"
    "/products"
    "/cart"
    "/bestellen"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Health status
HEALTH_STATUS="healthy"
HEALTH_DETAILS=""

# Function to check page load
check_page() {
    local path="$1"
    local url="${SHOP_BASE_URL}${path}"
    
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

# Function to check static assets
check_static_assets() {
    local url="${SHOP_BASE_URL}/_next/static/"
    
    # Try to access Next.js build ID
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "${SHOP_BASE_URL}/_next/static/chunks/webpack.js" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]] || [[ "$response" == "304" ]]; then
        echo -e "${GREEN}✓${NC} Static assets accessible"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Static assets check inconclusive"
        return 1
    fi
}

# Function to check API connectivity
check_api_connectivity() {
    # Check if shop can reach API
    local health_check=$(curl -s --connect-timeout $TIMEOUT "${API_BASE_URL}/health" 2>/dev/null || echo "error")
    
    if [[ "$health_check" == *"healthy"* ]] || [[ "$health_check" == *"ok"* ]]; then
        echo -e "${GREEN}✓${NC} API connectivity - OK"
        return 0
    else
        echo -e "${RED}✗${NC} API connectivity - Failed"
        HEALTH_STATUS="degraded"
        HEALTH_DETAILS+="Cannot reach API backend; "
        return 1
    fi
}

# Function to check page performance
check_page_performance() {
    local path="$1"
    local max_time="${2:-3000}" # milliseconds
    local url="${SHOP_BASE_URL}${path}"
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "999")
    response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
    
    if [[ $response_time_ms -lt $max_time ]]; then
        echo -e "${GREEN}✓${NC} $path load time - ${response_time_ms}ms"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $path load time - ${response_time_ms}ms (threshold: ${max_time}ms)"
        if [[ $response_time_ms -gt $((max_time * 2)) ]]; then
            HEALTH_STATUS="degraded"
            HEALTH_DETAILS+="Slow page load on $path; "
        fi
        return 1
    fi
}

# Function to check Next.js API routes
check_nextjs_api() {
    # Check if Next.js API routes are working
    local api_route="${SHOP_BASE_URL}/api/health"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$api_route" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]]; then
        echo -e "${GREEN}✓${NC} Next.js API routes - OK"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Next.js API routes - Not configured"
        return 1
    fi
}

# Function to check memory usage
check_memory_usage() {
    # Get PM2 process info
    if command -v pm2 &> /dev/null; then
        memory_usage=$(pm2 jlist | jq -r '.[] | select(.name=="bakery-shop") | .monit.memory' 2>/dev/null || echo "0")
        memory_mb=$((memory_usage / 1024 / 1024))
        max_memory=800 # MB
        
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
    echo "Shop Health Check"
    echo "======================================"
    echo "Target: $SHOP_BASE_URL"
    echo "Time: $(date)"
    echo ""
    
    # Check critical pages
    echo "Checking critical pages:"
    for page in "${CRITICAL_PAGES[@]}"; do
        check_page "$page"
    done
    echo ""
    
    # Check static assets
    echo "Checking static assets:"
    check_static_assets
    echo ""
    
    # Check API connectivity
    echo "Checking backend connectivity:"
    check_api_connectivity
    echo ""
    
    # Check performance
    echo "Checking page performance:"
    check_page_performance "/" 2000
    check_page_performance "/products" 3000
    echo ""
    
    # Check Next.js API
    echo "Checking Next.js internals:"
    check_nextjs_api
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
    "service": "bakery-shop",
    "status": "$HEALTH_STATUS",
    "timestamp": "$timestamp",
    "details": "$HEALTH_DETAILS",
    "checks": {
        "pages": $(check_page "/" >/dev/null 2>&1 && echo "true" || echo "false"),
        "assets": $(check_static_assets >/dev/null 2>&1 && echo "true" || echo "false"),
        "api": $(check_api_connectivity >/dev/null 2>&1 && echo "true" || echo "false"),
        "performance": $(check_page_performance "/" 2000 >/dev/null 2>&1 && echo "true" || echo "false")
    }
}
EOF
        ;;
    --nagios)
        # Nagios-compatible output
        main >/dev/null 2>&1
        case "$HEALTH_STATUS" in
            "healthy") echo "OK - Shop is healthy"; exit 0 ;;
            "degraded") echo "WARNING - Shop is degraded: $HEALTH_DETAILS"; exit 1 ;;
            "unhealthy") echo "CRITICAL - Shop is unhealthy: $HEALTH_DETAILS"; exit 2 ;;
        esac
        ;;
    *)
        main
        ;;
esac