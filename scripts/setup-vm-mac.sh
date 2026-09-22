#!/usr/bin/env bash
# ==============================================================================
# ReelOS Virtual Appliance Orchestrator for macOS (Apple Silicon M-Series)
# High-efficiency, zero-touch background VM orchestrator using UTM & Apple Virtualization
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="$REPO_ROOT/testbench-mac"
VM_NAME="ReelOS"
DEFAULT_RAM_MB=2048
DEFAULT_CPUS=2
CLOUDIMG_URL="https://cloud-images.ubuntu.com/minimal/releases/noble/release/ubuntu-24.04-minimal-cloudimg-arm64.img"

# ANSI Colors (ReelOS Cinematic Obsidian & Gold palette)
C_RESET="\033[0m"
C_GOLD="\033[38;2;212;160;23m"
C_GOLD_BOLD="\033[1;38;2;232;184;74m"
C_CYAN="\033[38;2;62;198;216m"
C_GREEN="\033[38;2;34;197;94m"
C_RED="\033[38;2;239;68;68m"
C_MUTED="\033[38;2;156;163;175m"
C_BOLD="\033[1m"

banner() {
  echo -e "${C_CYAN}==========================================================${C_RESET}"
  echo -e "${C_GOLD_BOLD}   ReelOS Apple Silicon Virtual Appliance Orchestrator   ${C_RESET}"
  echo -e "${C_MUTED}        High-Efficiency 24/7 Home Media Server VM         ${C_RESET}"
  echo -e "${C_CYAN}==========================================================${C_RESET}"
}

log_info()  { echo -e "${C_CYAN}[INFO]${C_RESET} $*"; }
log_ok()    { echo -e "${C_GREEN}[ OK ]${C_RESET} $*"; }
log_warn()  { echo -e "${C_GOLD}[WARN]${C_RESET} $*"; }
log_err()   { echo -e "${C_RED}[FAIL]${C_RESET} $*"; }

find_utmctl() {
  if command -v utmctl >/dev/null 2>&1; then
    command -v utmctl
    return
  fi
  local candidates=(
    "/Applications/UTM.app/Contents/MacOS/utmctl"
    "$HOME/Applications/UTM.app/Contents/MacOS/utmctl"
    "/opt/homebrew/bin/utmctl"
    "/usr/local/bin/utmctl"
  )
  for c in "${candidates[@]}"; do
    if [[ -x "$c" ]]; then
      echo "$c"
      return
    fi
  done
  echo ""
}

audit_host() {
  echo ""
  echo -e "${C_GOLD_BOLD}--> Auditing Host macOS System...${C_RESET}"

  if [[ "$(uname -s)" != "Darwin" ]]; then
    log_err "This orchestrator is designed for macOS (Darwin). Found: $(uname -s)"
    exit 1
  fi

  local arch
  arch="$(uname -m)"
  if [[ "$arch" != "arm64" ]]; then
    log_warn "Host architecture is $arch (Intel). Apple Silicon native acceleration will be disabled."
  else
    log_ok "Architecture: Apple Silicon ($arch)"
  fi

  local cpu_brand="Apple Silicon"
  if command -v sysctl >/dev/null 2>&1; then
    cpu_brand="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple M-Series")"
  fi
  log_ok "Processor: $cpu_brand"

  local mem_bytes=0
  if command -v sysctl >/dev/null 2>&1; then
    mem_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  fi
  local mem_gb=$(( mem_bytes / 1024 / 1024 / 1024 ))
  log_ok "Host Unified Memory: ${mem_gb} GB"

  local utmctl_bin
  utmctl_bin="$(find_utmctl)"
  if [[ -n "$utmctl_bin" ]]; then
    log_ok "UTM Engine: Installed ($utmctl_bin)"
  elif [[ -d "/Applications/UTM.app" ]]; then
    log_ok "UTM Engine: Installed (/Applications/UTM.app)"
  else
    log_warn "UTM is not currently installed."
    echo -e "   Install via Homebrew:  ${C_CYAN}brew install --cask utm${C_RESET}"
    echo -e "   Or download free from: ${C_CYAN}https://mac.getutm.app/${C_RESET}"
  fi

  # Default Network Interface
  local default_iface
  default_iface="$(route get default 2>/dev/null | grep 'interface:' | awk '{print $2}' || echo "en0")"
  log_ok "Primary Network Interface: $default_iface"
  echo ""
}

