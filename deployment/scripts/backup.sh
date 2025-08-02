#!/bin/bash

# Bakery Monorepo Backup Script
# Automated backup for database, configurations, and files
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
BACKUP_ROOT="/home/$PROJECT_USER/backups"
REMOTE_BACKUP_DIR=""  # Optional: set for remote backups
RETENTION_DAYS=30
LOG_FILE="/var/log/bakery/backup.log"
COMPRESS_BACKUPS=true
ENCRYPT_BACKUPS=false  # Set to true if you want GPG encryption
GPG_RECIPIENT=""  # Set GPG key ID if encryption is enabled

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

# Create backup directory structure
create_backup_structure() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
    
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"/{database,config,uploads,logs,code}
    
    echo "$BACKUP_DIR" > /tmp/bakery_current_backup
}

# Backup database
backup_database() {
    log "Backing up database..."
    
    DATABASE_FILE="$PROJECT_DIR/data/bakery.db"
    
    if [[ -f "$DATABASE_FILE" ]]; then
        # Create database backup with timestamp
        cp "$DATABASE_FILE" "$BACKUP_DIR/database/bakery_$TIMESTAMP.db"
        
        # Create SQLite dump for text backup
        if command -v sqlite3 &> /dev/null; then
            sqlite3 "$DATABASE_FILE" .dump > "$BACKUP_DIR/database/bakery_$TIMESTAMP.sql"
            log "Database backed up: binary and SQL dump"
        else
            log "Database backed up: binary only (sqlite3 not available for SQL dump)"
        fi
        
        # Get database info
        if command -v sqlite3 &> /dev/null; then
            sqlite3 "$DATABASE_FILE" "SELECT COUNT(*) as tables FROM sqlite_master WHERE type='table';" > "$BACKUP_DIR/database/info.txt"
            sqlite3 "$DATABASE_FILE" "SELECT name FROM sqlite_master WHERE type='table';" >> "$BACKUP_DIR/database/info.txt"
        fi
    else
        warn "Database file not found: $DATABASE_FILE"
    fi
}

# Backup configuration files
backup_config() {
    log "Backing up configuration files..."
    
    # Environment files
    if [[ -f "$PROJECT_DIR/apps/bakery-api/.env" ]]; then
        cp "$PROJECT_DIR/apps/bakery-api/.env" "$BACKUP_DIR/config/api.env"
    fi
    
    # PM2 ecosystem
    if [[ -f "$PROJECT_DIR/deployment/configs/ecosystem.config.js" ]]; then
        cp "$PROJECT_DIR/deployment/configs/ecosystem.config.js" "$BACKUP_DIR/config/"
    fi
    
    # nginx config
    if [[ -f "/etc/nginx/sites-available/bakery" ]]; then
        sudo cp "/etc/nginx/sites-available/bakery" "$BACKUP_DIR/config/nginx-bakery.conf" 2>/dev/null || warn "Could not backup nginx config (permission denied)"
    fi
    
    # SSL certificates (if they exist)
    if [[ -d "/etc/letsencrypt/live" ]]; then
        sudo tar -czf "$BACKUP_DIR/config/ssl-certificates.tar.gz" -C /etc/letsencrypt live/ 2>/dev/null || warn "Could not backup SSL certificates"
    fi
    
    # Git information
    cd "$PROJECT_DIR"
    git rev-parse HEAD > "$BACKUP_DIR/config/git-commit.txt"
    git status --porcelain > "$BACKUP_DIR/config/git-status.txt"
    git remote -v > "$BACKUP_DIR/config/git-remotes.txt"
    
    log "Configuration files backed up"
}

# Backup uploaded files
backup_uploads() {
    log "Backing up uploaded files..."
    
    UPLOADS_DIR="$PROJECT_DIR/data/uploads"
    
    if [[ -d "$UPLOADS_DIR" ]]; then
        cp -r "$UPLOADS_DIR" "$BACKUP_DIR/uploads/"
        log "Uploaded files backed up"
    else
        info "No uploads directory found"
    fi
}

