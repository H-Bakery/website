#!/bin/bash

# Monitoring Setup Script
# Installs and configures Prometheus, Grafana, and exporters
# Version: 1.0.0

set -e

# Configuration
PROMETHEUS_VERSION="2.45.0"
GRAFANA_VERSION="10.0.0"
NODE_EXPORTER_VERSION="1.6.0"
ALERTMANAGER_VERSION="0.25.0"
INSTALL_DIR="/opt/monitoring"
DATA_DIR="/var/lib/monitoring"
CONFIG_DIR="/etc/monitoring"
MONITORING_USER="prometheus"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
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
        error "This script must be run as root"
    fi
}

# Detect architecture
detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)
            ARCH_SUFFIX="linux-amd64"
            ;;
        aarch64|arm64)
            ARCH_SUFFIX="linux-arm64"
            ;;
        armv7l)
            ARCH_SUFFIX="linux-armv7"
            ;;
        *)
            error "Unsupported architecture: $ARCH"
            ;;
    esac
    log "Detected architecture: $ARCH ($ARCH_SUFFIX)"
}

# Create monitoring user
create_user() {
    if ! id "$MONITORING_USER" &>/dev/null; then
        log "Creating monitoring user: $MONITORING_USER"
        useradd --system --no-create-home --shell /bin/false "$MONITORING_USER"
    else
        log "User $MONITORING_USER already exists"
    fi
}

# Create directories
create_directories() {
    log "Creating monitoring directories..."
    
    mkdir -p "$INSTALL_DIR"/{prometheus,grafana,node_exporter,alertmanager}
    mkdir -p "$DATA_DIR"/{prometheus,grafana,alertmanager}
    mkdir -p "$CONFIG_DIR"/{prometheus,grafana,alertmanager}
    mkdir -p /var/log/monitoring
    
    # Set permissions
    chown -R "$MONITORING_USER:$MONITORING_USER" "$DATA_DIR"
    chown -R "$MONITORING_USER:$MONITORING_USER" /var/log/monitoring
}

# Install Prometheus
install_prometheus() {
    log "Installing Prometheus $PROMETHEUS_VERSION..."
    
    cd /tmp
    
    # Download Prometheus
    wget -q "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.${ARCH_SUFFIX}.tar.gz"
    tar -xzf "prometheus-${PROMETHEUS_VERSION}.${ARCH_SUFFIX}.tar.gz"
    
    # Copy binaries
    cp "prometheus-${PROMETHEUS_VERSION}.${ARCH_SUFFIX}/prometheus" "$INSTALL_DIR/prometheus/"
    cp "prometheus-${PROMETHEUS_VERSION}.${ARCH_SUFFIX}/promtool" "$INSTALL_DIR/prometheus/"
    
    # Copy console files
    cp -r "prometheus-${PROMETHEUS_VERSION}.${ARCH_SUFFIX}/consoles" "$INSTALL_DIR/prometheus/"
    cp -r "prometheus-${PROMETHEUS_VERSION}.${ARCH_SUFFIX}/console_libraries" "$INSTALL_DIR/prometheus/"
    
    # Make executable
    chmod +x "$INSTALL_DIR/prometheus/prometheus"
    chmod +x "$INSTALL_DIR/prometheus/promtool"
    
    # Copy configuration
    cp "$(dirname "$0")/prometheus.yml" "$CONFIG_DIR/prometheus/"
    
    # Create rules directory
    mkdir -p "$CONFIG_DIR/prometheus/rules"
    cp "$(dirname "$0")/alert-rules.yml" "$CONFIG_DIR/prometheus/rules/"
    
    # Create systemd service
    cat > /etc/systemd/system/prometheus.service << EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=$MONITORING_USER
Group=$MONITORING_USER
Type=simple
ExecStart=$INSTALL_DIR/prometheus/prometheus \\
    --config.file=$CONFIG_DIR/prometheus/prometheus.yml \\
    --storage.tsdb.path=$DATA_DIR/prometheus \\
    --web.console.templates=$INSTALL_DIR/prometheus/consoles \\
    --web.console.libraries=$INSTALL_DIR/prometheus/console_libraries \\
    --web.enable-lifecycle \\
    --storage.tsdb.retention.time=30d

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    # Clean up
    rm -rf "/tmp/prometheus-${PROMETHEUS_VERSION}.${ARCH_SUFFIX}"*
    
    log "Prometheus installed successfully"
}