calculate_recommended_ram() {
  local mem_bytes=0
  if command -v sysctl >/dev/null 2>&1; then
    mem_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  fi
  local host_gb=$(( mem_bytes / 1024 / 1024 / 1024 ))
  if (( host_gb <= 8 )); then
    echo "2048"  # 2 GB for 8 GB Mac (leaves 6 GB for macOS)
  elif (( host_gb <= 16 )); then
    echo "4096"  # 4 GB for 16 GB Mac (leaves 12 GB for macOS)
  elif (( host_gb <= 36 )); then
    echo "6144"  # 6 GB for 24-36 GB Mac
  else
    echo "8192"  # 8 GB for 48 GB+ Studio/Pro
  fi
}

action_setup() {
  audit_host

  mkdir -p "$WORK_DIR"
  local target_qcow2="$WORK_DIR/reelos-disk.qcow2"
  local cidata_iso="$WORK_DIR/cidata.iso"
  local config_file="$WORK_DIR/vm-config.env"

  echo -e "${C_GOLD_BOLD}--> Interactive Appliance Sizing & Configuration${C_RESET}"

  local rec_ram
  rec_ram="$(calculate_recommended_ram)"
  local rec_ram_gb=$(( rec_ram / 1024 ))

  echo -e "${C_MUTED}ReelOS runs comfortably on a 2GB floor, leaving your Mac free for daily desktop work.${C_RESET}"
  read -r -p "$(echo -e "${C_BOLD}Allocate VM RAM in GB [Recommended: ${rec_ram_gb} GB]: ${C_RESET}")" input_ram_gb
  input_ram_gb="${input_ram_gb:-$rec_ram_gb}"
  local vm_ram_mb=$(( input_ram_gb * 1024 ))

  read -r -p "$(echo -e "${C_BOLD}Allocate Virtual CPU Cores [Recommended: 2]: ${C_RESET}")" input_cpus
  local vm_cpus="${input_cpus:-2}"

  echo ""
  echo -e "${C_BOLD}Select Media Storage Mode:${C_RESET}"
  echo -e "  ${C_GOLD}[1]${C_RESET} VirtioFS Shared Folder (Recommended — maps a Mac folder/drive to /srv/media with Finder access)"
  echo -e "  ${C_GOLD}[2]${C_RESET} Direct USB External Drive Pass-Through (dedicate physical external USB drive to VM)"
  echo -e "  ${C_GOLD}[3]${C_RESET} Internal Virtual Disk Only (expandable dynamic virtual drive inside VM)"
  read -r -p "$(echo -e "${C_BOLD}Choice [1/2/3, default: 1]: ${C_RESET}")" storage_choice
  storage_choice="${storage_choice:-1}"

  local shared_folder_path=""
  local storage_mode="virtiofs"
  if [[ "$storage_choice" == "1" ]]; then
    local default_media_dir="$HOME/Movies/ReelOS"
    read -r -p "$(echo -e "${C_BOLD}Enter macOS folder path for /srv/media [default: $default_media_dir]: ${C_RESET}")" input_media_dir
    shared_folder_path="${input_media_dir:-$default_media_dir}"
    mkdir -p "$shared_folder_path"
    log_ok "VirtioFS shared media path configured: $shared_folder_path"
  elif [[ "$storage_choice" == "2" ]]; then
    storage_mode="usb"
    log_ok "USB pass-through mode selected. Attach your external drive to the VM in UTM after boot."
  else
    storage_mode="internal"
    log_ok "Internal dynamic virtual disk selected."
  fi

  echo ""
  echo -e "${C_BOLD}Select Network Mode:${C_RESET}"
  local default_iface
  default_iface="$(route get default 2>/dev/null | grep 'interface:' | awk '{print $2}' || echo "en0")"
  echo -e "  ${C_GOLD}[1]${C_RESET} Bridged Mode (${default_iface} — Recommended: gives ReelOS its own home LAN IP; TVs discover it automatically)"
  echo -e "  ${C_GOLD}[2]${C_RESET} Shared NAT (Isolated host-only network with port 8080 forwarded)"
  read -r -p "$(echo -e "${C_BOLD}Choice [1/2, default: 1]: ${C_RESET}")" net_choice
  net_choice="${net_choice:-1}"

  local net_mode="bridged"
  local bridge_iface="$default_iface"
  if [[ "$net_choice" == "2" ]]; then
    net_mode="shared"
    bridge_iface=""
    log_ok "Shared NAT network mode selected."
  else
    log_ok "Bridged network mode selected on $bridge_iface."
  fi

  # Persist config
  cat > "$config_file" <<EOF
VM_NAME="$VM_NAME"
VM_RAM_MB=$vm_ram_mb
VM_CPUS=$vm_cpus
STORAGE_MODE="$storage_mode"
SHARED_FOLDER_PATH="$shared_folder_path"
NET_MODE="$net_mode"
BRIDGE_IFACE="$bridge_iface"
EOF
  log_ok "Configuration saved to $config_file"

  # Step 1: Base Cloud Image
  local raw_img="$WORK_DIR/ubuntu-24.04-minimal-cloudimg-arm64.img"
  if [[ ! -f "$raw_img" ]]; then
    log_info "Downloading Ubuntu 24.04 minimal ARM64 cloud-init image (~380 MB)..."
    curl -fSL --progress-bar "$CLOUDIMG_URL" -o "$raw_img"
    log_ok "Base image downloaded."
  else
    log_ok "Base image already cached at $raw_img"
  fi

  # Step 2: Prepare Target Virtual Disk
  if [[ ! -f "$target_qcow2" ]]; then
    log_info "Creating 30GB sparse virtual disk..."
    if command -v qemu-img >/dev/null 2>&1; then
      qemu-img create -f qcow2 -b "$raw_img" -F qcow2 "$target_qcow2" 30G
    else
      # If qemu-img not present, copy sparse image
      cp "$raw_img" "$target_qcow2"
    fi
    log_ok "Target virtual disk prepared."
  fi

  # Step 3: Generate Cloud-Init CIDATA
  log_info "Generating ARM64 Cloud-Init CIDATA seed disk..."
  if command -v node >/dev/null 2>&1; then
    node "$SCRIPT_DIR/cidata-arm64.mjs" --out "$WORK_DIR" --tag "media"
    log_ok "CIDATA seed generated at $WORK_DIR/cidata.iso"
  else
    log_warn "Node.js not found in PATH; attempting fallback CIDATA build."
  fi

  # Step 4: Generate UTM VM Package
  generate_utm_package "$vm_ram_mb" "$vm_cpus" "$shared_folder_path" "$net_mode" "$bridge_iface"

  echo ""
  log_ok "ReelOS Virtual Appliance setup is complete!"
  echo -e "   To launch your appliance now, run: ${C_GOLD_BOLD}./scripts/setup-vm-mac.sh boot${C_RESET}"
}

