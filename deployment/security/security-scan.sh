#!/bin/bash

# Security Scan Script
# Performs comprehensive security checks on the bakery system
# Version: 1.0.0

set -e

# Configuration
PROJECT_DIR="/home/bakery/bakery"
REPORT_DIR="/var/log/bakery/security"
TEMP_DIR="/tmp/bakery-security-scan"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Security status
SECURITY_STATUS="secure"
VULNERABILITIES=()
WARNINGS=()

# Initialize
mkdir -p "$REPORT_DIR" "$TEMP_DIR"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    WARNINGS+=("$1")
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] VULNERABILITY: $1${NC}"
    VULNERABILITIES+=("$1")
    SECURITY_STATUS="vulnerable"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Function to check npm vulnerabilities
check_npm_vulnerabilities() {
    log "Checking npm dependencies for vulnerabilities..."
    
    cd "$PROJECT_DIR"
    
    # Run npm audit
    if npm audit --json > "$TEMP_DIR/npm-audit.json" 2>/dev/null; then
        vulnerabilities=$(jq '.metadata.vulnerabilities | to_entries | map(select(.value > 0)) | length' "$TEMP_DIR/npm-audit.json")
        
        if [[ $vulnerabilities -gt 0 ]]; then
            critical=$(jq '.metadata.vulnerabilities.critical // 0' "$TEMP_DIR/npm-audit.json")
            high=$(jq '.metadata.vulnerabilities.high // 0' "$TEMP_DIR/npm-audit.json")
            moderate=$(jq '.metadata.vulnerabilities.moderate // 0' "$TEMP_DIR/npm-audit.json")
            low=$(jq '.metadata.vulnerabilities.low // 0' "$TEMP_DIR/npm-audit.json")
            
            error "Found $vulnerabilities npm vulnerabilities (Critical: $critical, High: $high, Moderate: $moderate, Low: $low)"
            
            # Show top vulnerabilities
            echo "Top vulnerabilities:"
            jq -r '.vulnerabilities | to_entries | .[] | select(.value.severity == "critical" or .value.severity == "high") | "  - \(.key): \(.value.severity) - \(.value.title)"' "$TEMP_DIR/npm-audit.json" 2>/dev/null | head -5
        else
            log "No npm vulnerabilities found"
        fi
    else
        warn "npm audit failed to run"
    fi
}

# Function to check for exposed secrets
check_exposed_secrets() {
    log "Checking for exposed secrets and credentials..."
    
    # Patterns to search for
    SECRET_PATTERNS=(
        "password.*=.*['\"].*['\"]"
        "api[_-]?key.*=.*['\"].*['\"]"
        "secret.*=.*['\"].*['\"]"
        "token.*=.*['\"].*['\"]"
        "private[_-]?key"
        "AWS_.*=.*"
        "GITHUB_.*=.*"
    )
    
    # Files to exclude
    EXCLUDE_PATTERNS=(
        "node_modules"
        ".git"
        "*.log"
        "*.md"
        "test"
        "spec"
    )
    
    # Build exclude arguments for grep
    EXCLUDE_ARGS=""
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        EXCLUDE_ARGS+=" --exclude-dir=$pattern"
    done
    
    # Search for secrets
    found_secrets=false
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if grep -r -i -E "$pattern" "$PROJECT_DIR" $EXCLUDE_ARGS > "$TEMP_DIR/found_secrets.txt" 2>/dev/null; then
            if [[ -s "$TEMP_DIR/found_secrets.txt" ]]; then
                found_secrets=true
                error "Potential exposed secrets found matching pattern: $pattern"
                echo "  Found in:"
                head -3 "$TEMP_DIR/found_secrets.txt" | sed 's/^/    /'
                echo "  ..."
            fi
        fi
    done
    
    if [[ "$found_secrets" == "false" ]]; then
        log "No exposed secrets found in code"
    fi
    
    # Check .env files
    find "$PROJECT_DIR" -name ".env*" -not -path "*/node_modules/*" | while read -r env_file; do
        if [[ -f "$env_file" ]]; then
            # Check if .env is in git
            if git -C "$(dirname "$env_file")" ls-files --error-unmatch "$(basename "$env_file")" &>/dev/null; then
                error ".env file is tracked in git: $env_file"
            fi
            
            # Check file permissions
            perms=$(stat -c %a "$env_file" 2>/dev/null || stat -f %A "$env_file")
            if [[ "${perms: -1}" != "0" ]]; then
                warn ".env file has world-readable permissions: $env_file ($perms)"
            fi
        fi
    done
}

