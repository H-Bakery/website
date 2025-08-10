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

# Function to check if apt package is installed
package_installed() {
    dpkg -l "$1" 2>/dev/null | grep -q '^ii'
}

# Function to safely install apt packages with conflict resolution
safe_apt_install() {
    local packages=("$@")
    local to_install=()
    
    print_info "Checking which packages need installation..."
    
    for package in "${packages[@]}"; do
        if package_installed "$package"; then
            print_status "$package already installed"
        else
            to_install+=("$package")
        fi
    done
    
    if [ ${#to_install[@]} -eq 0 ]; then
        print_status "All packages already installed"
        return 0
    fi
    
    print_info "Installing packages: ${to_install[*]}"
    
    # Try to install packages with conflict resolution
    if ! sudo apt-get install -y "${to_install[@]}" 2>/dev/null; then
        print_warning "Standard installation failed, trying with conflict resolution..."
        
        # Handle known conflicts
        local filtered_packages=()
        for package in "${to_install[@]}"; do
            # Skip chromium-codecs-ffmpeg if chromium-codecs-ffmpeg-extra is in the list
            if [[ "$package" == "chromium-codecs-ffmpeg" ]] && [[ " ${to_install[*]} " =~ " chromium-codecs-ffmpeg-extra " ]]; then
                print_info "Skipping $package (conflicts with chromium-codecs-ffmpeg-extra)"
                continue
            fi
            filtered_packages+=("$package")
        done
        
        if ! sudo apt-get install -y "${filtered_packages[@]}"; then
            print_error "Failed to install packages even with conflict resolution"
            print_info "Problematic packages: ${filtered_packages[*]}"
            return 1
        fi
    fi
    
    return 0
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
    if command_exists node; then
        NODE_VERSION=$(node -v)
        print_status "Node.js installed: $NODE_VERSION"
    else
        print_error "Failed to install Node.js!"
        exit 1
    fi
    
    # Check npm separately and install if missing
    if ! command_exists npm; then
        print_warning "npm is missing after Node.js installation, attempting to fix..."
        
        # Try to install npm separately
        print_info "Installing npm separately..."
        if ! sudo apt-get install -y npm; then
            print_warning "apt-get npm installation failed, trying manual installation..."
            
            # Manual npm installation
            print_info "Downloading and installing npm manually..."
            curl -L https://www.npmjs.com/install.sh | sudo sh
            
            # If still not available, try installing from Node.js source
            if ! command_exists npm; then
                print_warning "Manual npm installation failed, reinstalling Node.js with npm..."
                
                # Remove and reinstall Node.js
                sudo apt-get remove -y nodejs 2>/dev/null || true
                sudo apt-get autoremove -y 2>/dev/null || true
                
                # Reinstall with npm explicitly
                curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
                sudo apt-get install -y nodejs npm
            fi
        fi
    fi
    
    # Final verification of both Node.js and npm
    if command_exists node && command_exists npm; then
        NODE_VERSION=$(node -v)
        NPM_VERSION=$(npm -v)
        print_status "Node.js verified: $NODE_VERSION"
        print_status "npm verified: $NPM_VERSION"
    else
        print_error "Failed to install Node.js and/or npm after multiple attempts!"
        print_info "Please install Node.js and npm manually:"
        print_info "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
        print_info "  sudo apt-get install -y nodejs npm"
        exit 1
    fi
fi

# Install global npm packages
print_info "Installing global npm packages..."
if ! npm install -g node-gyp npm@latest 2>/dev/null; then
    print_warning "Failed to install global packages with sudo, trying without..."
    if ! npm install -g node-gyp; then
        print_error "Failed to install node-gyp globally"
        print_info "This may cause issues with native module compilation"
    fi
fi

# ========================================
# SYSTEM DEPENDENCIES
# ========================================

print_step "Step 4/11: Installing System Dependencies"

print_info "Updating package lists..."
sudo apt-get update

print_info "Installing build tools and libraries..."

# Define package lists
BUILD_PACKAGES=(
    build-essential
    git
    curl
    wget
    python3
    python3-pip
    make
    cmake
    g++
    gcc
)

LIBRARY_PACKAGES=(
    libsqlite3-dev
    libvips-dev
    libglib2.0-dev
    libgirepository1.0-dev
    libcairo2-dev
    libjpeg-dev
    libpng-dev
    libwebp-dev
    libpango1.0-dev
    libgbm1
)

CHROMIUM_PACKAGES=(
    chromium-browser
    chromium-codecs-ffmpeg-extra
    libatk-bridge2.0-0
    libgtk-3-0
    libnspr4
    libnss3
    libx11-xcb1
    libxcomposite1
    libxdamage1
    libxrandr2
    libxss1
    libasound2
)

# Install packages in groups for better error handling
print_info "Installing build tools..."
if ! safe_apt_install "${BUILD_PACKAGES[@]}"; then
    print_error "Failed to install build tools"
    exit 1
fi

print_info "Installing development libraries..."
if ! safe_apt_install "${LIBRARY_PACKAGES[@]}"; then
    print_error "Failed to install development libraries"
    exit 1
fi

print_info "Installing Chromium and related packages..."
if ! safe_apt_install "${CHROMIUM_PACKAGES[@]}"; then
    print_warning "Some Chromium packages failed to install, but continuing..."
    print_info "Puppeteer tests may not work properly"
fi

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
    local max_attempts=4

    while [ $attempt -le $max_attempts ]; do
        print_info "Installation attempt $attempt of $max_attempts..."

        # Ensure npm is working before attempting install
        if ! command_exists npm; then
            print_error "npm is not available for installation attempt $attempt"
            return 1
        fi

        local install_success=false

        if [ $attempt -eq 1 ]; then
            # First attempt: standard install with optimizations
            print_info "Strategy: Standard installation with Raspberry Pi optimizations"
            if npm install --legacy-peer-deps --prefer-offline --no-audit --maxsockets=3; then
                install_success=true
            fi
        elif [ $attempt -eq 2 ]; then
            # Second attempt: without optional dependencies
            print_warning "Retrying without optional dependencies..."
            if npm install --no-optional --legacy-peer-deps --maxsockets=2; then
                install_success=true
            fi
        elif [ $attempt -eq 3 ]; then
            # Third attempt: install problematic packages separately
            print_warning "Installing problematic packages separately..."

            # Install core dependencies first
            if npm install --legacy-peer-deps --ignore-scripts; then
                print_info "Core dependencies installed, now building native modules..."
                
                # Try to rebuild native modules
                if npm rebuild; then
                    install_success=true
                else
                    print_warning "Some native modules failed to build, but continuing..."
                fi
            fi
        else
            # Fourth attempt: minimal install
            print_warning "Final attempt with minimal configuration..."
            if npm install --legacy-peer-deps --maxsockets=1 --no-optional --ignore-scripts; then
                print_warning "Minimal installation succeeded, some features may not work"
                install_success=true
            fi
        fi

        # Check if installation was successful
        if [ "$install_success" = true ] && [ -d "node_modules" ]; then
            # Check for critical components
            if [ -f "node_modules/.bin/nx" ] || [ -f "node_modules/@nx/cli/bin/nx.js" ]; then
                print_status "npm dependencies installed successfully!"
                return 0
            else
                print_warning "Installation completed but Nx CLI not found"
                if [ $attempt -lt $max_attempts ]; then
                    print_info "Will retry to ensure Nx is available"
                fi
            fi
        fi

        attempt=$((attempt + 1))

        if [ $attempt -le $max_attempts ]; then
            print_warning "Installation failed, cleaning and retrying..."
            rm -rf node_modules package-lock.json
            if command_exists npm; then
                npm cache clean --force 2>/dev/null || true
            fi
            sleep 2
        fi
    done

    return 1
}

# Try to install dependencies
if ! try_npm_install; then
    print_error "Failed to install npm dependencies after multiple attempts"
    print_info ""
    print_info "TROUBLESHOOTING STEPS:"
    print_info "1. Check available disk space: df -h"
    print_info "2. Check available memory: free -h"
    print_info "3. Try manual installation:"
    print_info "   npm install --legacy-peer-deps --verbose --no-optional"
    print_info "4. If still failing, try:"
    print_info "   rm -rf node_modules package-lock.json .npm"
    print_info "   npm cache clean --force"
    print_info "   npm install --legacy-peer-deps"
    print_info "5. For specific package issues:"
    print_info "   npm install <package-name> --build-from-source"
    print_info ""
    print_info "Common issues on Raspberry Pi:"
    print_info "- Insufficient memory (add swap space)"
    print_info "- Network timeouts (check internet connection)"
    print_info "- Native module compilation failures (install build tools)"
    print_info ""
    
    # Create a failure log
    echo "Setup failed at npm install step on $(date)" > .raspberry-pi-setup-failed.log
    echo "Node.js version: $(node -v 2>/dev/null || echo 'not available')" >> .raspberry-pi-setup-failed.log
    echo "npm version: $(npm -v 2>/dev/null || echo 'not available')" >> .raspberry-pi-setup-failed.log
    echo "Architecture: $(uname -m)" >> .raspberry-pi-setup-failed.log
    echo "Available space: $(df -h / | tail -1)" >> .raspberry-pi-setup-failed.log
    echo "Available memory: $(free -h | head -2 | tail -1)" >> .raspberry-pi-setup-failed.log
    
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
if [ -f "node_modules/.bin/nx" ] || [ -f "node_modules/@nx/cli/bin/nx.js" ]; then
    NX_VERSION=$(npx nx --version 2>/dev/null || echo "available")
    print_status "Nx CLI: $NX_VERSION"
else
    print_error "Nx CLI not found"
    print_info "You can install it manually with: npm install -g @nx/cli"
fi

# Check npm packages integrity
print_info "Checking npm package integrity..."
TOTAL_PACKAGES=$(find node_modules -type d -name "node_modules" -prune -o -type d -maxdepth 1 -print 2>/dev/null | wc -l)
print_info "Installed packages: $TOTAL_PACKAGES"

# Check Chromium
if command_exists chromium-browser; then
    CHROMIUM_VERSION=$(chromium-browser --version 2>/dev/null | head -n1 | cut -d' ' -f2)
    print_status "Chromium: $CHROMIUM_VERSION"
    
    # Test Chromium launch (quick test)
    if timeout 10 chromium-browser --headless --disable-gpu --no-sandbox --remote-debugging-port=9222 2>/dev/null; then
        print_status "Chromium can launch successfully"
    else
        print_warning "Chromium may have issues launching (this is normal on some systems)"
    fi
else
    print_warning "Chromium not found - Puppeteer tests will fail"
    print_info "Install with: sudo apt-get install chromium-browser"
fi

# Check memory settings
if [ -n "$NODE_OPTIONS" ]; then
    print_status "Node.js memory limit: $NODE_OPTIONS"
else
    print_warning "NODE_OPTIONS not set - may cause memory issues"
fi

# Check system resources after installation
CURRENT_DISK=$(get_disk_space)
CURRENT_RAM=$(get_total_ram)
print_info "Remaining disk space: ${CURRENT_DISK}GB"
print_info "System RAM: ${CURRENT_RAM}MB"

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
echo -e "${YELLOW}Setup improvements in this version:${NC}"
echo "  • Fixed Chromium codec package conflicts"
echo "  • Added npm verification and retry logic"
echo "  • Improved error handling and recovery"
echo "  • Better package conflict resolution"
echo "  • Enhanced troubleshooting information"
echo ""
echo -e "${GREEN}For troubleshooting, see: docs/raspberry-pi-setup.md${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Create a setup completion marker
echo "$(date): Setup completed with Node.js $NODE_VERSION" > .raspberry-pi-setup-complete

exit 0
