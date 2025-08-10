#!/bin/bash

# All Services Health Check Script
# Orchestrates health checks for all bakery services
# Version: 1.0.0

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES=(
    "bakery-api:5000:api-health.sh"
    "bakery-shop:3000:shop-health.sh"
    "bakery-management:3001:management-health.sh"
    "bakery-landing:3002:landing-health.sh"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Overall status
OVERALL_STATUS="healthy"
FAILED_SERVICES=()
DEGRADED_SERVICES=()

# Function to check service
check_service() {
    local service_info="$1"
    IFS=':' read -r service_name port health_script <<< "$service_info"
    
    echo -e "${BLUE}Checking $service_name...${NC}"
    
    # Check if health script exists
    if [[ ! -f "$SCRIPT_DIR/$health_script" ]]; then
        # Use generic check if specific script doesn't exist
        if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:$port/health" 2>/dev/null | grep -q "200\|404"; then
            echo -e "${GREEN}✓${NC} $service_name is responding on port $port"
            return 0
        else
            echo -e "${RED}✗${NC} $service_name is not responding on port $port"
            FAILED_SERVICES+=("$service_name")
            OVERALL_STATUS="unhealthy"
            return 1
        fi
    fi
    
    # Run specific health check
    if "$SCRIPT_DIR/$health_script" > /tmp/${service_name}_health.log 2>&1; then
        echo -e "${GREEN}✓${NC} $service_name is healthy"
        return 0
    else
        exit_code=$?
        if [[ $exit_code -eq 1 ]]; then
            echo -e "${YELLOW}⚠${NC} $service_name is degraded"
            DEGRADED_SERVICES+=("$service_name")
            if [[ "$OVERALL_STATUS" != "unhealthy" ]]; then
                OVERALL_STATUS="degraded"
            fi
        else
            echo -e "${RED}✗${NC} $service_name is unhealthy"
            FAILED_SERVICES+=("$service_name")
            OVERALL_STATUS="unhealthy"
        fi
        
        # Show last few lines of health check output
        echo "  Details:"
        tail -5 /tmp/${service_name}_health.log | sed 's/^/    /'
        return 1
    fi
}

# Function to check nginx
check_nginx() {
    echo -e "${BLUE}Checking nginx...${NC}"
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✓${NC} nginx is active"
        
        # Check if nginx is responding
        if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost/health" 2>/dev/null | grep -q "200"; then
            echo -e "${GREEN}✓${NC} nginx is responding to health checks"
        else
            echo -e "${YELLOW}⚠${NC} nginx is active but health endpoint not configured"
        fi
    else
        echo -e "${RED}✗${NC} nginx is not active"
        FAILED_SERVICES+=("nginx")
        OVERALL_STATUS="unhealthy"
    fi
}

# Function to check PM2
check_pm2() {
    echo -e "${BLUE}Checking PM2...${NC}"
    
    if command -v pm2 &> /dev/null; then
        if pm2 ping > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} PM2 daemon is running"
            
            # Check PM2 processes
            running_processes=$(pm2 jlist | jq -r '.[] | select(.pm2_env.status=="online") | .name' 2>/dev/null | wc -l || echo "0")
            total_processes=$(pm2 jlist | jq -r '.[] | .name' 2>/dev/null | wc -l || echo "0")
            
            if [[ $running_processes -eq $total_processes ]] && [[ $total_processes -gt 0 ]]; then
                echo -e "${GREEN}✓${NC} All PM2 processes are online ($running_processes/$total_processes)"
            elif [[ $running_processes -gt 0 ]]; then
                echo -e "${YELLOW}⚠${NC} Some PM2 processes are offline ($running_processes/$total_processes online)"
                if [[ "$OVERALL_STATUS" != "unhealthy" ]]; then
                    OVERALL_STATUS="degraded"
                fi
            else
                echo -e "${RED}✗${NC} No PM2 processes are running"
                OVERALL_STATUS="unhealthy"
            fi
        else
            echo -e "${RED}✗${NC} PM2 daemon is not running"
            OVERALL_STATUS="unhealthy"
        fi
    else
        echo -e "${YELLOW}⚠${NC} PM2 is not installed"
    fi
}

# Function to check database
check_database() {
    echo -e "${BLUE}Checking database...${NC}"
    
    DB_PATH="/home/bakery/bakery/data/bakery.db"
    
    if [[ -f "$DB_PATH" ]]; then
        echo -e "${GREEN}✓${NC} Database file exists"
        
        # Check if database is accessible
        if command -v sqlite3 &> /dev/null; then
            if sqlite3 "$DB_PATH" "SELECT 1;" > /dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} Database is accessible"
                
                # Get database size
                db_size=$(du -h "$DB_PATH" | cut -f1)
                echo "  Size: $db_size"
            else
                echo -e "${RED}✗${NC} Database is corrupted or inaccessible"
                OVERALL_STATUS="unhealthy"
            fi
        fi
    else
        echo -e "${RED}✗${NC} Database file not found"
        OVERALL_STATUS="unhealthy"
    fi
}

