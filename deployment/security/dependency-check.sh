#!/bin/bash

# Dependency Security Check Script
# Checks for vulnerabilities in project dependencies
# Version: 1.0.0

set -e

# Configuration
PROJECT_DIR="/home/bakery/bakery"
REPORT_DIR="/var/log/bakery/security/dependency-reports"
SEVERITY_THRESHOLD="moderate" # low, moderate, high, critical

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create report directory
mkdir -p "$REPORT_DIR"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Function to check npm dependencies
check_npm_audit() {
    log "Running npm audit..."
    
    cd "$PROJECT_DIR"
    
    # Run npm audit and save report
    local audit_report="$REPORT_DIR/npm-audit-$(date +%Y%m%d-%H%M%S).json"
    
    if npm audit --json > "$audit_report" 2>/dev/null; then
        # Parse audit results
        local total=$(jq '.metadata.vulnerabilities | to_entries | map(.value) | add' "$audit_report")
        local critical=$(jq '.metadata.vulnerabilities.critical // 0' "$audit_report")
        local high=$(jq '.metadata.vulnerabilities.high // 0' "$audit_report")
        local moderate=$(jq '.metadata.vulnerabilities.moderate // 0' "$audit_report")
        local low=$(jq '.metadata.vulnerabilities.low // 0' "$audit_report")
        
        echo ""
        echo "NPM Audit Results:"
        echo "=================="
        echo "Total vulnerabilities: $total"
        echo "  Critical: $critical"
        echo "  High: $high"
        echo "  Moderate: $moderate"
        echo "  Low: $low"
        echo ""
        
        # Show details for critical and high vulnerabilities
        if [[ $critical -gt 0 ]] || [[ $high -gt 0 ]]; then
            echo "Critical/High Vulnerabilities:"
            jq -r '.vulnerabilities | to_entries | .[] | select(.value.severity == "critical" or .value.severity == "high") | 
                "  Package: \(.key)\n  Severity: \(.value.severity)\n  Title: \(.value.title)\n  URL: \(.value.url)\n"' "$audit_report" 2>/dev/null
        fi
        
        # Check against threshold
        case "$SEVERITY_THRESHOLD" in
            "critical")
                [[ $critical -gt 0 ]] && return 1
                ;;
            "high")
                [[ $critical -gt 0 ]] || [[ $high -gt 0 ]] && return 1
                ;;
            "moderate")
                [[ $critical -gt 0 ]] || [[ $high -gt 0 ]] || [[ $moderate -gt 0 ]] && return 1
                ;;
            "low")
                [[ $total -gt 0 ]] && return 1
                ;;
        esac
        
        return 0
    else
        error "npm audit failed"
        return 1
    fi
}

# Function to check for outdated packages
check_outdated_packages() {
    log "Checking for outdated packages..."
    
    cd "$PROJECT_DIR"
    
    # Check outdated packages
    local outdated_report="$REPORT_DIR/npm-outdated-$(date +%Y%m%d-%H%M%S).json"
    
    if npm outdated --json > "$outdated_report" 2>/dev/null; then
        local count=$(jq 'length' "$outdated_report")
        
        if [[ $count -gt 0 ]]; then
            echo ""
            echo "Outdated Packages: $count"
            echo "==================="
            
            # Show packages with major updates
            echo "Packages with major updates available:"
            jq -r 'to_entries | map(select(.value.current | split(".")[0] != (.value.latest | split(".")[0]))) | 
                .[] | "  \(.key): \(.value.current) → \(.value.latest) (wanted: \(.value.wanted))"' "$outdated_report" 2>/dev/null
            
            # Count security-related packages
            local security_packages=$(jq -r 'keys[]' "$outdated_report" | grep -E "(auth|crypto|security|jwt|bcrypt|helmet)" | wc -l)
            
            if [[ $security_packages -gt 0 ]]; then
                warn "$security_packages security-related packages are outdated"
            fi
        else
            log "All packages are up to date"
        fi
    fi
}

# Function to check package licenses
check_licenses() {
    log "Checking package licenses..."
    
    cd "$PROJECT_DIR"
    
    # Use license-checker if available
    if command -v license-checker &> /dev/null; then
        local license_report="$REPORT_DIR/licenses-$(date +%Y%m%d-%H%M%S).json"
        
        if license-checker --json --out "$license_report" 2>/dev/null; then
            # Check for problematic licenses
            local problematic=$(jq -r 'to_entries | map(select(.value.licenses | test("GPL|AGPL|LGPL|CPOL|MSPL"))) | length' "$license_report")
            
            if [[ $problematic -gt 0 ]]; then
                warn "Found $problematic packages with potentially problematic licenses"
                echo "Packages with GPL-style licenses:"
                jq -r 'to_entries | map(select(.value.licenses | test("GPL|AGPL|LGPL"))) | 
                    .[] | "  \(.key): \(.value.licenses)"' "$license_report" 2>/dev/null
            else
                log "No problematic licenses found"
            fi
        fi
    else
        info "license-checker not installed, skipping license check"
        info "Install with: npm install -g license-checker"
    fi
}

