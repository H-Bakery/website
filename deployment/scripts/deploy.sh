#!/bin/bash

# Bakery Monorepo Deployment Script
# Zero-downtime deployment using PM2 reload
# Version: 1.0.0

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_USER="bakery"
PROJECT_DIR="/home/$PROJECT_USER/bakery"
BACKUP_DIR="/home/$PROJECT_USER/bakery/backups"
LOG_FILE="/var/log/bakery/deploy.log"
GIT_BRANCH="main"
MAX_DEPLOYMENT_TIME=300  # 5 minutes timeout

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# Check if running as correct user
check_user() {
    if [[ "$(whoami)" != "$PROJECT_USER" ]]; then
        error "This script must be run as user '$PROJECT_USER'. Use: sudo -u $PROJECT_USER $0"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if in project directory
    if [[ ! -d "$PROJECT_DIR" ]]; then
        error "Project directory $PROJECT_DIR does not exist"
    fi
    
    cd "$PROJECT_DIR"
    
    # Check if git repository
    if [[ ! -d ".git" ]]; then
        error "Not a git repository. Please clone your project first."
    fi
    
    # Check if PM2 is available
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed or not in PATH"
    fi
    
    # Check if ecosystem file exists
    if [[ ! -f "deployment/configs/ecosystem.config.js" ]]; then
        error "PM2 ecosystem file not found"
    fi
    
    log "Prerequisites check passed"
}

# Create backup before deployment
create_backup() {
    log "Creating backup before deployment..."
    
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$BACKUP_TIMESTAMP"
    
    # Backup database
    if [[ -f "$PROJECT_DIR/data/bakery.db" ]]; then
        mkdir -p "$BACKUP_PATH"
        cp "$PROJECT_DIR/data/bakery.db" "$BACKUP_PATH/bakery.db"
        log "Database backed up to $BACKUP_PATH/bakery.db"
    fi
    
    # Backup current git commit hash
    git rev-parse HEAD > "$BACKUP_PATH/commit_hash.txt"
    
    # Backup environment files
    if [[ -f "$PROJECT_DIR/apps/bakery-api/.env" ]]; then
        cp "$PROJECT_DIR/apps/bakery-api/.env" "$BACKUP_PATH/.env"
    fi
    
    # Clean old backups (keep last 10)
    cd "$BACKUP_DIR"
    ls -t | tail -n +11 | xargs -r rm -rf
    
    log "Backup created at $BACKUP_PATH"
    echo "$BACKUP_PATH" > /tmp/bakery_last_backup
}

# Update code from git repository
update_code() {
    log "Updating code from git repository..."
    
    cd "$PROJECT_DIR"
    
    # Fetch latest changes
    git fetch origin
    
    # Check if there are changes
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/$GIT_BRANCH")
    
    if [[ "$LOCAL" == "$REMOTE" ]]; then
        info "No changes detected. Deployment not needed."
        return 1
    fi
    
    log "Changes detected. Updating from $LOCAL to $REMOTE"
    
    # Stash any local changes
    if ! git diff-index --quiet HEAD --; then
        warn "Local changes detected. Stashing..."
        git stash push -m "Auto-stash before deployment $(date)"
    fi
    
    # Pull latest changes
    git checkout "$GIT_BRANCH"
    git pull origin "$GIT_BRANCH"
    
    log "Code updated successfully"
    return 0
}

# Install/update dependencies
install_dependencies() {
    log "Installing/updating dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Update root dependencies
    if [[ -f "package.json" ]]; then
        npm ci --production=false
    fi
    
    # Update backend dependencies
    if [[ -f "apps/bakery-api/package.json" ]]; then
        cd "$PROJECT_DIR/apps/bakery-api"
        npm ci --production
        cd "$PROJECT_DIR"
    fi
    
    # Update frontend app dependencies (they share root package.json in monorepo)
    # The Next.js apps should use the root node_modules
    
    log "Dependencies updated successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$PROJECT_DIR/apps/bakery-api"
    
    # Run migrations if available
    if [[ -d "migrations" ]] && command -v npx &> /dev/null; then
        if npx sequelize-cli db:migrate --env production; then
            log "Database migrations completed successfully"
        else
            warn "Database migrations failed or not available"
        fi
    else
        info "No migrations to run"
    fi
    
    cd "$PROJECT_DIR"
}

# Build all applications
build_applications() {
    log "Building applications..."
    
    cd "$PROJECT_DIR"
    
    # Build all apps using Nx
    if command -v nx &> /dev/null; then
        log "Building with Nx..."
        npm run build:all
    else
        log "Building individual apps..."
        
        # Build bakery-shop
        if [[ -d "apps/bakery-shop" ]]; then
            cd "$PROJECT_DIR/apps/bakery-shop"
            npm run build
        fi
        
        # Build bakery-management
        if [[ -d "apps/bakery-management" ]]; then
            cd "$PROJECT_DIR/apps/bakery-management"
            npm run build
        fi
        
        # Build bakery-landing (static export)
        if [[ -d "apps/bakery-landing" ]]; then
            cd "$PROJECT_DIR/apps/bakery-landing"
            npm run build
        fi
        
        cd "$PROJECT_DIR"
    fi
    
    log "Applications built successfully"
}