# Install Node Exporter
install_node_exporter() {
    log "Installing Node Exporter $NODE_EXPORTER_VERSION..."
    
    cd /tmp
    
    # Download Node Exporter
    wget -q "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.${ARCH_SUFFIX}.tar.gz"
    tar -xzf "node_exporter-${NODE_EXPORTER_VERSION}.${ARCH_SUFFIX}.tar.gz"
    
    # Copy binary
    cp "node_exporter-${NODE_EXPORTER_VERSION}.${ARCH_SUFFIX}/node_exporter" "$INSTALL_DIR/node_exporter/"
    chmod +x "$INSTALL_DIR/node_exporter/node_exporter"
    
    # Create systemd service
    cat > /etc/systemd/system/node_exporter.service << EOF
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=$MONITORING_USER
Group=$MONITORING_USER
Type=simple
ExecStart=$INSTALL_DIR/node_exporter/node_exporter \\
    --collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/) \\
    --collector.netclass.ignored-devices=^(veth.*|br.*|docker.*) \\
    --collector.textfile.directory=/var/lib/node_exporter/textfile_collector

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    # Create textfile collector directory
    mkdir -p /var/lib/node_exporter/textfile_collector
    chown "$MONITORING_USER:$MONITORING_USER" /var/lib/node_exporter/textfile_collector
    
    # Clean up
    rm -rf "/tmp/node_exporter-${NODE_EXPORTER_VERSION}.${ARCH_SUFFIX}"*
    
    log "Node Exporter installed successfully"
}

# Install Grafana
install_grafana() {
    log "Installing Grafana..."
    
    # Add Grafana repository
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        apt-get install -y software-properties-common
        add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
        wget -q -O - https://packages.grafana.com/gpg.key | apt-key add -
        apt-get update
        apt-get install -y grafana
    elif command -v yum &> /dev/null; then
        # RHEL/CentOS
        cat > /etc/yum.repos.d/grafana.repo << EOF
[grafana]
name=grafana
baseurl=https://packages.grafana.com/oss/rpm
repo_gpgcheck=1
enabled=1
gpgcheck=1
gpgkey=https://packages.grafana.com/gpg.key
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
EOF
        yum install -y grafana
    else
        warn "Cannot install Grafana automatically on this system"
        return 1
    fi
    
    # Configure Grafana
    cat > /etc/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: true
EOF
    
    # Copy dashboard
    mkdir -p /etc/grafana/provisioning/dashboards
    cp "$(dirname "$0")/grafana-dashboard.json" /etc/grafana/provisioning/dashboards/
    
    cat > /etc/grafana/provisioning/dashboards/bakery.yml << EOF
apiVersion: 1

providers:
  - name: 'Bakery'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /etc/grafana/provisioning/dashboards
EOF
    
    log "Grafana installed successfully"
}

