#!/bin/bash

# Raspberry Pi npm install setup script with Node.js v22 installation
# This script prepares the environment and installs dependencies for the bakery website on Raspberry Pi
# Supports fresh Raspberry Pi OS installation (32-bit and 64-bit)

set -e

# Script version
SCRIPT_VERSION="2.0.0"

echo "🍓 Raspberry Pi Setup Script v${SCRIPT_VERSION}"
echo "   Setting up Node.js v22 and bakery website environment..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ]${NC} $1"
}

print_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}▶ $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check internet connectivity
check_internet() {
    if ping -c 1 google.com &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to get available disk space in GB
get_disk_space() {
    df -BG / | awk 'NR==2 {print $4}' | sed 's/G//'
}

# Function to get total RAM in MB
get_total_ram() {
    free -m | awk 'NR==2 {print $2}'
}

# Function to show spinner during long operations
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Detect architecture
detect_architecture() {
    local arch=$(uname -m)
    case $arch in
        armv7*)
            echo "armv7l"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            echo "$arch"
            ;;
    esac
}

# ========================================
# PRE-FLIGHT CHECKS
# ========================================

print_step "Step 1/11: Pre-flight Checks"

# Check if running on Raspberry Pi
if [[ -f /proc/device-tree/model ]]; then
    MODEL=$(tr -d '\0' < /proc/device-tree/model)
    print_status "Detected: $MODEL"
else
    print_warning "Not running on Raspberry Pi, but continuing anyway..."
fi

# Detect architecture
ARCH=$(detect_architecture)
print_info "Architecture: $ARCH"

# Check OS version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    print_info "OS: $PRETTY_NAME"

    # Check if it's Raspberry Pi OS
    if [[ "$ID" != "raspbian" && "$ID" != "debian" ]]; then
        print_warning "Not running Raspberry Pi OS, some features may not work correctly"
    fi
else
    print_warning "Cannot detect OS version"
fi

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
   print_error "Please do not run this script as root!"
   print_info "Run as a regular user. The script will use sudo when needed."
   exit 1
fi

# Check internet connectivity
print_info "Checking internet connectivity..."
if ! check_internet; then
    print_error "No internet connection detected!"
    print_info "Please ensure you have a working internet connection and try again."
    exit 1
fi
print_status "Internet connection OK"

# Check available disk space
DISK_SPACE=$(get_disk_space)
if [ "$DISK_SPACE" -lt 4 ]; then
    print_error "Insufficient disk space! At least 4GB required, only ${DISK_SPACE}GB available."
    exit 1
fi
print_status "Disk space OK (${DISK_SPACE}GB available)"

# Check RAM
TOTAL_RAM=$(get_total_ram)
print_info "Total RAM: ${TOTAL_RAM}MB"
if [ "$TOTAL_RAM" -lt 1024 ]; then
    print_warning "Low RAM detected. Will configure swap space for better performance."
    NEED_SWAP=true
else
    NEED_SWAP=false
fi

# ========================================
# SWAP CONFIGURATION
# ========================================

if [ "$NEED_SWAP" = true ]; then
    print_step "Step 2/11: Configuring Swap Space"

    # Check current swap
    CURRENT_SWAP=$(free -m | awk 'NR==3 {print $2}')
    print_info "Current swap: ${CURRENT_SWAP}MB"

    if [ "$CURRENT_SWAP" -lt 2048 ]; then
        print_info "Configuring 2GB swap space..."

        # Stop swap
        sudo dphys-swapfile swapoff 2>/dev/null || true

        # Configure new swap size
        sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile 2>/dev/null || \
            echo "CONF_SWAPSIZE=2048" | sudo tee /etc/dphys-swapfile > /dev/null

        # Setup and enable swap
        sudo dphys-swapfile setup
        sudo dphys-swapfile swapon

        NEW_SWAP=$(free -m | awk 'NR==3 {print $2}')
        print_status "Swap configured: ${NEW_SWAP}MB"
    else
        print_status "Swap space already sufficient"
    fi
