# Pull-Based CI/CD System for Raspberry Pi Deployment

## Overview

This guide describes implementing a secure, pull-based CI/CD system for deploying the bakery monorepo to a Raspberry Pi. Instead of external systems pushing to the Pi (requiring SSH access), the Pi polls for updates and pulls them securely, maintaining complete control over when and how deployments occur.

## Architecture Overview

The pull-based CI/CD system follows a simple, secure workflow:

1. **Developer** pushes code changes to the repository
2. **GitHub Actions** automatically builds and tests the code
3. **GitHub Actions** creates a release with deployment artifacts
4. **Raspberry Pi** polls GitHub every 5 minutes to check for new releases
5. When a new release is detected, the Pi downloads and deploys it autonomously

This architecture eliminates the need for external systems to access the Pi directly. Instead, the Pi maintains complete control by initiating all connections outward to GitHub's API to retrieve new releases when they're available.

```
┌─────────────────┐         ┌──────────────────┐        ┌─────────────────┐
│   Developer                 │        │  GitHub Actions               │        │       Raspberry Pi         │
│   Pushes Code               │────▶│   Build & Test                │────▶│          Production       │
└─────────────────┘         └──────────────────┘        └─────────────────┘
                                     │                           ▲
                                     │                           │
                                     ▼                           │
                            ┌───────────┐                │
                            │  GitHub Releases │                │
                            │   + Artifacts    │◀────────┘
                            └───────────┘
                                                   Pi polls GitHub
                                                   every 5 minutes
```

## Security Benefits

### Why Pull-Based is Safer

1. **No External Access**: Pi never exposes services to the internet
2. **Read-Only Tokens**: GitHub tokens can only read public releases
3. **No SSH Keys**: Zero private keys stored on external systems
4. **Controlled Timing**: Pi decides when to deploy, not external triggers
5. **Network Isolation**: Pi can be behind NAT/firewall without port forwarding
6. **Audit Trail**: All deployment decisions logged locally on Pi

### Security Model

- **GitHub API**: Uses readonly personal access tokens
- **HTTPS Only**: All communications encrypted in transit
- **Checksum Validation**: Artifacts verified before deployment
- **Local Execution**: All deployment scripts run locally on Pi
- **Rollback Capability**: Failed deployments automatically rolled back

## Implementation Guide

### Phase 1: GitHub Actions Setup

#### 1.1 Create Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Create Release

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:all

      - name: Build applications
        run: npm run build:all

      - name: Create deployment package
        run: |
          tar -czf bakery-deployment.tar.gz \
            dist/ \
            deployment/ \
            package.json \
            package-lock.json

      - name: Generate checksums
        run: |
          sha256sum bakery-deployment.tar.gz > checksums.txt

      - name: Create Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: |
            bakery-deployment.tar.gz
            checksums.txt
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 1.2 Automatic Versioning

For automatic releases on main branch pushes:

```yaml
- name: Generate version
  id: version
  run: |
    if [[ $GITHUB_REF == refs/tags/* ]]; then
      echo "version=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
    else
      echo "version=v$(date +%Y%m%d-%H%M%S)-${GITHUB_SHA:0:7}" >> $GITHUB_OUTPUT
    fi

- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    tag_name: ${{ steps.version.outputs.version }}
    name: Release ${{ steps.version.outputs.version }}
    files: |
      bakery-deployment.tar.gz
      checksums.txt
```

### Phase 2: Pi Polling Service

#### 2.1 Create Polling Script

Create `/home/bakery/scripts/check-updates.sh`:

```bash
#!/bin/bash

# Configuration
REPO_OWNER="yourusername"
REPO_NAME="bakery-monorepo"
GITHUB_TOKEN="ghp_xxxxxxxxxxxx"  # Read-only token
DEPLOY_DIR="/home/bakery/bakery"
TEMP_DIR="/tmp/bakery-update"
LOG_FILE="/var/log/bakery/update-check.log"
CURRENT_VERSION_FILE="$DEPLOY_DIR/.current-version"

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Get current deployed version
get_current_version() {
    if [[ -f "$CURRENT_VERSION_FILE" ]]; then
        cat "$CURRENT_VERSION_FILE"
    else
        echo "none"
    fi
}

# Get latest release from GitHub
get_latest_release() {
    curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest" \
        | jq -r '.tag_name'
}

# Download and verify release
download_release() {
    local version="$1"
    local download_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$version/bakery-deployment.tar.gz"
    local checksum_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$version/checksums.txt"

    rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"

    # Download files
    curl -L -H "Authorization: token $GITHUB_TOKEN" -o bakery-deployment.tar.gz "$download_url"
    curl -L -H "Authorization: token $GITHUB_TOKEN" -o checksums.txt "$checksum_url"

    # Verify checksum
    if sha256sum -c checksums.txt; then
        log "Checksum verification passed for version $version"
        return 0
    else
        log "ERROR: Checksum verification failed for version $version"
        return 1
    fi
}

# Deploy new version
deploy_version() {
    local version="$1"

    log "Starting deployment of version $version"

    # Extract to temporary location
    cd "$TEMP_DIR"
    tar -xzf bakery-deployment.tar.gz

    # Backup current deployment
    if [[ -d "$DEPLOY_DIR" ]]; then
        cp -r "$DEPLOY_DIR" "/tmp/bakery-backup-$(date +%Y%m%d-%H%M%S)"
    fi

    # Run existing deployment script
    cd "$DEPLOY_DIR"
    if ./deployment/scripts/deploy.sh; then
        echo "$version" > "$CURRENT_VERSION_FILE"
        log "Successfully deployed version $version"
        return 0
    else
        log "ERROR: Deployment failed for version $version"
        return 1
    fi
}

# Main execution
main() {
    log "Checking for updates..."

    local current_version=$(get_current_version)
    local latest_version=$(get_latest_release)

    if [[ "$latest_version" == "null" ]] || [[ -z "$latest_version" ]]; then
        log "No releases found"
        return 0
    fi

    log "Current version: $current_version"
    log "Latest version: $latest_version"

    if [[ "$current_version" != "$latest_version" ]]; then
        log "New version available: $latest_version"

        if download_release "$latest_version"; then
            if deploy_version "$latest_version"; then
                log "Update completed successfully"
            else
                log "Update failed, staying on version $current_version"
            fi
        else
            log "Download failed, staying on version $current_version"
        fi
    else
        log "Already on latest version"
    fi

    # Cleanup
    rm -rf "$TEMP_DIR"
}

# Run with lock to prevent concurrent executions
(
    flock -n 9 || exit 1
    main
) 9>/var/lock/bakery-update.lock
```

#### 2.2 Setup Cron Job

Add to crontab for bakery user:

```bash
# Check for updates every 5 minutes
*/5 * * * * /home/bakery/scripts/check-updates.sh

# Daily cleanup of old backups (keep last 7 days)
0 2 * * * find /tmp/bakery-backup-* -mtime +7 -exec rm -rf {} \;
```

#### 2.3 Service Configuration

Create systemd service for better control:

`/etc/systemd/system/bakery-updater.service`:

```ini
[Unit]
Description=Bakery Update Checker
After=network.target

[Service]
Type=oneshot
User=bakery
ExecStart=/home/bakery/scripts/check-updates.sh
WorkingDirectory=/home/bakery

[Install]
WantedBy=multi-user.target
```

Timer for regular execution:

`/etc/systemd/system/bakery-updater.timer`:

```ini
[Unit]
Description=Run Bakery Update Checker every 5 minutes
Requires=bakery-updater.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer:

```bash
sudo systemctl enable bakery-updater.timer
sudo systemctl start bakery-updater.timer
```

### Phase 3: Security Setup

#### 3.1 GitHub Token Creation

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Create token with ONLY these permissions:
   - `public_repo` (read access to public repositories)
   - `metadata` (read repository metadata)
3. No write permissions needed
4. Set expiration date and document renewal process

#### 3.2 Token Storage on Pi

Store token securely:

```bash
# Create secure token file
sudo mkdir -p /etc/bakery
echo "ghp_your_readonly_token_here" | sudo tee /etc/bakery/github-token
sudo chmod 600 /etc/bakery/github-token
sudo chown bakery:bakery /etc/bakery/github-token

# Update script to read token
GITHUB_TOKEN=$(cat /etc/bakery/github-token)
```

#### 3.3 Network Security

Configure firewall to allow only outbound HTTPS:

```bash
# Allow outbound HTTPS for GitHub API
sudo ufw allow out 443

# Deny all other outbound (optional, adjust as needed)
sudo ufw default deny outgoing
sudo ufw default deny incoming

# Allow local services
sudo ufw allow out 53  # DNS
sudo ufw allow out 80   # HTTP (for Let's Encrypt)
```

### Phase 4: Monitoring and Alerting

#### 4.1 Deployment Logging

Enhanced logging configuration:

```bash
# Create log directory
sudo mkdir -p /var/log/bakery
sudo chown bakery:bakery /var/log/bakery

# Setup log rotation
cat > /etc/logrotate.d/bakery << EOF
/var/log/bakery/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 bakery bakery
}
EOF
```

#### 4.2 Health Monitoring

Create health check script:

```bash
#!/bin/bash
# /home/bakery/scripts/health-check.sh