# Install Alertmanager
install_alertmanager() {
    log "Installing Alertmanager $ALERTMANAGER_VERSION..."
    
    cd /tmp
    
    # Download Alertmanager
    wget -q "https://github.com/prometheus/alertmanager/releases/download/v${ALERTMANAGER_VERSION}/alertmanager-${ALERTMANAGER_VERSION}.${ARCH_SUFFIX}.tar.gz"
    tar -xzf "alertmanager-${ALERTMANAGER_VERSION}.${ARCH_SUFFIX}.tar.gz"
    
    # Copy binaries
    cp "alertmanager-${ALERTMANAGER_VERSION}.${ARCH_SUFFIX}/alertmanager" "$INSTALL_DIR/alertmanager/"
    cp "alertmanager-${ALERTMANAGER_VERSION}.${ARCH_SUFFIX}/amtool" "$INSTALL_DIR/alertmanager/"
    chmod +x "$INSTALL_DIR/alertmanager/alertmanager"
    chmod +x "$INSTALL_DIR/alertmanager/amtool"
    
    # Create configuration
    cat > "$CONFIG_DIR/alertmanager/alertmanager.yml" << EOF
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  
  routes:
    - match:
        severity: critical
      receiver: critical
      continue: true

receivers:
  - name: 'default'
    # Configure your notification channels here
    # Example: email, slack, webhook, etc.
    
  - name: 'critical'
    # Configure critical alert notifications

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
EOF
    
    # Create systemd service
    cat > /etc/systemd/system/alertmanager.service << EOF
[Unit]
Description=Alertmanager
Wants=network-online.target
After=network-online.target

[Service]
User=$MONITORING_USER
Group=$MONITORING_USER
Type=simple
ExecStart=$INSTALL_DIR/alertmanager/alertmanager \\
    --config.file=$CONFIG_DIR/alertmanager/alertmanager.yml \\
    --storage.path=$DATA_DIR/alertmanager

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    # Clean up
    rm -rf "/tmp/alertmanager-${ALERTMANAGER_VERSION}.${ARCH_SUFFIX}"*
    
    log "Alertmanager installed successfully"
}