else
    print_step "Step 2/11: Swap Configuration (Skipped - Sufficient RAM)"
fi

# ========================================
# NODE.JS v22 INSTALLATION
# ========================================

print_step "Step 3/11: Installing Node.js v22"

# Check if Node.js is installed and its version
if command_exists node; then
    NODE_VERSION=$(node -v)
    print_info "Current Node.js version: $NODE_VERSION"

    # Check if it's v22
    if [[ "$NODE_VERSION" == v22* ]]; then
        print_status "Node.js v22 already installed"
    else
        print_warning "Node.js $NODE_VERSION found, will upgrade to v22"
        NEED_NODE_INSTALL=true
    fi
else
    print_info "Node.js not found, will install v22"
    NEED_NODE_INSTALL=true
fi

if [ "${NEED_NODE_INSTALL:-false}" = true ]; then
    print_info "Installing Node.js v22..."

    # Remove old Node.js versions if present
    print_info "Removing old Node.js installations..."
    sudo apt-get remove -y nodejs npm 2>/dev/null || true
    sudo apt-get autoremove -y 2>/dev/null || true

    # Install prerequisites
    print_info "Installing prerequisites..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg

    # Add NodeSource repository for Node.js v22
    print_info "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

    # Install Node.js v22
    print_info "Installing Node.js v22..."
    sudo apt-get install -y nodejs

    # Verify installation
    if command_exists node && command_exists npm; then
        NODE_VERSION=$(node -v)
        NPM_VERSION=$(npm -v)
        print_status "Node.js installed: $NODE_VERSION"
        print_status "npm installed: $NPM_VERSION"
    else
        print_error "Failed to install Node.js!"
        exit 1
    fi
fi

# Install global npm packages
print_info "Installing global npm packages..."
sudo npm install -g node-gyp npm@latest 2>/dev/null || npm install -g node-gyp

# ========================================
# SYSTEM DEPENDENCIES
# ========================================

print_step "Step 4/11: Installing System Dependencies"

print_info "Updating package lists..."
sudo apt-get update

print_info "Installing build tools and libraries..."
sudo apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    python3 \
    python3-pip \
    make \
    cmake \
    g++ \
    gcc \
    libsqlite3-dev \
    libvips-dev \
    libglib2.0-dev \
    libgirepository1.0-dev \
    libcairo2-dev \
    libjpeg-dev \
    libpng-dev \
    libwebp-dev \
    libpango1.0-dev \
    chromium-browser \
    chromium-codecs-ffmpeg \
    chromium-codecs-ffmpeg-extra \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2

print_status "System dependencies installed"

# ========================================
# CLEAN PREVIOUS INSTALLATIONS
# ========================================

print_step "Step 5/11: Cleaning Previous Installation"

print_info "Removing old node_modules and lock files..."
rm -rf node_modules
rm -rf ~/.npm
rm -f package-lock.json
rm -rf apps/*/node_modules
rm -f apps/*/package-lock.json
rm -rf .nx

print_info "Cleaning npm cache..."
npm cache clean --force

print_status "Previous installation cleaned"

# ========================================
# CONFIGURE NPM FOR RASPBERRY PI
# ========================================

print_step "Step 6/11: Configuring npm for Raspberry Pi"

# Set Node.js memory limit based on available RAM
if [ "$TOTAL_RAM" -lt 2048 ]; then
    NODE_MEMORY=1536
elif [ "$TOTAL_RAM" -lt 4096 ]; then
    NODE_MEMORY=2048
else
    NODE_MEMORY=3072
fi

print_info "Setting Node.js memory limit to ${NODE_MEMORY}MB"
export NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY}"

# Add to bashrc for persistence
if ! grep -q "NODE_OPTIONS" ~/.bashrc; then
    echo "export NODE_OPTIONS=\"--max-old-space-size=${NODE_MEMORY}\"" >> ~/.bashrc
    print_status "Added NODE_OPTIONS to ~/.bashrc"
fi