# Backup logs
backup_logs() {
    log "Backing up recent logs..."
    
    # Application logs
    if [[ -d "/var/log/bakery" ]]; then
        # Copy only recent logs (last 7 days)
        find /var/log/bakery -name "*.log" -mtime -7 -exec cp {} "$BACKUP_DIR/logs/" \; 2>/dev/null || warn "Could not backup some log files"
    fi
    
    # PM2 logs
    if command -v pm2 &> /dev/null; then
        PM2_LOGS_DIR="/home/$PROJECT_USER/.pm2/logs"
        if [[ -d "$PM2_LOGS_DIR" ]]; then
            find "$PM2_LOGS_DIR" -name "*.log" -mtime -7 -exec cp {} "$BACKUP_DIR/logs/" \; 2>/dev/null || true
        fi
    fi
    
    log "Logs backed up"
}

# Backup critical code files
backup_code() {
    log "Backing up critical code files..."
    
    cd "$PROJECT_DIR"
    
    # Package files
    if [[ -f "package.json" ]]; then
        cp "package.json" "$BACKUP_DIR/code/"
    fi
    
    if [[ -f "package-lock.json" ]]; then
        cp "package-lock.json" "$BACKUP_DIR/code/"
    fi
    
    # Nx configuration
    if [[ -f "nx.json" ]]; then
        cp "nx.json" "$BACKUP_DIR/code/"
    fi
    
    # TypeScript configuration
    if [[ -f "tsconfig.json" ]]; then
        cp "tsconfig.json" "$BACKUP_DIR/code/"
    fi
    
    if [[ -f "tsconfig.base.json" ]]; then
        cp "tsconfig.base.json" "$BACKUP_DIR/code/"
    fi
    
    # Custom scripts and configs from deployment folder
    if [[ -d "deployment" ]]; then
        cp -r "deployment" "$BACKUP_DIR/code/"
    fi
    
    log "Critical code files backed up"
}

# Compress backup if enabled
compress_backup() {
    if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
        log "Compressing backup..."
        
        cd "$BACKUP_ROOT"
        tar -czf "${TIMESTAMP}.tar.gz" "$TIMESTAMP"
        
        if [[ $? -eq 0 ]]; then
            rm -rf "$TIMESTAMP"
            log "Backup compressed to ${TIMESTAMP}.tar.gz"
            echo "$BACKUP_ROOT/${TIMESTAMP}.tar.gz" > /tmp/bakery_current_backup
        else
            warn "Compression failed, keeping uncompressed backup"
        fi
    fi
}

# Encrypt backup if enabled
encrypt_backup() {
    if [[ "$ENCRYPT_BACKUPS" == "true" ]] && [[ -n "$GPG_RECIPIENT" ]]; then
        log "Encrypting backup..."
        
        BACKUP_FILE=$(cat /tmp/bakery_current_backup)
        
        if [[ -f "$BACKUP_FILE" ]]; then
            gpg --trust-model always --recipient "$GPG_RECIPIENT" --encrypt "$BACKUP_FILE"
            
            if [[ $? -eq 0 ]]; then
                rm "$BACKUP_FILE"
                mv "${BACKUP_FILE}.gpg" "$BACKUP_FILE.gpg"
                echo "${BACKUP_FILE}.gpg" > /tmp/bakery_current_backup
                log "Backup encrypted"
            else
                warn "Encryption failed, keeping unencrypted backup"
            fi
        fi
    fi
}

# Upload to remote location if configured
upload_remote() {
    if [[ -n "$REMOTE_BACKUP_DIR" ]]; then
        log "Uploading backup to remote location..."
        
        BACKUP_FILE=$(cat /tmp/bakery_current_backup)
        
        # Example for rsync (customize as needed)
        if command -v rsync &> /dev/null; then
            rsync -avz "$BACKUP_FILE" "$REMOTE_BACKUP_DIR/" || warn "Remote upload failed"
        # Example for scp
        elif command -v scp &> /dev/null; then
            scp "$BACKUP_FILE" "$REMOTE_BACKUP_DIR/" || warn "Remote upload failed"
        else
            warn "No remote upload tool available (rsync/scp)"
        fi
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
    
    cd "$BACKUP_ROOT"
    
    # Remove old backup directories
    find . -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
    
    # Remove old compressed backups
    find . -maxdepth 1 -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Remove old encrypted backups
    find . -maxdepth 1 -name "*.tar.gz.gpg" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    REMAINING_BACKUPS=$(ls -1 | wc -l)
    log "Cleanup completed. $REMAINING_BACKUPS backups remaining"
}