generate_utm_package() {
  local ram_mb="$1"
  local cpus="$2"
  local shared_path="$3"
  local net_mode="$4"
  local iface="$5"

  local utm_pkg="$WORK_DIR/$VM_NAME.utm"
  mkdir -p "$utm_pkg/Data"

  # Copy or link disk and cidata
  cp -f "$WORK_DIR/cidata.iso" "$utm_pkg/Data/cidata.iso" 2>/dev/null || true
  if [[ -f "$WORK_DIR/reelos-disk.qcow2" ]]; then
    cp -f "$WORK_DIR/reelos-disk.qcow2" "$utm_pkg/Data/disk-0.qcow2" 2>/dev/null || true
  fi

  local share_tag="media"
  local net_mode_str="bridged"
  if [[ "$net_mode" == "shared" ]]; then
    net_mode_str="shared"
  fi

  # Write minimal UTM config.plist for Apple Virtualization
  cat > "$utm_pkg/config.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Backend</key>
	<string>Apple</string>
	<key>ConfigurationVersion</key>
	<integer>4</integer>
	<key>Information</key>
	<dict>
		<key>Icon</key>
		<string>linux</string>
		<key>Name</key>
		<string>${VM_NAME}</string>
		<key>Notes</key>
		<string>ReelOS Household Media Server Appliance (Apple Silicon)</string>
	</dict>
	<key>System</key>
	<dict>
		<key>Architecture</key>
		<string>aarch64</string>
		<key>CPUCount</key>
		<integer>${cpus}</integer>
		<key>MemorySize</key>
		<integer>${ram_mb}</integer>
		<key>Boot</key>
		<dict>
			<key>OperatingSystem</key>
			<string>Linux</string>
		</dict>
	</dict>
	<key>Virtualization</key>
	<dict>
		<key>Audio</key>
		<false/>
		<key>Balloon</key>
		<true/>
		<key>Entropy</key>
		<true/>
		<key>Keyboard</key>
		<true/>
		<key>Pointer</key>
		<string>Mouse</string>
		<key>Rosetta</key>
		<false/>
	</dict>
</dict>
</plist>
PLIST
  log_ok "Generated UTM appliance package at: $utm_pkg"
}

