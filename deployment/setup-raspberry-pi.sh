#!/bin/bash

# Raspberry Pi Production Deployment Setup Script
# For Bakery Monorepo with PM2 + systemd hybrid approach
# Version: 1.0.0
# Compatible with: Raspberry Pi 4, Ubuntu 22.04, Debian 11+

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="18"
PROJECT_USER="bakery"
PROJECT_DIR="/home/$PROJECT_USER/bakery"
DOMAIN="your-domain.com"  # Change this to your actual domain
EMAIL="your-email@example.com"  # Change this for Let's Encrypt

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Check if running on supported system
check_system() {
    if ! command -v apt &> /dev/null; then
        error "This script requires a Debian-based system (Ubuntu/Debian/Raspbian)"
    fi
    
    # Check if ARM architecture (Raspberry Pi)
    ARCH=$(uname -m)
    if [[ "$ARCH" == "aarch64" ]] || [[ "$ARCH" == "armv7l" ]]; then
        info "Detected ARM architecture: $ARCH (Raspberry Pi)"
    else
        warn "Not running on ARM architecture. Script may work but is optimized for Raspberry Pi"
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    apt update && apt upgrade -y
    apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates
}

# Install Node.js
install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$NODE_CURRENT" -ge "$NODE_VERSION" ]]; then
            log "Node.js $NODE_CURRENT is already installed (required: $NODE_VERSION+)"
            return 0
        else
            warn "Node.js $NODE_CURRENT is outdated. Installing Node.js $NODE_VERSION..."
        fi
    else
        log "Installing Node.js $NODE_VERSION..."
    fi
    
    # Install Node.js from NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
    
    # Verify installation
    NODE_INSTALLED=$(node --version)
    NPM_INSTALLED=$(npm --version)
    log "Node.js installed: $NODE_INSTALLED"
    log "npm installed: $NPM_INSTALLED"
}

# Install system dependencies
install_system_dependencies() {
    log "Installing system dependencies..."
    apt install -y \
        git \
        sqlite3 \
        nginx \
        ufw \
        htop \
        tree \
        unzip \
        build-essential \
        python3-certbot-nginx \
        logrotate \
        fail2ban
}

# Create project user
create_project_user() {
    if id "$PROJECT_USER" &>/dev/null; then
        log "User $PROJECT_USER already exists"
    else
        log "Creating project user: $PROJECT_USER"
        useradd -m -s /bin/bash "$PROJECT_USER"
        usermod -aG sudo "$PROJECT_USER"
    fi
    
    # Create project directory
    if [[ ! -d "$PROJECT_DIR" ]]; then
        log "Creating project directory: $PROJECT_DIR"
        mkdir -p "$PROJECT_DIR"
        chown -R "$PROJECT_USER:$PROJECT_USER" "$PROJECT_DIR"
    fi
}

# Install PM2 globally
install_pm2() {
    if command -v pm2 &> /dev/null; then
        log "PM2 is already installed: $(pm2 --version)"
    else
        log "Installing PM2 globally..."
        npm install -g pm2
        
        # Setup PM2 startup script
        log "Setting up PM2 startup script..."
        sudo -u "$PROJECT_USER" pm2 startup systemd -u "$PROJECT_USER" --hp "/home/$PROJECT_USER"
    fi
}

# Configure nginx
configure_nginx() {
    log "Configuring nginx..."
    
    # Backup original nginx config
    if [[ -f /etc/nginx/nginx.conf.backup ]]; then
        log "nginx config backup already exists"
    else
        cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    fi
    
    # Copy our nginx configuration
    cp "$(dirname "$0")/configs/nginx.conf" /etc/nginx/sites-available/bakery
    
    # Create symlink if it doesn't exist
    if [[ ! -L /etc/nginx/sites-enabled/bakery ]]; then
        ln -s /etc/nginx/sites-available/bakery /etc/nginx/sites-enabled/bakery
    fi
    
    # Remove default site if it exists
    if [[ -L /etc/nginx/sites-enabled/default ]]; then
        rm /etc/nginx/sites-enabled/default
    fi
    
    # Test nginx configuration
    nginx -t || error "nginx configuration test failed"
    
    # Start and enable nginx
    systemctl enable nginx
    systemctl restart nginx
}

# Setup UFW firewall
setup_firewall() {
    log "Setting up UFW firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH, HTTP, HTTPS
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall
    ufw --force enable
    
    log "Firewall rules:"
    ufw status numbered
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    if [[ "$DOMAIN" == "your-domain.com" ]]; then
        warn "Skipping SSL setup - please update DOMAIN variable in script"
        return 0
    fi
    
    log "Setting up SSL certificate for $DOMAIN..."
    
    # Obtain SSL certificate
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"
    
    # Setup auto-renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
}

