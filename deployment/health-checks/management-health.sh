#!/bin/bash

# Management System Health Check Script
# Comprehensive health check for the bakery management dashboard
# Version: 1.0.0

set -e

# Configuration
MANAGEMENT_BASE_URL="${MANAGEMENT_BASE_URL:-http://localhost:3001}"
API_BASE_URL="${API_BASE_URL:-http://localhost:5000}"
TIMEOUT=5
CRITICAL_PAGES=(
    "/admin"
    "/admin/orders"
    "/admin/inventory"
    "/admin/reports"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Health status
HEALTH_STATUS="healthy"
HEALTH_DETAILS=""

# Function to check page load (with auth consideration)
check_page() {
    local path="$1"
    local url="${MANAGEMENT_BASE_URL}${path}"
    
    # Management pages might redirect to login, which is still healthy
    response=$(curl -s -o /dev/null -w "%{http_code}" -L --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]] || [[ "$response" == "302" ]] || [[ "$response" == "301" ]]; then
        echo -e "${GREEN}✓${NC} $path - HTTP $response"
        return 0
    else
        echo -e "${RED}✗${NC} $path - HTTP $response"
        HEALTH_STATUS="unhealthy"
        HEALTH_DETAILS+="$path failed with HTTP $response; "
        return 1
    fi
}

# Function to check admin authentication
check_auth_system() {
    local login_url="${MANAGEMENT_BASE_URL}/admin/login"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$login_url" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]] || [[ "$response" == "302" ]]; then
        echo -e "${GREEN}✓${NC} Authentication system accessible"
        return 0
    else
        echo -e "${RED}✗${NC} Authentication system not accessible"
        HEALTH_STATUS="unhealthy"
        HEALTH_DETAILS+="Auth system unavailable; "
        return 1
    fi
}

# Function to check API connectivity for admin
check_admin_api() {
    # Check if management system can reach admin API endpoints
    local admin_api="${API_BASE_URL}/api/admin/health"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$admin_api" 2>/dev/null || echo "000")
    
    # Admin endpoints might return 401 without auth, which is still healthy
    if [[ "$response" == "200" ]] || [[ "$response" == "401" ]] || [[ "$response" == "403" ]]; then
        echo -e "${GREEN}✓${NC} Admin API endpoints reachable"
        return 0
    else
        echo -e "${RED}✗${NC} Admin API endpoints not reachable"
        HEALTH_STATUS="degraded"
        HEALTH_DETAILS+="Cannot reach admin API; "
        return 1
    fi
}

# Function to check static assets
check_static_assets() {
    local url="${MANAGEMENT_BASE_URL}/_next/static/"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "${MANAGEMENT_BASE_URL}/_next/static/chunks/webpack.js" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]] || [[ "$response" == "304" ]]; then
        echo -e "${GREEN}✓${NC} Static assets accessible"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Static assets check inconclusive"
        return 1
    fi
}

# Function to check session management
check_session_management() {
    # Try to access a protected resource and check for proper redirect
    local protected_url="${MANAGEMENT_BASE_URL}/admin/orders"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$protected_url" 2>/dev/null || echo "000")
    
    # Should redirect to login (302/301) or show page (200) if session exists
    if [[ "$response" == "200" ]] || [[ "$response" == "302" ]] || [[ "$response" == "301" ]]; then
        echo -e "${GREEN}✓${NC} Session management working"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Session management issue"
        return 1
    fi
}

# Function to check memory usage
check_memory_usage() {
    # Get PM2 process info
    if command -v pm2 &> /dev/null; then
        memory_usage=$(pm2 jlist | jq -r '.[] | select(.name=="bakery-management") | .monit.memory' 2>/dev/null || echo "0")
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

# Function to check response time
check_response_time() {
    local path="$1"
    local max_time="${2:-3000}" # milliseconds
    local url="${MANAGEMENT_BASE_URL}${path}"
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" -L --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "999")
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

# Main health check
main() {
    echo "======================================"
    echo "Management System Health Check"
    echo "======================================"
    echo "Target: $MANAGEMENT_BASE_URL"
    echo "Time: $(date)"
    echo ""
    
    # Check critical pages
    echo "Checking critical pages:"
    for page in "${CRITICAL_PAGES[@]}"; do
        check_page "$page"
    done
    echo ""
    
    # Check authentication
    echo "Checking authentication system:"
    check_auth_system
    check_session_management
    echo ""
    
    # Check API connectivity
    echo "Checking backend connectivity:"
    check_admin_api
    echo ""
    
    # Check static assets
    echo "Checking static assets:"
    check_static_assets
    echo ""
    
    # Check performance
    echo "Checking performance:"
    check_response_time "/admin" 3000
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
        # Output JSON format for monitoring systems
        timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        cat << EOF
{
    "service": "bakery-management",
    "status": "$HEALTH_STATUS",
    "timestamp": "$timestamp",
    "details": "$HEALTH_DETAILS",
    "checks": {
        "pages": $(check_page "/admin" >/dev/null 2>&1 && echo "true" || echo "false"),
        "auth": $(check_auth_system >/dev/null 2>&1 && echo "true" || echo "false"),
        "api": $(check_admin_api >/dev/null 2>&1 && echo "true" || echo "false"),
        "performance": $(check_response_time "/admin" 3000 >/dev/null 2>&1 && echo "true" || echo "false")
    }
}
EOF
        ;;
    --nagios)
        # Nagios-compatible output
        main >/dev/null 2>&1
        case "$HEALTH_STATUS" in
            "healthy") echo "OK - Management system is healthy"; exit 0 ;;
            "degraded") echo "WARNING - Management system is degraded: $HEALTH_DETAILS"; exit 1 ;;
            "unhealthy") echo "CRITICAL - Management system is unhealthy: $HEALTH_DETAILS"; exit 2 ;;
        esac
        ;;
    *)
        main
        ;;
esac