# Function to check for known vulnerable packages
check_vulnerable_packages() {
    log "Checking for known vulnerable packages..."
    
    # List of packages with known issues
    VULNERABLE_PACKAGES=(
        "event-stream"
        "flatmap-stream"
        "eslint-scope@3.7.2"
        "bootstrap@<4.3.1"
        "jquery@<3.5.0"
        "lodash@<4.17.21"
        "minimist@<1.2.6"
        "node-fetch@<2.6.7"
        "axios@<0.27.0"
    )
    
    cd "$PROJECT_DIR"
    
    echo ""
    echo "Checking for known vulnerable packages..."
    
    found_vulnerable=false
    
    for package in "${VULNERABLE_PACKAGES[@]}"; do
        # Extract package name and version
        if [[ "$package" =~ ^([^@]+)@(.+)$ ]]; then
            pkg_name="${BASH_REMATCH[1]}"
            pkg_version="${BASH_REMATCH[2]}"
            
            # Check if package exists in package.json or lock file
            if grep -q "\"$pkg_name\"" package.json package-lock.json 2>/dev/null; then
                # Get installed version
                installed_version=$(jq -r ".dependencies[\"$pkg_name\"] // .devDependencies[\"$pkg_name\"] // \"not found\"" package.json)
                
                if [[ "$installed_version" != "not found" ]]; then
                    warn "Found potentially vulnerable package: $pkg_name@$installed_version"
                    found_vulnerable=true
                fi
            fi
        else
            # Just package name, no version specified
            if grep -q "\"$package\"" package.json package-lock.json 2>/dev/null; then
                warn "Found potentially vulnerable package: $package"
                found_vulnerable=true
            fi
        fi
    done
    
    if [[ "$found_vulnerable" == "false" ]]; then
        log "No known vulnerable packages found"
    fi
}

# Function to generate remediation script
generate_remediation_script() {
    local script_file="$REPORT_DIR/remediation-$(date +%Y%m%d-%H%M%S).sh"
    
    log "Generating remediation script..."
    
    cat > "$script_file" << 'EOF'
#!/bin/bash
# Auto-generated remediation script
# Generated: $(date)

set -e

echo "Bakery Dependency Remediation Script"
echo "===================================="
echo ""

# Backup current state
echo "Creating backup..."
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# Run npm audit fix
echo "Running npm audit fix..."
npm audit fix

# For breaking changes, use force (careful!)
# npm audit fix --force

# Update specific vulnerable packages
echo "Updating vulnerable packages..."

# Add specific package updates here based on scan results
# npm update package-name

# Rebuild and test
echo "Rebuilding project..."
npm install
npm run build

echo ""
echo "Remediation complete!"
echo "Please run tests to ensure everything works correctly."
echo "Backup files created: package.json.backup, package-lock.json.backup"
EOF
    
    chmod +x "$script_file"
    
    echo ""
    echo "Remediation script generated: $script_file"
}

# Main function
main() {
    echo "======================================"
    echo "Dependency Security Check"
    echo "======================================"
    echo "Project: $PROJECT_DIR"
    echo "Time: $(date)"
    echo "Severity Threshold: $SEVERITY_THRESHOLD"
    echo ""
    
    # Run checks
    local exit_code=0
    
    # NPM audit
    if ! check_npm_audit; then
        exit_code=1
    fi
    
    echo ""
    
    # Outdated packages
    check_outdated_packages
    
    echo ""
    
    # License check
    check_licenses
    
    echo ""
    
    # Known vulnerable packages
    check_vulnerable_packages
    
    echo ""
    
    # Generate remediation script if issues found
    if [[ $exit_code -ne 0 ]]; then
        generate_remediation_script
    fi
    
    # Summary
    echo ""
    echo "======================================"
    echo "Summary"
    echo "======================================"
    
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}No vulnerabilities found above $SEVERITY_THRESHOLD threshold${NC}"
    else
        echo -e "${RED}Vulnerabilities found that exceed $SEVERITY_THRESHOLD threshold${NC}"
        echo ""
        echo "Recommended actions:"
        echo "1. Review the detailed reports in: $REPORT_DIR"
        echo "2. Run the generated remediation script (review first!)"
        echo "3. Update packages manually for breaking changes"
        echo "4. Test thoroughly after updates"
        echo "5. Consider using npm audit fix --force for aggressive fixes"
    fi
    
    exit $exit_code
}

# Handle arguments
case "${1:-}" in
    --fix)
        # Attempt automatic fixes
        log "Attempting automatic fixes..."
        cd "$PROJECT_DIR"
        npm audit fix
        ;;
    --fix-force)
        # Force fixes (may break things)
        warn "Force fixing vulnerabilities (may introduce breaking changes)..."
        cd "$PROJECT_DIR"
        npm audit fix --force
        ;;
    --severity)
        # Set severity threshold
        if [[ -n "$2" ]]; then
            SEVERITY_THRESHOLD="$2"
        fi
        main
        ;;
    --help)
        echo "Usage: $0 [--fix|--fix-force|--severity <level>|--help]"
        echo ""
        echo "Options:"
        echo "  --fix         Attempt automatic fixes"
        echo "  --fix-force   Force fixes (may break)"
        echo "  --severity    Set threshold (low|moderate|high|critical)"
        echo "  --help        Show this help"
        ;;
    *)
        main
        ;;
esac