#!/bin/bash

# Secrets Check Script
# Validates environment variables and checks for exposed secrets
# Version: 1.0.0

set -e

# Configuration
PROJECT_DIR="/home/bakery/bakery"
REQUIRED_ENV_VARS=(
    "NODE_ENV"
    "JWT_SECRET"
    "DATABASE_URL"
    "SESSION_SECRET"
)
OPTIONAL_ENV_VARS=(
    "STRIPE_API_KEY"
    "SMTP_HOST"
    "SMTP_USER"
    "SMTP_PASS"
    "SENTRY_DSN"
    "GOOGLE_ANALYTICS_ID"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Status tracking
MISSING_REQUIRED=()
MISSING_OPTIONAL=()
WEAK_SECRETS=()
EXPOSED_FILES=()

# Function to check if environment variable is set
check_env_var() {
    local var_name="$1"
    local required="$2"
    
    if [[ -z "${!var_name}" ]]; then
        if [[ "$required" == "true" ]]; then
            echo -e "${RED}✗${NC} $var_name - Missing (REQUIRED)"
            MISSING_REQUIRED+=("$var_name")
        else
            echo -e "${YELLOW}⚠${NC} $var_name - Missing (optional)"
            MISSING_OPTIONAL+=("$var_name")
        fi
        return 1
    else
        # Check for weak values
        local var_value="${!var_name}"
        
        # Check if it's a secret-type variable
        if [[ "$var_name" =~ (SECRET|KEY|PASS|TOKEN) ]]; then
            # Check for weak secrets
            if [[ ${#var_value} -lt 32 ]]; then
                echo -e "${YELLOW}⚠${NC} $var_name - Set but possibly weak (length: ${#var_value})"
                WEAK_SECRETS+=("$var_name")
            else
                echo -e "${GREEN}✓${NC} $var_name - Set and strong"
            fi
            
            # Check for common weak values
            if [[ "$var_value" =~ (secret|password|12345|admin|test|demo|default) ]]; then
                echo -e "${RED}  WARNING: Contains weak pattern${NC}"
                WEAK_SECRETS+=("$var_name (weak pattern)")
            fi
        else
            echo -e "${GREEN}✓${NC} $var_name - Set"
        fi
        return 0
    fi
}

# Function to check .env files
check_env_files() {
    echo "Checking .env files..."
    echo ""
    
    # Find all .env files
    find "$PROJECT_DIR" -name ".env*" -not -path "*/node_modules/*" -not -name "*.example" -not -name "*.sample" | while read -r env_file; do
        echo "Found: $env_file"
        
        # Check if file exists and is readable
        if [[ ! -r "$env_file" ]]; then
            echo -e "${RED}  Cannot read file${NC}"
            continue
        fi
        
        # Check file permissions
        perms=$(stat -c %a "$env_file" 2>/dev/null || stat -f %A "$env_file")
        owner=$(stat -c %U "$env_file" 2>/dev/null || stat -f %Su "$env_file")
        group=$(stat -c %G "$env_file" 2>/dev/null || stat -f %Sg "$env_file")
        
        echo "  Permissions: $perms (owner: $owner, group: $group)"
        
        # Check if world-readable
        if [[ "${perms: -1}" != "0" ]]; then
            echo -e "${RED}  WARNING: File is world-readable!${NC}"
            EXPOSED_FILES+=("$env_file (world-readable)")
        fi
        
        # Check if in git
        if git -C "$(dirname "$env_file")" ls-files --error-unmatch "$(basename "$env_file")" &>/dev/null; then
            echo -e "${RED}  CRITICAL: File is tracked in git!${NC}"
            EXPOSED_FILES+=("$env_file (in git)")
        else
            echo -e "${GREEN}  File is not in git${NC}"
        fi
        
        # Check for sensitive content
        if grep -E "(password|secret|key|token).*=" "$env_file" > /dev/null 2>&1; then
            echo -e "${BLUE}  Contains sensitive variables${NC}"
        fi
        
        echo ""
    done
}

# Function to check for hardcoded secrets
check_hardcoded_secrets() {
    echo "Checking for hardcoded secrets in code..."
    echo ""
    
    # Patterns that might indicate hardcoded secrets
    PATTERNS=(
        "password\\s*[:=]\\s*['\"][^'\"]+['\"]"
        "api_?key\\s*[:=]\\s*['\"][^'\"]+['\"]"
        "secret\\s*[:=]\\s*['\"][^'\"]+['\"]"
        "token\\s*[:=]\\s*['\"][^'\"]+['\"]"
        "private_?key\\s*[:=]\\s*['\"][^'\"]+['\"]"
    )
    
    found_any=false
    
    for pattern in "${PATTERNS[@]}"; do
        # Search in JavaScript/TypeScript files
        matches=$(grep -r -i -E "$pattern" "$PROJECT_DIR" \
            --include="*.js" \
            --include="*.ts" \
            --include="*.jsx" \
            --include="*.tsx" \
            --exclude-dir=node_modules \
            --exclude-dir=.git \
            --exclude-dir=dist \
            --exclude-dir=build \
            --exclude="*.test.*" \
            --exclude="*.spec.*" \
            2>/dev/null | grep -v "process.env" | grep -v "import.*from" | head -5)
        
        if [[ -n "$matches" ]]; then
            echo -e "${RED}Potential hardcoded secrets found:${NC}"
            echo "$matches" | while IFS= read -r line; do
                echo "  $line" | cut -c1-120
            done
            echo ""
            found_any=true
        fi
    done
    
    if [[ "$found_any" == "false" ]]; then
        echo -e "${GREEN}No obvious hardcoded secrets found${NC}"
    fi
    
    echo ""
}

# Function to validate JWT secret
check_jwt_secret() {
    echo "Checking JWT secret strength..."
    
    if [[ -n "$JWT_SECRET" ]]; then
        local length=${#JWT_SECRET}
        
        # Check length
        if [[ $length -lt 32 ]]; then
            echo -e "${RED}JWT secret is too short ($length chars). Recommended: 64+ chars${NC}"
        elif [[ $length -lt 64 ]]; then
            echo -e "${YELLOW}JWT secret is acceptable ($length chars). Recommended: 64+ chars${NC}"
        else
            echo -e "${GREEN}JWT secret length is strong ($length chars)${NC}"
        fi
        
        # Check complexity
        if [[ "$JWT_SECRET" =~ ^[a-zA-Z0-9]+$ ]]; then
            echo -e "${YELLOW}JWT secret contains only alphanumeric characters. Consider adding special characters.${NC}"
        else
            echo -e "${GREEN}JWT secret has good character variety${NC}"
        fi
        
        # Check for common patterns
        if [[ "$JWT_SECRET" =~ (secret|password|12345|jwt|token) ]]; then
            echo -e "${RED}JWT secret contains common/weak patterns!${NC}"
        fi
    else
        echo -e "${RED}JWT_SECRET is not set!${NC}"
    fi
    
    echo ""
}

# Function to generate secure secrets
generate_secure_secret() {
    local length="${1:-64}"
    
    if command -v openssl &> /dev/null; then
        openssl rand -base64 "$length" | tr -d '\n'
    elif command -v head &> /dev/null && [[ -r /dev/urandom ]]; then
        head -c "$length" /dev/urandom | base64 | tr -d '\n' | cut -c1-"$length"
    else
        echo "Cannot generate secure secret - no suitable random source found"
        return 1
    fi
}

# Function to check secrets rotation
check_secrets_rotation() {
    echo "Checking secrets rotation..."
    
    # Check if there's a secrets rotation log
    ROTATION_LOG="/var/log/bakery/secrets-rotation.log"
    
    if [[ -f "$ROTATION_LOG" ]]; then
        last_rotation=$(tail -1 "$ROTATION_LOG" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}' | head -1)
        
        if [[ -n "$last_rotation" ]]; then
            days_since=$(( ($(date +%s) - $(date -d "$last_rotation" +%s)) / 86400 ))
            
            if [[ $days_since -gt 90 ]]; then
                echo -e "${YELLOW}Secrets were last rotated $days_since days ago (recommended: every 90 days)${NC}"
            else
                echo -e "${GREEN}Secrets were rotated $days_since days ago${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}No secrets rotation log found${NC}"
    fi
    
    echo ""
}

# Main function
main() {
    echo "======================================"
    echo "Bakery Secrets Security Check"
    echo "======================================"
    echo "Time: $(date)"
    echo ""
    
    # Load environment if available
    if [[ -f "$PROJECT_DIR/apps/bakery-api/.env" ]]; then
        echo "Loading environment from $PROJECT_DIR/apps/bakery-api/.env"
        set -a
        source "$PROJECT_DIR/apps/bakery-api/.env"
        set +a
        echo ""
    fi
    
    # Check required environment variables
    echo "Required Environment Variables:"
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        check_env_var "$var" "true"
    done
    echo ""
    
    # Check optional environment variables
    echo "Optional Environment Variables:"
    for var in "${OPTIONAL_ENV_VARS[@]}"; do
        check_env_var "$var" "false"
    done
    echo ""
    
    # Check .env files
    check_env_files
    
    # Check for hardcoded secrets
    check_hardcoded_secrets
    
    # JWT secret validation
    check_jwt_secret
    
    # Check secrets rotation
    check_secrets_rotation
    
    # Summary
    echo "======================================"
    echo "Summary"
    echo "======================================"
    
    local exit_code=0
    
    if [[ ${#MISSING_REQUIRED[@]} -gt 0 ]]; then
        echo -e "${RED}Missing required variables: ${#MISSING_REQUIRED[@]}${NC}"
        for var in "${MISSING_REQUIRED[@]}"; do
            echo "  - $var"
        done
        exit_code=1
    fi
    
    if [[ ${#WEAK_SECRETS[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Weak secrets detected: ${#WEAK_SECRETS[@]}${NC}"
        for secret in "${WEAK_SECRETS[@]}"; do
            echo "  - $secret"
        done
        exit_code=1
    fi
    
    if [[ ${#EXPOSED_FILES[@]} -gt 0 ]]; then
        echo -e "${RED}Exposed files: ${#EXPOSED_FILES[@]}${NC}"
        for file in "${EXPOSED_FILES[@]}"; do
            echo "  - $file"
        done
        exit_code=1
    fi
    
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}All security checks passed!${NC}"
    else
        echo ""
        echo "Recommendations:"
        echo "1. Set all required environment variables"
        echo "2. Use strong, randomly generated secrets (64+ characters)"
        echo "3. Never commit .env files to git"
        echo "4. Set proper file permissions (600) on .env files"
        echo "5. Rotate secrets regularly (every 90 days)"
        echo ""
        echo "Generate secure secrets with:"
        echo "  openssl rand -base64 64"
    fi
    
    exit $exit_code
}

# Handle arguments
case "${1:-}" in
    --generate)
        # Generate secure secrets
        echo "Generating secure secrets..."
        echo ""
        echo "JWT_SECRET=$(generate_secure_secret 64)"
        echo "SESSION_SECRET=$(generate_secure_secret 64)"
        echo "DATABASE_ENCRYPTION_KEY=$(generate_secure_secret 32)"
        echo "API_KEY=$(generate_secure_secret 48)"
        echo ""
        echo "Add these to your .env file (don't commit to git!)"
        ;;
    --check-file)
        # Check specific .env file
        if [[ -z "$2" ]]; then
            echo "Usage: $0 --check-file <path-to-env-file>"
            exit 1
        fi
        
        if [[ -f "$2" ]]; then
            set -a
            source "$2"
            set +a
            main
        else
            echo "File not found: $2"
            exit 1
        fi
        ;;
    --help)
        echo "Usage: $0 [--generate|--check-file <file>|--help]"
        echo ""
        echo "Options:"
        echo "  --generate     Generate secure random secrets"
        echo "  --check-file   Check specific .env file"
        echo "  --help         Show this help"
        ;;
    *)
        main
        ;;
esac