# Configure npm
print_info "Configuring npm settings..."
npm config set registry https://registry.npmjs.org/
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set cache-min 3600
npm config set python python3
npm config set maxsockets 3
npm config set progress true

# Set architecture-specific configurations
if [ "$ARCH" = "arm64" ]; then
    npm config set target_arch arm64
    npm config set target_platform linux
    npm config set arch arm64
else
    npm config set target_arch arm
    npm config set target_platform linux
    npm config set arch arm
fi

print_status "npm configured for Raspberry Pi"

# ========================================
# CREATE CONFIGURATION FILES
# ========================================

print_step "Step 7/11: Creating Configuration Files"

# Create .npmrc
print_info "Creating .npmrc configuration..."
cat > .npmrc << 'EOF'
# Raspberry Pi specific npm configuration
registry=https://registry.npmjs.org/
fetch-retries=5
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
maxsockets=3
progress=true

# Skip Puppeteer Chromium download (use system Chromium)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Sharp configuration for ARM (updated for latest versions)
sharp_binary_host=https://github.com/lovell/sharp/releases/download
sharp_libvips_binary_host=https://github.com/lovell/sharp-libvips/releases/download
sharp_ignore_global_libvips=true

# Better SQLite3 configuration
node_sqlite3_binary_host_mirror=https://github.com/mapbox/node-sqlite3/releases/download/
build_from_source=false
prefer_binary=true

# bcrypt configuration
bcrypt_node_pre_gyp_host=https://github.com/kelektiv/node.bcrypt.js/releases/download

# Canvas prebuilt binaries
canvas_binary_host_mirror=https://github.com/Automattic/node-canvas/releases/download/

# Increase timeouts for slow devices
timeout=120000
fetch-timeout=120000
audit-level=none

# Node.js v22 specific
legacy-peer-deps=true
force=false
save-exact=false
EOF

print_status ".npmrc created"

# Create puppeteer configuration
print_info "Creating Puppeteer configuration..."
cat > .puppeteerrc.cjs << 'EOF'
const { join } = require('path');