# Generate backup report
generate_report() {
    BACKUP_FILE=$(cat /tmp/bakery_current_backup)
    BACKUP_SIZE=$(du -sh "$BACKUP_FILE" 2>/dev/null | cut -f1 || echo "Unknown")
    
    cat > "$BACKUP_ROOT/backup_report_$TIMESTAMP.txt" << EOF
Bakery Backup Report
==================

Date: $(date)
Backup Location: $BACKUP_FILE
Backup Size: $BACKUP_SIZE
Retention: $RETENTION_DAYS days

Components Backed Up:
- Database: $(test -f "$PROJECT_DIR/data/bakery.db" && echo "Yes" || echo "No")
- Configuration: Yes
- Uploaded Files: $(test -d "$PROJECT_DIR/data/uploads" && echo "Yes" || echo "No")
- Application Logs: Yes
- Code Files: Yes

Compression: $COMPRESS_BACKUPS
Encryption: $ENCRYPT_BACKUPS
Remote Upload: $(test -n "$REMOTE_BACKUP_DIR" && echo "Yes" || echo "No")

System Info:
- Disk Usage: $(df -h "$BACKUP_ROOT" | tail -1)
- Available Space: $(df -h "$BACKUP_ROOT" | tail -1 | awk '{print $4}')

EOF
    
    log "Backup report generated: backup_report_$TIMESTAMP.txt"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    BACKUP_FILE=$(cat /tmp/bakery_current_backup)
    
    if [[ -f "$BACKUP_FILE" ]]; then
        # Check if it's a tar.gz file
        if [[ "$BACKUP_FILE" == *.tar.gz ]]; then
            if tar -tzf "$BACKUP_FILE" > /dev/null 2>&1; then
                log "Backup archive integrity verified"
            else
                error "Backup archive is corrupted!"
            fi
        else
            log "Backup directory exists and is accessible"
        fi
    else
        error "Backup file/directory not found!"
    fi
}

# Main backup function
main() {
    log "Starting Bakery Backup Process"
    log "=============================="
    
    check_user
    
    # Ensure backup root exists
    mkdir -p "$BACKUP_ROOT"
    
    create_backup_structure
    backup_database
    backup_config
    backup_uploads
    backup_logs
    backup_code
    verify_backup
    compress_backup
    encrypt_backup
    upload_remote
    cleanup_old_backups
    generate_report
    
    log "=============================="
    log "Backup completed successfully!"
    log "=============================="
    
    BACKUP_FILE=$(cat /tmp/bakery_current_backup)
    BACKUP_SIZE=$(du -sh "$BACKUP_FILE" 2>/dev/null | cut -f1 || echo "Unknown")
    
    info "Backup location: $BACKUP_FILE"
    info "Backup size: $BACKUP_SIZE"
    info "Total backups: $(ls -1 "$BACKUP_ROOT" | wc -l)"
}

# Handle script arguments
case "${1:-}" in
    --verify)
        if [[ -f "/tmp/bakery_current_backup" ]]; then
            verify_backup
        else
            error "No recent backup found to verify"
        fi
        ;;
    --cleanup)
        check_user
        cleanup_old_backups
        ;;
    --list)
        echo "Available backups in $BACKUP_ROOT:"
        ls -la "$BACKUP_ROOT" 2>/dev/null || echo "No backups found"
        ;;
    --restore)
        echo "Restore functionality should be implemented based on your specific needs"
        echo "Manual restore steps:"
        echo "1. Stop applications: pm2 stop all"
        echo "2. Restore database: cp backup/database/bakery_*.db $PROJECT_DIR/data/bakery.db"
        echo "3. Restore config: cp backup/config/.env $PROJECT_DIR/apps/bakery-api/"
        echo "4. Start applications: pm2 start all"
        ;;
    --help)
        echo "Usage: $0 [--verify|--cleanup|--list|--restore|--help]"
        echo "  --verify   Verify last backup integrity"
        echo "  --cleanup  Clean old backups manually"
        echo "  --list     List available backups"
        echo "  --restore  Show restore instructions"
        echo "  --help     Show this help"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1. Use --help for usage information."
        ;;
esac