# Function to check SSL/TLS configuration
check_ssl_configuration() {
    log "Checking SSL/TLS configuration..."
    
    # Check nginx SSL configuration
    if [[ -f "/etc/nginx/sites-enabled/bakery" ]]; then
        # Check for weak ciphers
        if grep -q "SSLv2\|SSLv3" /etc/nginx/sites-enabled/bakery; then
            error "Weak SSL protocols (SSLv2/SSLv3) enabled in nginx"
        fi
        
        # Check for HSTS
        if ! grep -q "Strict-Transport-Security" /etc/nginx/sites-enabled/bakery; then
            warn "HSTS (Strict-Transport-Security) header not configured"
        fi
        
        # Check SSL certificate expiry
        if command -v openssl &> /dev/null && [[ -f "/etc/letsencrypt/live/your-domain.com/cert.pem" ]]; then
            expiry_date=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/your-domain.com/cert.pem | cut -d= -f2)
            expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s)
            current_epoch=$(date +%s)
            days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [[ $days_until_expiry -lt 30 ]]; then
                if [[ $days_until_expiry -lt 7 ]]; then
                    error "SSL certificate expires in $days_until_expiry days!"
                else
                    warn "SSL certificate expires in $days_until_expiry days"
                fi
            else
                log "SSL certificate valid for $days_until_expiry more days"
            fi
        fi
    fi
}

# Function to check file permissions
check_file_permissions() {
    log "Checking file permissions..."
    
    # Check for world-writable files
    world_writable=$(find "$PROJECT_DIR" -type f -perm -002 -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l)
    if [[ $world_writable -gt 0 ]]; then
        error "Found $world_writable world-writable files"
        find "$PROJECT_DIR" -type f -perm -002 -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -5 | sed 's/^/    /'
    fi
    
    # Check for setuid/setgid files
    setuid_files=$(find "$PROJECT_DIR" -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | wc -l)
    if [[ $setuid_files -gt 0 ]]; then
        warn "Found $setuid_files files with setuid/setgid bits"
    fi
    
    # Check database file permissions
    if [[ -f "$PROJECT_DIR/data/bakery.db" ]]; then
        db_perms=$(stat -c %a "$PROJECT_DIR/data/bakery.db" 2>/dev/null || stat -f %A "$PROJECT_DIR/data/bakery.db")
        if [[ "${db_perms: -1}" != "0" ]]; then
            error "Database file has insecure permissions: $db_perms"
        fi
    fi
}

# Function to check authentication security
check_authentication_security() {
    log "Checking authentication security..."
    
    # Check for default credentials in code
    if grep -r -i -E "(admin|password|test|demo|default).*:.*['\"]?(admin|password|test|demo|1234|0000)" "$PROJECT_DIR" --include="*.js" --include="*.ts" --exclude-dir=node_modules > "$TEMP_DIR/default_creds.txt" 2>/dev/null; then
        if [[ -s "$TEMP_DIR/default_creds.txt" ]]; then
            error "Potential default credentials found in code"
            head -3 "$TEMP_DIR/default_creds.txt" | sed 's/^/    /'
        fi
    fi
    
    # Check for JWT secret configuration
    if grep -r "JWT_SECRET\|jwt.*secret" "$PROJECT_DIR" --include="*.js" --include="*.ts" --exclude-dir=node_modules | grep -v process.env > "$TEMP_DIR/jwt_secrets.txt" 2>/dev/null; then
        if [[ -s "$TEMP_DIR/jwt_secrets.txt" ]]; then
            warn "JWT secrets might be hardcoded (should use environment variables)"
        fi
    fi
}