# Health check function
health_check() {
    local app_name="$1"
    local port="$2"
    local max_attempts=30
    local attempt=1
    
    log "Health checking $app_name on port $port..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1 || \
           curl -f -s "http://localhost:$port" > /dev/null 2>&1; then
            log "$app_name is healthy (attempt $attempt)"
            return 0
        fi
        
        sleep 2
        ((attempt++))
    done
    
    error "$app_name failed health check after $max_attempts attempts"
}

# Deploy applications with PM2
deploy_applications() {
    log "Deploying applications with PM2..."
    
    cd "$PROJECT_DIR"
    
    # Copy ecosystem config to current directory for PM2
    cp deployment/configs/ecosystem.config.js .
    
    # Get current PM2 processes
    CURRENT_PROCESSES=$(pm2 jlist | jq -r '.[].name' 2>/dev/null || echo "")
    
    if [[ -n "$CURRENT_PROCESSES" ]]; then
        log "Performing zero-downtime reload..."
        pm2 reload ecosystem.config.js --env production
    else
        log "Starting applications for the first time..."
        pm2 start ecosystem.config.js --env production
    fi
    
    # Save PM2 process list
    pm2 save
    
    # Wait for applications to start
    sleep 10
    
    # Health check all applications
    health_check "bakery-api" "5000"
    health_check "bakery-shop" "3000"
    health_check "bakery-management" "3001"
    health_check "bakery-landing" "3002"
    
    log "All applications deployed and healthy"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    
    cd "$PROJECT_DIR"
    
    # Clean npm cache
    npm cache clean --force 2>/dev/null || true
    
    # Clean old build artifacts
    find . -name "node_modules/.cache" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name ".next/cache" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Clean old logs (keep last 100MB)
    find /var/log/bakery -name "*.log" -size +10M -delete 2>/dev/null || true
    
    log "Cleanup completed"
}

# Rollback function
rollback() {
    error_msg="$1"
    
    error "Deployment failed: $error_msg"
    warn "Initiating rollback..."
    
    if [[ -f "/tmp/bakery_last_backup" ]]; then
        BACKUP_PATH=$(cat /tmp/bakery_last_backup)
        
        if [[ -f "$BACKUP_PATH/commit_hash.txt" ]]; then
            ROLLBACK_COMMIT=$(cat "$BACKUP_PATH/commit_hash.txt")
            
            cd "$PROJECT_DIR"
            git checkout "$ROLLBACK_COMMIT"
            
            # Restore database if exists
            if [[ -f "$BACKUP_PATH/bakery.db" ]]; then
                cp "$BACKUP_PATH/bakery.db" "$PROJECT_DIR/data/bakery.db"
            fi
            
            # Restart applications
            pm2 restart all
            
            warn "Rollback completed to commit $ROLLBACK_COMMIT"
        fi
    fi
    
    exit 1
}

# Main deployment function
main() {
    log "Starting Bakery Monorepo Deployment"
    log "====================================="
    
    # Set trap for errors
    trap 'rollback "Unexpected error occurred"' ERR
    
    # Set deployment timeout
    (
        sleep $MAX_DEPLOYMENT_TIME
        echo "Deployment timeout reached"
        pkill -P $$
    ) &
    TIMEOUT_PID=$!
    
    check_user
    check_prerequisites
    create_backup
    
    # Update code (if no changes, skip deployment)
    if ! update_code; then
        log "Deployment skipped - no changes detected"
        kill $TIMEOUT_PID 2>/dev/null || true
        exit 0
    fi
    
    install_dependencies
    run_migrations
    build_applications
    deploy_applications
    cleanup
    
    # Kill timeout process
    kill $TIMEOUT_PID 2>/dev/null || true
    
    log "====================================="
    log "Deployment completed successfully!"
    log "====================================="
    
    # Show PM2 status
    info "Current PM2 status:"
    pm2 status
    
    info "Application URLs:"
    info "- API: http://localhost:5000"
    info "- Shop: http://localhost:3000"
    info "- Management: http://localhost:3001"
    info "- Landing: http://localhost:3002"
    
    info "Logs location: /var/log/bakery/"
    info "Backup location: $(cat /tmp/bakery_last_backup 2>/dev/null || echo 'N/A')"
}

# Handle script arguments
case "${1:-}" in
    --rollback)
        if [[ -f "/tmp/bakery_last_backup" ]]; then
            rollback "Manual rollback requested"
        else
            error "No backup found for rollback"
        fi
        ;;
    --status)
        pm2 status
        ;;
    --logs)
        pm2 logs
        ;;
    --help)
        echo "Usage: $0 [--rollback|--status|--logs|--help]"
        echo "  --rollback  Rollback to last backup"
        echo "  --status    Show PM2 status"
        echo "  --logs      Show PM2 logs"
        echo "  --help      Show this help"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1. Use --help for usage information."
        ;;
esac