# Setup database directory
setup_database() {
    log "Setting up database directory..."
    
    DB_DIR="$PROJECT_DIR/data"
    mkdir -p "$DB_DIR"
    chown -R "$PROJECT_USER:$PROJECT_USER" "$DB_DIR"
    chmod 750 "$DB_DIR"
    
    log "Database directory created at $DB_DIR"
}

# Setup log directories
setup_logging() {
    log "Setting up log directories..."
    
    LOG_DIR="/var/log/bakery"
    mkdir -p "$LOG_DIR"
    chown -R "$PROJECT_USER:$PROJECT_USER" "$LOG_DIR"
    
    # Setup logrotate for bakery logs
    cat > /etc/logrotate.d/bakery << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 $PROJECT_USER $PROJECT_USER
}
EOF
}

# Create systemd service for PM2
create_pm2_service() {
    log "Creating systemd service for PM2..."
    
    cat > /etc/systemd/system/bakery-pm2.service << EOF
[Unit]
Description=PM2 process manager for Bakery applications
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=notify
User=$PROJECT_USER
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/$PROJECT_USER/.npm-global/bin
Environment=PM2_HOME=/home/$PROJECT_USER/.pm2
PIDFile=/home/$PROJECT_USER/.pm2/pm2.pid
Restart=on-failure
StartLimitInterval=60s
StartLimitBurst=3
ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable bakery-pm2.service
}

# Install fail2ban for security
setup_fail2ban() {
    log "Configuring fail2ban..."
    
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2
EOF
    
    systemctl enable fail2ban
    systemctl restart fail2ban
}

# Setup swap if needed (important for Raspberry Pi)
setup_swap() {
    # Check if swap already exists
    if swapon --show | grep -q "/swapfile"; then
        log "Swap file already exists"
        return 0
    fi
    
    # Check available memory
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    
    if [[ $MEMORY_GB -lt 4 ]]; then
        log "Setting up swap file (detected ${MEMORY_GB}GB RAM)..."
        
        # Create 2GB swap file
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        
        # Make permanent
        echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
        
        # Optimize swap usage
        echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf
        echo 'vm.vfs_cache_pressure=50' | tee -a /etc/sysctl.conf
    else
        log "Sufficient RAM detected (${MEMORY_GB}GB), skipping swap setup"
    fi
}

# Performance optimizations for Raspberry Pi
optimize_performance() {
    log "Applying performance optimizations..."
    
    # Increase file descriptor limits
    cat > /etc/security/limits.d/bakery.conf << EOF
$PROJECT_USER soft nofile 65536
$PROJECT_USER hard nofile 65536
$PROJECT_USER soft nproc 4096
$PROJECT_USER hard nproc 4096
EOF
    
    # Optimize kernel parameters
    cat >> /etc/sysctl.conf << EOF

# Bakery optimizations
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.core.netdev_max_backlog = 5000
fs.file-max = 2097152
EOF
    
    sysctl -p
}

# Main installation function
main() {
    log "Starting Raspberry Pi Production Setup for Bakery Monorepo"
    log "================================================================"
    
    check_root
    check_system
    
    # System setup
    update_system
    install_nodejs
    install_system_dependencies
    setup_swap
    optimize_performance
    
    # User and directory setup
    create_project_user
    setup_database
    setup_logging
    
    # Application setup
    install_pm2
    create_pm2_service
    
    # Web server and security
    configure_nginx
    setup_firewall
    setup_ssl
    setup_fail2ban
    
    log "================================================================"
    log "Setup completed successfully!"
    log "================================================================"
    info "Next steps:"
    info "1. Update DOMAIN and EMAIL variables in this script if using SSL"
    info "2. Copy your project files to $PROJECT_DIR"
    info "3. Run the deployment script: ./deployment/scripts/deploy.sh"
    info "4. Configure PM2 ecosystem: pm2 start ecosystem.config.js"
    info ""
    info "Important files:"
    info "- Project directory: $PROJECT_DIR"
    info "- nginx config: /etc/nginx/sites-available/bakery"
    info "- PM2 service: /etc/systemd/system/bakery-pm2.service"
    info "- Logs: /var/log/bakery/"
    info ""
    info "Useful commands:"
    info "- Check PM2 status: sudo -u $PROJECT_USER pm2 status"
    info "- Check nginx status: systemctl status nginx"
    info "- Check firewall: ufw status"
    info "- Check logs: journalctl -u bakery-pm2.service -f"
}

# Run main function
main "$@"