/**
 * Puppeteer configuration for Raspberry Pi
 * Uses system-installed Chromium instead of downloading
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  skipDownload: true,
  executablePath: '/usr/bin/chromium-browser',
  // Raspberry Pi optimized launch arguments
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--single-process', // Important for low-memory devices
    ],
  },
};
EOF

print_status ".puppeteerrc.cjs created"

# ========================================
# INSTALL NPM DEPENDENCIES
# ========================================

print_step "Step 8/11: Installing npm Dependencies"

print_info "This will take some time on Raspberry Pi. Please be patient..."
print_warning "Estimated time: 10-20 minutes depending on your Pi model and internet speed"

# Function to try npm install with different strategies
try_npm_install() {
    local attempt=1
    local max_attempts=3

    while [ $attempt -le $max_attempts ]; do
        print_info "Installation attempt $attempt of $max_attempts..."

        if [ $attempt -eq 1 ]; then
            # First attempt: standard install with optimizations
            print_info "Strategy: Standard installation with Raspberry Pi optimizations"
            npm install --legacy-peer-deps --prefer-offline --no-audit --maxsockets=3 2>&1 | while read line; do
                echo "  $line"
            done
        elif [ $attempt -eq 2 ]; then
            # Second attempt: without optional dependencies
            print_warning "Retrying without optional dependencies..."
            npm install --no-optional --legacy-peer-deps --maxsockets=2 2>&1 | while read line; do
                echo "  $line"
            done
        else
            # Third attempt: install problematic packages separately
            print_warning "Installing problematic packages separately..."

            # Install bcrypt from source if needed
            npm install bcrypt --build-from-source --legacy-peer-deps 2>&1 | while read line; do
                echo "  $line"
            done

            # Install sharp with platform specification
            if [ "$ARCH" = "arm64" ]; then
                npm install sharp --platform=linux --arch=arm64 --legacy-peer-deps 2>&1 | while read line; do
                    echo "  $line"
                done
            else
                npm install sharp --platform=linux --arch=arm --legacy-peer-deps 2>&1 | while read line; do
                    echo "  $line"
                done
            fi

            # Install sqlite3
            npm install sqlite3 --build-from-source --legacy-peer-deps 2>&1 | while read line; do
                echo "  $line"
            done

            # Try the rest
            npm install --legacy-peer-deps --maxsockets=1 2>&1 | while read line; do
                echo "  $line"
            done
        fi

        # Check if installation was successful
        if [ -d "node_modules" ] && [ -f "node_modules/.bin/nx" ]; then
            print_status "npm dependencies installed successfully!"
            return 0
        fi

        attempt=$((attempt + 1))

        if [ $attempt -le $max_attempts ]; then
            print_warning "Installation failed, cleaning and retrying..."
            rm -rf node_modules
            npm cache clean --force
        fi
    done

    return 1
}

# Try to install dependencies
if ! try_npm_install; then
    print_error "Failed to install npm dependencies after multiple attempts"
    print_info "Please check the error messages above and try running:"
    print_info "  npm install --legacy-peer-deps --verbose"
    exit 1
fi

# ========================================
# BUILD PROJECT
# ========================================

print_step "Step 9/11: Building the Project"

print_info "Building all applications..."
print_warning "This may take 5-10 minutes on Raspberry Pi"

# Try to build with reduced parallelism for Raspberry Pi
if npm run build:all -- --parallel=1; then
    print_status "Project built successfully!"
else
    print_warning "Build failed, but installation may still work for development"
    print_info "You can try building individual apps later with:"
    print_info "  npm run build:landing"
    print_info "  npm run build:shop"
    print_info "  npm run build:management"
fi

# ========================================
# VERIFICATION
# ========================================

print_step "Step 10/11: Verifying Installation"

# Check Node.js and npm
print_info "Checking Node.js and npm..."
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
print_status "Node.js: $NODE_VERSION"
print_status "npm: $NPM_VERSION"

# Check if nx is available
if [ -f "node_modules/.bin/nx" ]; then
    print_status "Nx CLI available"
else
    print_error "Nx CLI not found"
fi

# Check Chromium
if command_exists chromium-browser; then
    CHROMIUM_VERSION=$(chromium-browser --version 2>/dev/null | head -n1)
    print_status "Chromium: $CHROMIUM_VERSION"
else
    print_warning "Chromium not found - Puppeteer tests may fail"
fi

# Check memory settings
if [ -n "$NODE_OPTIONS" ]; then
    print_status "Node.js memory limit: $NODE_OPTIONS"
fi

# ========================================
# COMPLETION
# ========================================

print_step "Step 11/11: Setup Complete!"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   🎉 Raspberry Pi setup completed successfully! 🎉${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}System Information:${NC}"
echo "  • Model: ${MODEL:-Unknown}"
echo "  • Architecture: $ARCH"
echo "  • Node.js: $NODE_VERSION"
echo "  • npm: $NPM_VERSION"
echo "  • RAM: ${TOTAL_RAM}MB"
echo "  • Available disk: ${DISK_SPACE}GB"
echo ""
echo -e "${CYAN}You can now run the following commands:${NC}"
echo ""
echo -e "  ${YELLOW}Development mode:${NC}"
echo "    npm run dev              # Run all services"
echo "    npm run serve:api        # Backend API only"
echo "    npm run serve:shop       # Shop frontend only"
echo "    npm run serve:management # Management frontend only"
echo "    npm run dev:landing      # Landing page only"
echo ""
echo -e "  ${YELLOW}Production mode:${NC}"
echo "    npm run build:all        # Build all applications"
echo "    npm run start            # Start production server"
echo ""
echo -e "  ${YELLOW}Testing:${NC}"
echo "    npm run test:all         # Run all tests"
echo "    npm run lint:all         # Run linting"
echo ""
echo -e "${GREEN}For troubleshooting, see: docs/raspberry-pi-setup.md${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Create a setup completion marker
echo "$(date): Setup completed with Node.js $NODE_VERSION" > .raspberry-pi-setup-complete

exit 0