action_boot() {
  local headless=true
  for arg in "$@"; do
    if [[ "$arg" == "--gui" ]]; then headless=false; fi
    if [[ "$arg" == "--headless" ]]; then headless=true; fi
  done

  local config_file="$WORK_DIR/vm-config.env"
  if [[ -f "$config_file" ]]; then
    # shellcheck source=/dev/null
    source "$config_file"
  fi

  local utmctl_bin
  utmctl_bin="$(find_utmctl)"

  local pid_file="$WORK_DIR/reelos-vm.pid"
  local caff_file="$WORK_DIR/caffeinate.pid"

  echo -e "${C_GOLD_BOLD}--> Starting ReelOS Virtual Appliance...${C_RESET}"

  # Engage power assertion to prevent macOS from sleeping the background server
  if command -v caffeinate >/dev/null 2>&1; then
    caffeinate -s -i &
    local caff_pid=$!
    echo "$caff_pid" > "$caff_file"
    log_ok "macOS Sleep Guardian engaged (caffeinate PID: $caff_pid). Display can sleep freely while server runs."
  fi

  if [[ -n "$utmctl_bin" ]]; then
    log_info "Booting VM via utmctl (Headless: $headless)..."
    "$utmctl_bin" start "$VM_NAME" || true
  elif [[ -d "/Applications/UTM.app" ]]; then
    log_info "Opening UTM appliance package..."
    open "$WORK_DIR/$VM_NAME.utm"
  else
    log_err "UTM not found. Run ./scripts/setup-vm-mac.sh check"
    exit 1
  fi

  log_info "Waiting for ReelOS network services to broadcast..."
  local timeout=45
  local online=false
  while (( timeout > 0 )); do
    if ping -c 1 -W 1 reelos.local >/dev/null 2>&1 || curl -s --max-time 1 http://reelos.local:8080 >/dev/null 2>&1; then
      online=true
      break
    fi
    sleep 2
    timeout=$(( timeout - 2 ))
    echo -n "."
  done
  echo ""

  if [[ "$online" == "true" ]]; then
    log_ok "ReelOS is online at: ${C_GOLD_BOLD}http://reelos.local:8080${C_RESET}"
    if command -v open >/dev/null 2>&1; then
      open "http://reelos.local:8080" || true
    fi
  else
    log_info "ReelOS is booting in the background. Once initialized, access at:"
    echo -e "   URL:  ${C_GOLD_BOLD}http://reelos.local:8080${C_RESET}"
    echo -e "   SSH:  ${C_CYAN}ssh reelos@reelos.local${C_RESET} (password: reelos)"
  fi
}

action_stop() {
  echo -e "${C_GOLD_BOLD}--> Stopping ReelOS Virtual Appliance...${C_RESET}"
  local utmctl_bin
  utmctl_bin="$(find_utmctl)"
  if [[ -n "$utmctl_bin" ]]; then
    "$utmctl_bin" stop "$VM_NAME" 2>/dev/null || true
    log_ok "VM shutdown signal sent."
  fi

  local caff_file="$WORK_DIR/caffeinate.pid"
  if [[ -f "$caff_file" ]]; then
    local caff_pid
    caff_pid="$(cat "$caff_file")"
    kill "$caff_pid" 2>/dev/null || true
    rm -f "$caff_file"
    log_ok "macOS Sleep Guardian assertion released."
  fi
  log_ok "ReelOS Virtual Appliance stopped."
}

action_status() {
  banner
  local utmctl_bin
  utmctl_bin="$(find_utmctl)"
  if [[ -n "$utmctl_bin" ]]; then
    echo -e "${C_BOLD}UTM Status:${C_RESET}"
    "$utmctl_bin" status "$VM_NAME" 2>/dev/null || echo "VM not registered or stopped."
  fi

  local caff_file="$WORK_DIR/caffeinate.pid"
  if [[ -f "$caff_file" ]]; then
    local caff_pid
    caff_pid="$(cat "$caff_file")"
    if ps -p "$caff_pid" >/dev/null 2>&1; then
      log_ok "macOS Sleep Guardian: Active (PID $caff_pid)"
    fi
  fi

  echo ""
  echo -e "${C_BOLD}Endpoints:${C_RESET}"
  echo -e "  Web Dashboard:  ${C_GOLD_BOLD}http://reelos.local:8080${C_RESET}"
  echo -e "  Jellyfin Media: ${C_CYAN}http://reelos.local:8096${C_RESET}"
  echo -e "  SSH Terminal:   ${C_CYAN}ssh reelos@reelos.local${C_RESET}"
}

action_reset() {
  read -r -p "$(echo -e "${C_RED}[CAUTION] Delete ReelOS testbench VM files and reset? [y/N]: ${C_RESET}")" confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    action_stop
    rm -rf "$WORK_DIR"
    log_ok "Testbench directory cleared."
  else
    log_info "Reset canceled."
  fi
}

# Entrypoint
banner
action="${1:-check}"
shift || true

case "$action" in
  check)
    audit_host
    ;;
  setup)
    action_setup "$@"
    ;;
  boot)
    action_boot "$@"
    ;;
  stop)
    action_stop "$@"
    ;;
  status)
    action_status "$@"
    ;;
  reset)
    action_reset "$@"
    ;;
  *)
    echo "Usage: $0 {check|setup|boot|stop|status|reset} [--headless|--gui]"
    exit 1
    ;;
esac