# Configure nginx for monitoring endpoints
configure_nginx() {
    log "Configuring nginx for monitoring endpoints..."
    
    # Add monitoring location blocks to nginx config
    cat > /tmp/nginx-monitoring.conf << 'EOF'
# Prometheus metrics endpoint (internal only)
location /metrics {
    allow 127.0.0.1;
    deny all;
    
    # Basic metrics
    stub_status on;
    access_log off;
}

# Grafana proxy
location /grafana/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket support for live updates
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# Prometheus proxy (protected)
location /prometheus/ {
    # Add authentication
    auth_basic "Prometheus";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    proxy_pass http://localhost:9090/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
EOF
    
    info "Add the contents of /tmp/nginx-monitoring.conf to your nginx configuration"
}

# Start services
start_services() {
    log "Starting monitoring services..."
    
    systemctl daemon-reload
    
    # Enable and start services
    systemctl enable prometheus node_exporter grafana-server alertmanager
    systemctl start prometheus node_exporter grafana-server alertmanager
    
    # Check status
    sleep 5
    
    for service in prometheus node_exporter grafana-server alertmanager; do
        if systemctl is-active --quiet $service; then
            log "$service is running"
        else
            error "$service failed to start"
        fi
    done
}

# Create monitoring scripts
create_monitoring_scripts() {
    log "Creating monitoring helper scripts..."
    
    # Create metrics collection script
    cat > /usr/local/bin/bakery-metrics << 'EOF'
#!/bin/bash
# Collect custom metrics for Bakery system

TEXTFILE_DIR="/var/lib/node_exporter/textfile_collector"

# Collect database metrics
if [[ -f "/home/bakery/bakery/data/bakery.db" ]]; then
    DB_SIZE=$(stat -c%s "/home/bakery/bakery/data/bakery.db")
    echo "# HELP bakery_database_size_bytes Size of the SQLite database" > "$TEXTFILE_DIR/bakery.prom.$$"
    echo "# TYPE bakery_database_size_bytes gauge" >> "$TEXTFILE_DIR/bakery.prom.$$"
    echo "bakery_database_size_bytes $DB_SIZE" >> "$TEXTFILE_DIR/bakery.prom.$$"
    
    # Count tables (if sqlite3 is available)
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 "/home/bakery/bakery/data/bakery.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
        echo "# HELP bakery_database_tables_total Number of tables in database" >> "$TEXTFILE_DIR/bakery.prom.$$"
        echo "# TYPE bakery_database_tables_total gauge" >> "$TEXTFILE_DIR/bakery.prom.$$"
        echo "bakery_database_tables_total $TABLE_COUNT" >> "$TEXTFILE_DIR/bakery.prom.$$"
    fi
    
    mv "$TEXTFILE_DIR/bakery.prom.$$" "$TEXTFILE_DIR/bakery.prom"
fi

# Collect PM2 metrics
if command -v pm2 &> /dev/null; then
    pm2 jlist | jq -r '.[] | 
        "pm2_process_memory_bytes{name=\"\(.name)\",pm_id=\"\(.pm_id)\"} \(.monit.memory)\n" +
        "pm2_process_cpu_percent{name=\"\(.name)\",pm_id=\"\(.pm_id)\"} \(.monit.cpu)\n" +
        "pm2_process_status{name=\"\(.name)\",pm_id=\"\(.pm_id)\",status=\"\(.pm2_env.status)\"} " +
        (if .pm2_env.status == "online" then "1" else "0" end)' \
        > "$TEXTFILE_DIR/pm2.prom.$$" 2>/dev/null
    
    if [[ -s "$TEXTFILE_DIR/pm2.prom.$$" ]]; then
        {
            echo "# HELP pm2_process_memory_bytes Memory usage of PM2 process"
            echo "# TYPE pm2_process_memory_bytes gauge"
            echo "# HELP pm2_process_cpu_percent CPU usage of PM2 process"
            echo "# TYPE pm2_process_cpu_percent gauge"
            echo "# HELP pm2_process_status Status of PM2 process"
            echo "# TYPE pm2_process_status gauge"
            cat "$TEXTFILE_DIR/pm2.prom.$$"
        } > "$TEXTFILE_DIR/pm2.prom"
    fi
    
    rm -f "$TEXTFILE_DIR/pm2.prom.$$"
fi
EOF
    
    chmod +x /usr/local/bin/bakery-metrics
    
    # Add to cron
    echo "* * * * * $MONITORING_USER /usr/local/bin/bakery-metrics" >> /etc/crontab
    
    log "Monitoring scripts created"
}

# Main installation
main() {
    echo "======================================"
    echo "Bakery Monitoring Setup"
    echo "======================================"
    echo ""
    
    check_root
    detect_arch
    create_user
    create_directories
    
    install_prometheus
    install_node_exporter
    install_grafana
    install_alertmanager
    
    configure_nginx
    create_monitoring_scripts
    start_services
    
    echo ""
    echo "======================================"
    echo "Monitoring Setup Complete!"
    echo "======================================"
    echo ""
    echo "Access points:"
    echo "  Grafana: http://localhost:3000 (admin/admin)"
    echo "  Prometheus: http://localhost:9090"
    echo "  Alertmanager: http://localhost:9093"
    echo ""
    echo "Next steps:"
    echo "1. Configure nginx with /tmp/nginx-monitoring.conf"
    echo "2. Set up alert notifications in $CONFIG_DIR/alertmanager/alertmanager.yml"
    echo "3. Configure Grafana admin password"
    echo "4. Import additional dashboards as needed"
    echo ""
    echo "Logs:"
    echo "  journalctl -u prometheus -f"
    echo "  journalctl -u grafana-server -f"
    echo "  journalctl -u node_exporter -f"
    echo "  journalctl -u alertmanager -f"
}

# Handle arguments
case "${1:-}" in
    --uninstall)
        log "Uninstalling monitoring stack..."
        systemctl stop prometheus node_exporter grafana-server alertmanager
        systemctl disable prometheus node_exporter grafana-server alertmanager
        rm -rf "$INSTALL_DIR" "$DATA_DIR" "$CONFIG_DIR"
        rm -f /etc/systemd/system/{prometheus,node_exporter,alertmanager}.service
        systemctl daemon-reload
        log "Monitoring stack uninstalled"
        ;;
    --status)
        echo "Monitoring Services Status:"
        echo "=========================="
        for service in prometheus node_exporter grafana-server alertmanager; do
            if systemctl is-active --quiet $service; then
                echo -e "$service: ${GREEN}active${NC}"
            else
                echo -e "$service: ${RED}inactive${NC}"
            fi
        done
        ;;
    --help)
        echo "Usage: $0 [--uninstall|--status|--help]"
        echo ""
        echo "Options:"
        echo "  --uninstall  Remove monitoring stack"
        echo "  --status     Check service status"
        echo "  --help       Show this help"
        ;;
    *)
        main
        ;;
esac