# Function to generate summary
generate_summary() {
    echo ""
    echo "======================================"
    echo "Health Check Summary"
    echo "======================================"
    echo "Time: $(date)"
    echo ""
    
    echo -n "Overall Status: "
    case "$OVERALL_STATUS" in
        "healthy")
            echo -e "${GREEN}HEALTHY${NC}"
            echo "All services are operating normally."
            ;;
        "degraded")
            echo -e "${YELLOW}DEGRADED${NC}"
            echo "Some services are experiencing issues."
            if [[ ${#DEGRADED_SERVICES[@]} -gt 0 ]]; then
                echo "Degraded services: ${DEGRADED_SERVICES[*]}"
            fi
            ;;
        "unhealthy")
            echo -e "${RED}UNHEALTHY${NC}"
            echo "Critical services are down!"
            if [[ ${#FAILED_SERVICES[@]} -gt 0 ]]; then
                echo "Failed services: ${FAILED_SERVICES[*]}"
            fi
            ;;
    esac
    
    echo ""
    echo "Recommendations:"
    
    if [[ "$OVERALL_STATUS" == "unhealthy" ]]; then
        echo "1. Check service logs: pm2 logs"
        echo "2. Restart failed services: pm2 restart <service-name>"
        echo "3. Check system resources: htop"
        echo "4. Review nginx error logs: tail -f /var/log/nginx/error.log"
    elif [[ "$OVERALL_STATUS" == "degraded" ]]; then
        echo "1. Monitor degraded services closely"
        echo "2. Check for high resource usage"
        echo "3. Review application logs for errors"
    else
        echo "1. Continue regular monitoring"
        echo "2. Review performance metrics"
    fi
}

# Main function
main() {
    echo "======================================"
    echo "Bakery System Health Check"
    echo "======================================"
    echo ""
    
    # Check infrastructure
    echo "Infrastructure Checks:"
    echo "----------------------"
    check_nginx
    check_pm2
    check_database
    echo ""
    
    # Check services
    echo "Service Checks:"
    echo "---------------"
    for service in "${SERVICES[@]}"; do
        check_service "$service"
    done
    
    # Generate summary
    generate_summary
    
    # Exit with appropriate code
    case "$OVERALL_STATUS" in
        "healthy") exit 0 ;;
        "degraded") exit 1 ;;
        "unhealthy") exit 2 ;;
    esac
}

# Handle arguments
case "${1:-}" in
    --json)
        # JSON output for monitoring systems
        timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        
        # Run checks silently
        main > /tmp/health_check_output.log 2>&1
        
        cat << EOF
{
    "status": "$OVERALL_STATUS",
    "timestamp": "$timestamp",
    "failed_services": [$(printf '"%s",' "${FAILED_SERVICES[@]}" | sed 's/,$//')],
    "degraded_services": [$(printf '"%s",' "${DEGRADED_SERVICES[@]}" | sed 's/,$//')],
    "total_services": ${#SERVICES[@]}
}
EOF
        ;;
    --nagios)
        # Nagios-compatible output
        main > /tmp/health_check_output.log 2>&1
        
        case "$OVERALL_STATUS" in
            "healthy") 
                echo "OK - All services healthy"
                exit 0
                ;;
            "degraded") 
                echo "WARNING - Services degraded: ${DEGRADED_SERVICES[*]}"
                exit 1
                ;;
            "unhealthy") 
                echo "CRITICAL - Services failed: ${FAILED_SERVICES[*]}"
                exit 2
                ;;
        esac
        ;;
    --service)
        # Check specific service
        if [[ -z "$2" ]]; then
            echo "Usage: $0 --service <service-name>"
            exit 1
        fi
        
        for service in "${SERVICES[@]}"; do
            IFS=':' read -r service_name port health_script <<< "$service"
            if [[ "$service_name" == "$2" ]]; then
                check_service "$service"
                exit $?
            fi
        done
        
        echo "Unknown service: $2"
        exit 1
        ;;
    --help)
        echo "Usage: $0 [--json|--nagios|--service <name>|--help]"
        echo ""
        echo "Options:"
        echo "  --json     Output in JSON format"
        echo "  --nagios   Output in Nagios plugin format"
        echo "  --service  Check specific service only"
        echo "  --help     Show this help"
        exit 0
        ;;
    *)
        main
        ;;
esac