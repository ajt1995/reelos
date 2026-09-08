#!/bin/bash
# House notes: dump folders are not a series library.
# After Apply, Jellyfin should be:
#   Movies → /symlinks/radarr
#   Shows  → /symlinks/sonarr
# Do not point Shows at /symlinks (the parent). Decypharr dump names are not seasons.
set -euo pipefail
mkdir -p /mnt/symlinks/radarr /mnt/symlinks/sonarr
echo "=== /mnt/symlinks ==="
ls -la /mnt/symlinks 2>&1 | head -20
echo "=== sonarr dumps (not a library) ==="
ls -la /mnt/symlinks/sonarr 2>&1 | head -25
echo "=== radarr ==="
ls -la /mnt/symlinks/radarr 2>&1 | head -25
echo
echo "If Jellyfin Shows still lists dump folders, remove the parent /symlinks path from that library."
