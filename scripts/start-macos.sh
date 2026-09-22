#!/usr/bin/env bash
echo "==================================================="
echo "  ReelOS Luxury Media Appliance - macOS Apple Silicon"
echo "==================================================="
echo "[info] Direct Hardware Scaling: M-Series Native"
echo "[info] Zero-VM Overhead Mode"
echo "[info] Hardware Acceleration: VideoToolbox"
echo "[info] Starting on http://localhost:8080/"
echo ""

cd "$(dirname "$0")/.."
export PORT=8080
export HOST=0.0.0.0
export NODE_ENV=production
export REELOS_HWACCEL="videotoolbox"
node scripts/with-app-env.mjs node scripts/reelos-box.mjs