check_services() {
    pm2 status | grep -q "online" && echo "PM2: OK" || echo "PM2: ERROR"
    systemctl is-active nginx >/dev/null && echo "nginx: OK" || echo "nginx: ERROR"
    curl -s http://localhost:5000/health >/dev/null && echo "API: OK" || echo "API: ERROR"
}

check_disk_space() {
    local usage=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
    if [[ $usage -gt 90 ]]; then
        echo "DISK: WARNING - ${usage}% full"
    else
        echo "DISK: OK - ${usage}% used"
    fi
}

check_memory() {
    local available=$(free | awk 'NR==2{printf "%.0f", $7*100/$2}')
    if [[ $available -lt 10 ]]; then
        echo "MEMORY: WARNING - ${available}% available"
    else
        echo "MEMORY: OK - ${available}% available"
    fi
}

echo "=== Health Check $(date) ==="
check_services
check_disk_space
check_memory
```

#### 4.3 Email Notifications

Setup simple email notifications for deployment events:

```bash
# Install mail utilities
sudo apt install mailutils

# Configure in update script
send_notification() {
    local subject="$1"
    local message="$2"

    echo "$message" | mail -s "$subject" admin@yourdomain.com
}

# Use in deployment script
if deploy_version "$latest_version"; then
    send_notification "Deployment Success" "Successfully deployed version $latest_version"
else
    send_notification "Deployment Failed" "Failed to deploy version $latest_version"
fi
```

### Phase 5: Troubleshooting

#### 5.1 Common Issues

**Issue: GitHub API rate limiting**

```bash
# Check rate limit status
curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/rate_limit

# Solution: Reduce polling frequency or use GitHub App instead of PAT
```

**Issue: Network connectivity**

```bash
# Test GitHub connectivity
curl -I https://api.github.com

# Test DNS resolution
nslookup api.github.com

# Check firewall rules
sudo ufw status
```

**Issue: Deployment failures**

```bash
# Check deployment logs
tail -f /var/log/bakery/update-check.log

# Check PM2 status
pm2 status
pm2 logs

# Manual deployment test
cd /home/bakery/bakery
./deployment/scripts/deploy.sh
```

#### 5.2 Rollback Procedures

**Automatic rollback** (built into deploy script):

- Failed deployments automatically restore from backup

**Manual rollback**:

```bash
# List available backups
ls /tmp/bakery-backup-*

# Restore from specific backup
cp -r /tmp/bakery-backup-20240101-120000/* /home/bakery/bakery/
pm2 restart all
```

#### 5.3 Debugging Commands

```bash
# Check update service status
systemctl status bakery-updater.timer
systemctl list-timers | grep bakery

# View recent update attempts
journalctl -u bakery-updater.service -f

# Test GitHub API access
./check-updates.sh --dry-run

# Force update check
sudo -u bakery /home/bakery/scripts/check-updates.sh
```

### Phase 6: Maintenance

#### 6.1 Regular Maintenance Tasks

**Weekly:**

- Check disk space and clean old backups
- Review deployment logs for errors
- Verify GitHub token hasn't expired

**Monthly:**

- Update system packages on Pi
- Review and update dependencies
- Test rollback procedures

**Quarterly:**

- Rotate GitHub tokens
- Review security configurations
- Performance optimization

#### 6.2 Backup Strategy

**Database backups:**

```bash
# Daily database backup
0 1 * * * pg_dump bakery_production > /home/bakery/backups/db-$(date +\%Y\%m\%d).sql

# Weekly backup to external storage
0 2 * * 0 rsync -av /home/bakery/backups/ remote-server:/backup/bakery/
```

**Configuration backups:**

```bash
# Backup critical configuration files
tar -czf /home/bakery/backups/config-$(date +%Y%m%d).tar.gz \
    /etc/nginx/sites-available/bakery \
    /home/bakery/bakery/deployment/configs/ \
    /etc/bakery/
```

## Benefits Summary

### Security Advantages

- **Zero Attack Surface**: No external services exposed on Pi
- **Minimal Credentials**: Only read-only GitHub token required
- **Local Control**: Pi maintains complete control over deployment timing
- **Audit Trail**: Complete deployment history logged locally

### Operational Benefits

- **Automatic Updates**: Seamless deployment of new releases
- **Rollback Safety**: Automatic rollback on deployment failures
- **Health Monitoring**: Continuous monitoring of application health
- **Minimal Maintenance**: Self-managing system with minimal intervention required

### Cost Efficiency

- **No External Services**: Uses existing GitHub infrastructure
- **Low Resource Usage**: Minimal impact on Pi performance
- **Simple Architecture**: Easy to understand and maintain

This pull-based approach provides enterprise-grade CI/CD capabilities while maintaining maximum security and simplicity for Raspberry Pi deployment.