# Function to check security headers
check_security_headers() {
    log "Checking security headers configuration..."
    
    # Test if services are running
    if curl -s -I "http://localhost:3000" > "$TEMP_DIR/headers.txt" 2>/dev/null; then
        # Check for security headers
        headers_to_check=(
            "X-Frame-Options"
            "X-Content-Type-Options"
            "X-XSS-Protection"
            "Content-Security-Policy"
            "Referrer-Policy"
        )
        
        for header in "${headers_to_check[@]}"; do
            if ! grep -qi "^$header:" "$TEMP_DIR/headers.txt"; then
                warn "Missing security header: $header"
            fi
        done
    fi
}

# Function to check for outdated dependencies
check_outdated_dependencies() {
    log "Checking for outdated dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Check for outdated packages
    if npm outdated --json > "$TEMP_DIR/npm-outdated.json" 2>/dev/null; then
        outdated_count=$(jq 'length' "$TEMP_DIR/npm-outdated.json")
        
        if [[ $outdated_count -gt 0 ]]; then
            major_updates=$(jq 'to_entries | map(select(.value.wanted != .value.latest)) | length' "$TEMP_DIR/npm-outdated.json")
            
            if [[ $major_updates -gt 0 ]]; then
                warn "Found $major_updates packages with major version updates available"
                echo "Packages needing major updates:"
                jq -r 'to_entries | map(select(.value.wanted != .value.latest)) | .[] | "  - \(.key): \(.value.current) → \(.value.latest)"' "$TEMP_DIR/npm-outdated.json" | head -5
            fi
        fi
    fi
}

# Function to check firewall configuration
check_firewall() {
    log "Checking firewall configuration..."
    
    if command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: inactive"; then
            error "Firewall (UFW) is not active!"
        else
            # Check for overly permissive rules
            if ufw status | grep -q "Anywhere.*ALLOW.*Anywhere"; then
                warn "Firewall has overly permissive rules allowing connections from anywhere"
            fi
            
            log "Firewall is active"
        fi
    else
        warn "UFW firewall not installed"
    fi
}

# Function to generate security report
generate_report() {
    local report_file="$REPORT_DIR/security-scan-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "scan_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "status": "$SECURITY_STATUS",
    "vulnerability_count": ${#VULNERABILITIES[@]},
    "warning_count": ${#WARNINGS[@]},
    "vulnerabilities": [
$(printf '        "%s"' "${VULNERABILITIES[@]}" | sed 's/"$/",/')
    ],
    "warnings": [
$(printf '        "%s"' "${WARNINGS[@]}" | sed 's/"$/",/')
    ]
}
EOF
    
    log "Security report saved to: $report_file"
}

# Main security scan
main() {
    echo "======================================"
    echo "Bakery Security Scan"
    echo "======================================"
    echo "Time: $(date)"
    echo ""
    
    check_npm_vulnerabilities
    echo ""
    
    check_exposed_secrets
    echo ""
    
    check_ssl_configuration
    echo ""
    
    check_file_permissions
    echo ""
    
    check_authentication_security
    echo ""
    
    check_security_headers
    echo ""
    
    check_outdated_dependencies
    echo ""
    
    check_firewall
    echo ""
    
    # Generate report
    generate_report
    
    # Summary
    echo "======================================"
    echo "Security Scan Summary"
    echo "======================================"
    echo -n "Security Status: "
    
    if [[ "$SECURITY_STATUS" == "secure" ]]; then
        if [[ ${#WARNINGS[@]} -gt 0 ]]; then
            echo -e "${YELLOW}SECURE WITH WARNINGS${NC}"
            echo "Warnings: ${#WARNINGS[@]}"
        else
            echo -e "${GREEN}SECURE${NC}"
            echo "No vulnerabilities found!"
        fi
        exit 0
    else
        echo -e "${RED}VULNERABLE${NC}"
        echo "Vulnerabilities found: ${#VULNERABILITIES[@]}"
        echo "Warnings: ${#WARNINGS[@]}"
        echo ""
        echo "Critical issues requiring immediate attention:"
        for vuln in "${VULNERABILITIES[@]}"; do
            echo "  - $vuln"
        done
        exit 1
    fi
}

# Cleanup
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Run main function
main "$@"