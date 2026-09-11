#!/bin/bash
# ReelOS OTA. Stage in .next while :8080 keeps serving. mv, then probe, then stamp VERSION.
# Rollback is rename .prev. Never apt Chromium or Tailscale.
set -euo pipefail
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
WORK=/tmp/reelos-ota
LOG="$STATE/ota.log"
mkdir -p "$STATE" "$WORK"
log() { printf '%s\n' "$*" >>"$LOG"; printf '%s\n' "$*" >&2; }
STEPS=8
STEP=0
step() {
  STEP=$((STEP + 1))
  local label=$1 w=28 f i bar=""
  f=$((STEP * w / STEPS))
  i=0
  while [ "$i" -lt "$w" ]; do
    i=$((i + 1))
    if [ "$i" -le "$f" ]; then bar="${bar}#"; else bar="${bar}-"; fi
  done
  log "[${bar}] ${label}  ${STEP}/${STEPS}"
}

# node_modules is identical here (package.json/lock unchanged), so hardlink it
# into staging instead of deep-copying ~300MB. Near-instant, ~no IO/RAM — the old
# `cp -a` "sat minutes" and starved a low-power box mid-Apply. Safe: after the
# swap the old tree moves to .prev and a later `rm -rf .prev` drops one hardlink;
# the inodes stay alive under the live tree. Falls back to a heartbeat deep copy
# when hardlinks are not possible (cross-device).
copy_node_modules_with_heartbeat() {
  local src=$1 dest=$2 hb sec bytes
  if cp -al "$src" "$dest" 2>/dev/null; then
    log "hardlinked node_modules into staging (no copy)"
    return 0
  fi
  (
    sec=0
    while sleep 15; do
      sec=$((sec + 15))
      bytes=$(du -sb "$dest" 2>/dev/null | awk '{print $1}')
      if [ -n "$bytes" ]; then
        log "still copying node_modules (${sec}s, staging ${bytes} bytes)"
      else
        log "still copying node_modules (${sec}s)"
      fi
    done
  ) &
  hb=$!
  if ! cp -a "$src" "$dest"; then
    kill "$hb" 2>/dev/null || true
    wait "$hb" 2>/dev/null || true
    return 1
  fi
  kill "$hb" 2>/dev/null || true
  wait "$hb" 2>/dev/null || true
}
bug_snap() {
  local why=${1:-unknown} f
  mkdir -p "$STATE/bugs"
  f="$STATE/bugs/$(date +%Y%m%dT%H%M%S)-$(echo "$why" | tr -c 'a-zA-Z0-9' '_' | cut -c1-40).txt"
  {
    echo "ReelOS bug"
    echo "why $why"
    echo "time $(date -Is)"
    echo "VERSION $(cat "$ROOT/VERSION" 2>/dev/null || echo none)"
    echo "--- :8080 ---"
    curl -s -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1:8080/ 2>/dev/null || echo down
    echo "--- :80 ---"
    curl -s -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1/ 2>/dev/null || echo down
    echo "--- jellyfin ---"
    curl -s -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1:8096/System/Info/Public 2>/dev/null || echo down
    echo "--- fuse ---"
    ls /mnt/debrid/__all__ 2>&1 | head -8
    echo "--- docker ---"
    docker ps --format '{{.Names}} {{.Status}}' 2>&1 | head -12
    echo "--- ota tail ---"
    tail -30 "$LOG" 2>/dev/null || true
  } >"$f" 2>&1
  log "bug filed $f"
  if [ -x "$ROOT/bin/reelos-bug.sh" ]; then
    "$ROOT/bin/reelos-bug.sh" "$why" >/dev/null 2>&1 || true
  fi
}
trap 'log "ERR line $LINENO exit $?"; bug_snap "ERR-$LINENO"' ERR

# curl, not Python urllib. House Python 3.14 hangs under systemd; Node/curl do not.
fetch_channel() {
  mkdir -p "$WORK"
  # GitHub API first — raw.githubusercontent.com caches stale channel.json
  if curl -fsSL --ipv4 --max-time 20 -A "ReelOS-update" \
      -H "Accept: application/vnd.github.raw" \
      -o "$WORK/channel.json" \
      "https://api.github.com/repos/ajt1995/reelos/contents/channel.json?ref=main" \
    && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("version") else 1)' "$WORK/channel.json"
  then
    log "channel $(python3 -c 'import json; print(json.load(open("/tmp/reelos-ota/channel.json"))["version"])')"
    return 0
  fi
  local u
  for u in \
    "https://github.com/ajt1995/reelos/raw/refs/heads/main/channel.json" \
    "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json?$(date +%s)"
  do
    log "channel GET $u"
    if curl -fsSL --ipv4 --max-time 20 -A "ReelOS-update" -o "$WORK/channel.json" "$u" \
      && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("version") else 1)' "$WORK/channel.json"
    then
      log "channel $(python3 -c 'import json; print(json.load(open("/tmp/reelos-ota/channel.json"))["version"])')"
      return 0
    fi
    log "channel miss $u"
  done
  return 1
}

LOCAL=$(cat "$ROOT/VERSION" 2>/dev/null || echo "0")
MODE="${1:-check}"
echo "---- $(date -Is) $MODE local=$LOCAL ----" >>"$LOG"

fetch_channel || { log "channel unreachable"; [ "$MODE" = "check" ] && echo '{"local":"'"$LOCAL"'","remote":"'"$LOCAL"'","available":false}'; exit 1; }
REMOTE=$(python3 -c 'import json; print(json.load(open("/tmp/reelos-ota/channel.json"))["version"])')
TARBALL=$(python3 -c 'import json; print(json.load(open("/tmp/reelos-ota/channel.json")).get("tarball") or "")')
NOTES=$(python3 -c 'import json; print("\n".join(json.load(open("/tmp/reelos-ota/channel.json")).get("notes") or []))')
if [ -z "$TARBALL" ]; then
  TARBALL="https://github.com/ajt1995/reelos/archive/refs/tags/v${REMOTE}.tar.gz"
fi

newer() {
  python3 -c 'import sys
a=[int(x) for x in sys.argv[1].split(".") if x.isdigit()]
b=[int(x) for x in sys.argv[2].split(".") if x.isdigit()]
n=max(len(a),len(b)); a+=[0]*(n-len(a)); b+=[0]*(n-len(b))
sys.exit(0 if a>b else 1)' "$1" "$2"
}

github_sha() {
  curl -fsSL --ipv4 --max-time 15 -A "ReelOS-update" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/ajt1995/reelos/commits/main \
    | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("sha") or "")
except Exception:
    print("")' || true
}

HEAD_SHA=$(github_sha)
APPLIED_SHA=$(cat "$STATE/applied-sha" 2>/dev/null || true)

if [ "$MODE" = "check" ]; then
  python3 -c 'import json,sys
loc, rem, head, applied = sys.argv[1:5]
def key(v):
    return [int(x) for x in v.split(".") if x.isdigit()]
same_tree = bool(head) and head == applied
print(json.dumps({
  "local": loc,
  "remote": rem,
  "available": key(rem) > key(loc) or (bool(head) and not same_tree),
  "sha": head[:12],
}))' "$LOCAL" "$REMOTE" "$HEAD_SHA" "$APPLIED_SHA"
  exit 0
fi

if [ "$MODE" = "apply" ]; then
  mkdir -p "$STATE"
  exec 9>"$STATE/ota.lock"
  # flock is released when the holder exits. Deleting ota.lock while another
  # Apply still holds the old inode lets a second Apply lock a new file
  # (house dual Apply: every ota.log line twice).
  if ! flock -n 9; then
    log "apply already running — refusing second Apply"
    echo "apply already running"
    exit 0
  fi
  # Wizard wrote provisioned but never stack-installed. firstboot's
  # ConditionPathExists=!stack-installed + Restart=on-failure looped
  # install.sh (HERE==ROOT cp same-file). Latch so a re-enabled unit is a no-op.
  # Never systemctl-enable the firstboot unit on Apply — ISO owns that unit.
  if [ -f "$STATE/provisioned" ]; then
    echo 1 >"$STATE/stack-installed"
    log "stack-installed latched (provisioned box — firstboot stays a no-op)"
  fi
fi

if ! newer "$REMOTE" "$LOCAL"; then
  if [ -n "$HEAD_SHA" ] && [ "$HEAD_SHA" != "$APPLIED_SHA" ]; then
    log "same $LOCAL, new main ${HEAD_SHA:0:12}"
  else
    log "already $LOCAL (channel $REMOTE)"
    echo "already $LOCAL"
    exit 0
  fi
fi

log "ReelOS $LOCAL → $REMOTE"

# Phone Apply is a child of reelos.service. systemctl stop reelos kills that
# cgroup. SSH is not in that cgroup — do not systemd-run from a pipe ($0 is bash).
in_reelos_unit() {
  grep -q 'reelos.service' /proc/self/cgroup 2>/dev/null
}
if [ "${REELOS_OTA_UNIT:-}" != "1" ] && in_reelos_unit && command -v systemctl >/dev/null 2>&1; then
  log "detach updater into reelos-ota.service (survives stop reelos)"
  mkdir -p /var/lib/reelos /etc/systemd/system
  src="${BASH_SOURCE[0]:-}"
  if [ ! -f "$src" ] || [ "$src" = "bash" ]; then
    src=/var/lib/reelos/update-apply.sh
  fi
  cp -a "$src" /var/lib/reelos/update-apply.sh 2>/dev/null || true
  chmod 755 /var/lib/reelos/update-apply.sh
  cat >/etc/systemd/system/reelos-ota.service <<'EOF'
[Unit]
Description=ReelOS OTA
After=network-online.target
[Service]
Type=oneshot
TimeoutStartSec=infinity
KillMode=mixed
Environment=REELOS_OTA_UNIT=1
Environment=REELOS_ROOT=/opt/reelos
Environment=PYTHONUNBUFFERED=1
StandardOutput=append:/var/lib/reelos/ota.log
StandardError=append:/var/lib/reelos/ota.log
ExecStart=/bin/bash /var/lib/reelos/update-apply.sh apply
EOF
  systemctl daemon-reload || true
  systemctl reset-failed reelos-ota 2>/dev/null || true
  systemctl start --no-block reelos-ota
  exit 0
fi

if [ "${REELOS_OTA_REEXEC:-}" = "1" ] && [ -f "$WORK/src/VERSION" ]; then
  log "tarball already extracted — skip second download"
  step "Download"
else
  log "downloading $TARBALL"
  step "Download"
  curl --progress-bar -fL --ipv4 --retry 3 --max-time 180 -A "ReelOS-update" "$TARBALL" -o "$WORK/src.tar.gz"
  log "tarball $(wc -c < "$WORK/src.tar.gz") bytes"
  rm -rf "$WORK/src"
  mkdir -p "$WORK/src"
  tar -xzf "$WORK/src.tar.gz" -C "$WORK/src" --strip-components=1
fi
GOT=$(cat "$WORK/src/VERSION" 2>/dev/null || true)
# Re-exec mailman before version compare. Stale channel.json must not block a newer tarball.
NEW_UP="$WORK/src/daemon/reelos-update.sh"
if [ -f "$NEW_UP" ] && [ "${REELOS_OTA_REEXEC:-}" != "1" ]; then
  if ! cmp -s "$NEW_UP" "$0" 2>/dev/null; then
    log "re-exec updater from tarball (mailman first)"
    chmod 755 "$NEW_UP"
    export REELOS_OTA_REEXEC=1
    exec bash "$NEW_UP" apply
  fi
fi
if [ -z "$GOT" ]; then
  log "tarball has no VERSION"
  exit 1
fi
if [ "$GOT" != "$REMOTE" ]; then
  if newer "$GOT" "$REMOTE"; then
    log "channel $REMOTE stale, tarball $GOT — using tarball"
    REMOTE="$GOT"
  else
    log "tarball VERSION '$GOT' != channel $REMOTE"
    exit 1
  fi
fi

if [ -f "$WORK/src/daemon/reelos-lid.sh" ]; then
  log "lid: ignore close"
  bash "$WORK/src/daemon/reelos-lid.sh" || log "lid non-fatal"
fi

need() {
  local f="$1" pat="$2"
  if [ ! -f "$WORK/src/$f" ]; then
    log "canary missing $f"
    exit 1
  fi
  if grep -q "$pat" "$WORK/src/$f"; then
    return 0
  fi
  local parts="$WORK/src/$(dirname "$f")/wire-engines.parts"
  if [ -d "$parts" ] && grep -q "$pat" "$parts"/*.part 2>/dev/null; then
    return 0
  fi
  log "canary warn $f ~ $pat (copy drift, not fatal)"
}
need src/routes/__root.tsx 'setHydrated();'
need src/components/home-view.tsx '/api/lookup'
need scripts/reelos-lookup-plugin.mjs '/api/jf/Items/'
need scripts/reelos-lookup-plugin.mjs 'handleJellyfinImage'
need scripts/reelos-library.mjs '/api/jf/Items/'
need src/components/title-view-live.tsx '/api/request'
need src/components/connect-view.tsx 'Watch on the TV'
need src/components/connect-view.tsx 'Get Tailscale login'
need src/components/advanced-view.tsx TerminalRow
need src/components/settings-terminal.tsx 'title="Terminal"'
need src/components/library-view.tsx hydrateShelf
need install/compose/docker-compose.yml '0.0.0.0:8096'
need install/compose/docker-compose.yml rshared
need daemon/reelos-lid.sh HandleLidSwitch
need daemon/wire-engines.py Startup/Configuration
need scripts/reelos-lookup-plugin.mjs 'serveLibrary'
need daemon/reelos-update.sh 'overlay house compose/configs onto staging'
need daemon/reelos-update.sh "decypharr/cache/"
need daemon/reelos-update.sh 'not 200 after 15s'
need scripts/reelos-lookup-plugin.mjs '/api/ready'
need src/components/splash.tsx 'Local state'
need scripts/reelos-lookup-plugin.mjs '/api/request'
need scripts/reelos-lookup-plugin.mjs 'scheduleBoxProbe'
need scripts/reelos-request-progress-plugin.mjs 'const recoverNote = maybeRecover'
need scripts/reelos-lookup-plugin.mjs 'update-apply.sh'
need scripts/reelos-lookup-plugin.mjs '/api/activity'
need scripts/reelos-lookup-plugin.mjs '/api/doctor'
need scripts/reelos-lookup-plugin.mjs '/api/repair'
need scripts/reelos-repair.mjs 'Unknown repair'
need src/components/settings-fix.tsx '/api/repair'
need src/components/settings-fix.tsx 'Never writes to /media'
need src/components/settings-fix.tsx 'Not checked yet'
need src/components/settings-fix.tsx 'Finished. Check Movies'
need src/components/settings-view.tsx 'FixSection'
need src/components/settings-updates.tsx 'This install'
need src/components/settings-updates.tsx 'This update'
need scripts/reelos-lookup-plugin.mjs 'pendingNotes'
need scripts/update-notes.mjs 'ownerEnglish'
need scripts/reelos-library-remove.mjs 'deleteFilesAllowed'
need src/components/remove-from-box.tsx 'Remove from this box'
need src/lib/repairs.ts 'One poster per movie'
need scripts/reelos-lookup-plugin.mjs '/api/intent'
need scripts/reelos-lookup-plugin.mjs 'applyIsRunning'
need scripts/reelos-ota-status.mjs 'lockIsHeld'
need src/components/applying-bar.tsx 'engines are still configuring'
need src/routes/__root.tsx 'syncUpdateFromBox'
need src/components/player-view.tsx ':8096'
need scripts/reelos-lookup-plugin.mjs '/api/terminal'
need scripts/reelos-lookup-plugin.mjs '/api/library'
need scripts/reelos-lookup-plugin.mjs 'episodeFileCount'
need scripts/reelos-lookup-plugin.mjs '=== sonarr series ==='
need install/compose/docker-compose.yml '/mnt/symlinks:/symlinks'
need install/compose/docker-compose.yml 'Do not set dns: 1.1.1.1'
need src/components/shell.tsx 'to: "/settings"'
need daemon/wire-engines.py 'restart_fuse_readers'
need daemon/wire-engines.py 'not bind-mounting /mnt'
need install/compose/docker-compose.yml '/mnt/debrid:/mnt/debrid:rshared'
need install/compose/docker-compose.yml '/mnt/debrid:/mnt/debrid:rslave'
need daemon/reelos-update.sh 'daemon-reload (8080 still up)'
need daemon/reelos-update.sh 'skip second download'
need daemon/reelos-update.sh 'home up — not stamping'
need daemon/reelos-update.sh 'ListenAddress 0.0.0.0'
need daemon/reelos-update.sh 'apply already running'
need daemon/reelos-update.sh 'ROOT.prev/docker-compose.yml'
need daemon/reelos-update.sh 'compose recreated — remount FUSE before hops'
need daemon/reelos-update.sh 'HostConfig.Dns=1.1.1.1 — recreate'
need daemon/reelos-update.sh 'waiting for :8080'
need daemon/reelos-update.sh 'hop FUSE green'
need daemon/reelos-update.sh 'hop Jellyfin green'
need daemon/wire-engines.py 'sonarr_manual_import'
need daemon/relink_dumps.py 'relink created'
need daemon/wire-engines.py 'relink_dumps'
need daemon/stuck-downloads.py 'recover_missing_movies'
need daemon/stuck-downloads.py 'MoviesSearch'
need scripts/reelos-lookup-plugin.mjs 'kickArrRecover'
need daemon/wire-engines.parts/09.part 'seerr_needs_search_enable'
need daemon/public_indexers.py 'ReelOS-eztv'
need daemon/public_indexers.py 'ReelOS-showrss'
need daemon/public_indexers.py 'TorrentRssIndexer'
need daemon/public_indexers.py 'doctor_releases_detail'
need daemon/public_indexers.py 'apply_public_indexers'
need daemon/wire-engines.parts/04.part 'OTA: public indexer add pass complete'
need daemon/wire-engines.parts/04.part 'rss fallback'
need daemon/wire-engines.parts/04.part 'apply_public_indexers'
need daemon/wire-engines.parts/04.part 'schema {e} — RSS fallback'
need daemon/wire-engines.parts/02.part 'fullSync'
need daemon/wire-engines.parts/09.part 'widen_sonarr_hybrid'
need daemon/wire-engines.parts/09.part 'research-missing'
need daemon/wire-engines.parts/07.part 'extra_jellyfin_paths'
need daemon/wire-engines.parts/07.part 'jellyfin_keep_paths'
need daemon/wire-engines.parts/07.part 'extra_jellyfin_libraries'
need daemon/wire-engines.parts/07.part 'strip_season_folder_suffix'
need daemon/wire-engines.parts/07.part 'plan_extra_library_drop'
need daemon/wire-engines.parts/08.part 'remove_jellyfin_path'
need daemon/wire-engines.parts/08.part 'delete_jellyfin_library'
need daemon/wire-engines.parts/08.part 'collapse_season_named_dumps'
need daemon/wire-engines.parts/08.part 'collapse_movie_named_dumps'
need daemon/wire-engines.parts/08.part 'heal_movie_dump_items'
need daemon/wire-engines.parts/08.part 'heal_merge_movie_versions'
need daemon/wire-engines.parts/08.part 'heal_merge_movie_posters'
need daemon/wire-engines.parts/08.part 'label_jellyfin_movie_versions'
need daemon/wire-engines.parts/08.part 'park_extra_movie_files'
need daemon/wire-engines.parts/08.part 'restore_hybrid_movie_versions'
need daemon/wire-engines.parts/09.part 'ensure_hybrid_recycle_bin'
need daemon/stuck-downloads.py 'search_hybrid_cutoff_movies'
need daemon/stuck-downloads.py 'grab_hybrid_1080_companions'
need daemon/stuck-downloads.py '.reel-recycle'
need daemon/wire-engines.parts/08.part 'heal_hybrid_1080_companions'
need daemon/wire-engines.parts/09.part 'merge-movies'
need daemon/wire-engines.parts/00.part 'except OSError'
need daemon/lock-download-clients.py 'merge-movies'
need daemon/wire-engines.parts/08.part 'jellyfin keep extra library'
need scripts/reelos-library.mjs 'dedupeLibraryTitles'
need scripts/reelos-library.mjs 'titleYear'
need scripts/reelos-library.mjs 'stripSeasonFolderSuffix'
need scripts/reelos-library.mjs 'yearsCompatible'
need daemon/wire-engines.parts/08.part 'heal_season_folder_items'
need daemon/wire-engines.parts/07.part 'plan_season_folder_item'
need daemon/wire-engines.parts/07.part 'plan_movie_dump_item'
need daemon/wire-engines.parts/07.part 'movie_dump_item_path'
need daemon/wire-engines.parts/07.part 'movie_dump_keys'
need daemon/wire-engines.parts/07.part 'season_folder_item_path'
need scripts/reelos-seerr.mjs 'Searching — no file yet'
need scripts/reelos-request-status.mjs 'listUnmonitoredMovieRecoverTargets'
need daemon/wire-engines.parts/09.part 'jellyfin libraries one dump path each'
need daemon/wire-engines.parts/09.part 'widen_radarr_hybrid'
need daemon/reelos-doctor.py 'doctor_releases_detail'
need daemon/lock-download-clients.py '--quick'
need daemon/lock-download-clients.py 'wanted_apps'
need install/systemd/reelos-lock-clients.service 'TimeoutStartSec=180'
need scripts/reelos-request-status.mjs 'ensureTvGrabPath'
need scripts/reelos-request-status.mjs 'ensureMovieGrabPath'
need scripts/reelos-request-status.mjs 'addRadarrMovie'
need scripts/reelos-request-status.mjs 'seerrRecoverScope'
need daemon/wire-engines.parts/08.part 'heal_after_import'
need daemon/wire-engines.parts/08.part 'jellyfin heal red — no token'
need daemon/wire-engines.parts/09.part 'collapse_dumps=False'
need daemon/wire-engines.parts/01.part 'return heal_after_import()'
need daemon/reelos-update.sh 'not printing applied — jellyfin/indexer heal red'
need daemon/reelos-update.sh 'door restored — still not stamping'
need daemon/reelos-update.sh 'restart hung reelos'
need daemon/reelos-doctor.py 'doctor_jellyfin_library_detail'
need daemon/reelos-doctor.py 'request_hop_detail'
need daemon/reelos-doctor.py 'movie/lookup'
need daemon/reelos-doctor.py 'jellyfin.token'
need daemon/public_indexers.py 'doctor_sonarr_indexers_detail'
need daemon/public_indexers.py 'apply_arr_search_indexers'
need daemon/public_indexers.py 'doctor_radarr_indexers_detail'
need daemon/public_indexers.py 'arr_indexer_write_url'
need daemon/public_indexers.py 'forceSave=true'
need daemon/public_indexers.py 'torznab_body_from_schema'
need daemon/public_indexers.py 'legacy_arr_post_treats_400_as_attached'
need daemon/public_indexers.py 'arr_indexer_write_landed'
need daemon/public_indexers.py 'indexer_is_enabled'
need daemon/wire-engines.parts/02.part 'forceSync'
need daemon/wire-engines.parts/02.part 'RADARR_SYNC_CATEGORIES'
need daemon/wire-engines.parts/02.part 'docker_service_ip'
need daemon/wire-engines.parts/02.part 'Inspect by container name'
need daemon/wire-engines.parts/03.part 'stripped compose dns'
need daemon/public_indexers.py 'strip_compose_dns_text'
need daemon/wire-engines.parts/09.part 'research-missing skipped'
need daemon/reelos-update.sh 'heal red|torznab |search indexers'
need daemon/wire-engines.parts/09.part 'ensure_arr_search_indexers'
need daemon/wire-engines.parts/09.part 'def read_prow_rows'
need daemon/wire-engines.parts/09.part '400 + name is not attached'
need daemon/wire-engines.parts/09.part 'arr_indexer_write_landed'
need daemon/public_indexers.py 'prowlarr_movie_cats_present'
need scripts/reelos-request-status.mjs 'lookup/tmdb'
need scripts/reelos-request-status.mjs 'radarrLookupUrls'
need scripts/reelos-request-status.mjs 'unmatched hit is no hit'
need daemon/reelos-doctor.py 'jellyfin_auth_headers'
need daemon/reelos-doctor.py 'Token='
need daemon/wire-engines.parts/06.part 'jellyfin_headers'
need daemon/stuck-downloads.py 'ensure_item_grab_path'
need scripts/reelos-request-status.mjs 'recoverKickOk'
need scripts/reelos-seerr.mjs 'pipelineMovieGaps'
need scripts/reelos-seerr.mjs 'Seerr says available — no file on disk'
need daemon/lock-download-clients.py 'client_enabled'
need daemon/reelos-doctor.py 'Could not probe Radarr/Sonarr download clients'
need daemon/reelos-doctor.py 'Sonarr has no Decypharr client'
need daemon/reelos-doctor.py 'MoviesSearch cannot grab'
need daemon/reelos-update.sh 'wire-engines.py" indexers'
need daemon/reelos-update.sh 'bug filed'
need install/systemd/reelos-ensure.service WantedBy
need install/systemd/reelos-selfheal.timer WantedBy
need daemon/reelos-selfheal.sh 'not walking FUSE'
need daemon/reelos-selfheal.sh 'not enabling firstboot'
need daemon/reelos-selfheal.sh 'ffprobe D-state'
need daemon/reelos-update.sh 'vite build for production door'
need daemon/reelos-update.sh 'vite build skipped — 4GB box'
need daemon/reelos-update.sh 'package-lock.json unchanged — reused node_modules'
need scripts/reelos-box.mjs 'production preview'
need scripts/reelos-box.mjs 'serving built UI'
need scripts/reelos-lookup-plugin.mjs 'This box is behind the latest code even though the version number matches.'
need daemon/reelos-update.sh 'not printing applied'
need daemon/reelos-update.sh 'package.json or package-lock.json changed'
need daemon/reelos-update.sh 'staging missing package.json'
need daemon/reelos-update.sh 'hop search red — not blocking UI-only stamp'
need daemon/reelos-update.sh 'npm ci failed — not swapping'
need scripts/reelos-lookup-plugin.mjs 'Update already running'
need scripts/check-ota.py 'VERSION skew'
if grep -q '172.66.170.114' "$WORK/src/install/compose/docker-compose.yml"; then
  log "canary fail pinned extra_hosts"
  exit 1
fi
log "canaries ok"
step "Verify"
if [ -f "$WORK/src/scripts/check-ota.py" ]; then
  python3 "$WORK/src/scripts/check-ota.py" "$WORK/src" --apply || { log "check-ota fail"; exit 1; }
fi

NEXT="$ROOT.next"
rm -rf "$NEXT"
mkdir -p "$NEXT/app" "$NEXT/bin" "$NEXT/systemd" "$NEXT/compose"
cp -a "$WORK/src/install/." "$NEXT/" 2>/dev/null || true
if [ -d "$WORK/src/src" ]; then
  rm -rf "$NEXT/app"
  mkdir -p "$NEXT/app"
  if [ ! -f "$WORK/src/package.json" ] || [ ! -f "$WORK/src/package-lock.json" ]; then
    log "staging missing package.json or lockfile in tarball"
    exit 1
  fi
  cp -a "$WORK/src/package.json" "$WORK/src/package-lock.json" "$NEXT/app/"
  cp -a "$WORK/src/tsconfig.json" "$WORK/src/vite.config.ts" "$NEXT/app/" 2>/dev/null || true
  cp -a "$WORK/src/src" "$NEXT/app/src"
  [ -d "$WORK/src/server" ] && cp -a "$WORK/src/server" "$NEXT/app/server"
  [ -d "$WORK/src/scripts" ] && cp -a "$WORK/src/scripts" "$NEXT/app/scripts"
  mkdir -p "$NEXT/app/public"
  if [ -d "$WORK/src/public" ]; then
    cp -a "$WORK/src/public/." "$NEXT/app/public/" || true
    rm -rf "$NEXT/app/public/install" || true
  fi
  [ -f "$WORK/src/channel.json" ] && cp -a "$WORK/src/channel.json" "$NEXT/app/"
  [ -f "$WORK/src/channel-beta.json" ] && cp -a "$WORK/src/channel-beta.json" "$NEXT/app/"
  echo 1 >"$NEXT/app/.reelos-appliance"
fi
if [ -d "$WORK/src/daemon" ]; then
  mkdir -p "$NEXT/bin"
  cp -a "$WORK/src/daemon/." "$NEXT/bin/"
fi
chmod 755 "$NEXT/bin/"* 2>/dev/null || true
# Overlay house compose/configs onto staging. Never walk FUSE dumps
# (decypharr/cache/dfs) — cp -a of those starved the 4GB box and killed Vite.
overlay_house_configs() {
  mkdir -p "$NEXT/compose/configs"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude 'decypharr/cache/' --exclude '**/cache/dfs/' --exclude 'jellyfin/**/cache/' --exclude 'jellyfin/**/transcodes/' --exclude '**/MediaCover/' --exclude '**/logs/' --exclude '*.db-wal' --exclude '*.db-shm' \
      "$ROOT/compose/configs/" "$NEXT/compose/configs/" \
      || log "config copy skipped vanished sqlite sidecars"
    return 0
  fi
  log "rsync missing — copy top-level config dirs without cache/dfs"
  local src dest name child
  for src in "$ROOT/compose/configs"/*; do
    [ -e "$src" ] || continue
    name=$(basename "$src")
    dest="$NEXT/compose/configs/$name"
    if [ -d "$src" ]; then
      mkdir -p "$dest"
      for child in "$src"/*; do
        [ -e "$child" ] || continue
        case "$(basename "$child")" in
          cache|dfs|logs|MediaCover|transcodes) continue ;;
        esac
        cp -a "$child" "$dest/" || log "config copy skipped vanished sqlite sidecars"
      done
    else
      cp -a "$src" "$dest" || log "config copy skipped vanished sqlite sidecars"
    fi
  done
}

if [ -d "$ROOT/compose/configs" ]; then
  mkdir -p "$NEXT/compose/configs"
  # Overlay: copy *contents* so they stay at $NEXT/compose/configs, not nested.
  # #49 seeds install/compose/configs/jellyfin/config/network.xml; without
  # overlay, mailman `cp -a install/. $NEXT` then this copy would nest the
  # house tree and Jellyfin would lose Network.xml after swap.
  overlay_house_configs
  log "overlay house compose/configs onto staging"
  [ -f "$ROOT/compose/.env" ] && cp -a "$ROOT/compose/.env" "$NEXT/compose/.env"
fi
if [ -f "$WORK/src/install/compose/docker-compose.yml" ]; then
  mkdir -p "$NEXT/compose"
  cp "$WORK/src/install/compose/docker-compose.yml" "$NEXT/compose/docker-compose.yml"
fi
if [ -f "$WORK/src/install/compose/Caddyfile" ]; then
  cp "$WORK/src/install/compose/Caddyfile" "$NEXT/compose/Caddyfile"
fi

if [ ! -f "$NEXT/app/package.json" ] || [ ! -f "$NEXT/app/package-lock.json" ]; then
  log "staging missing package.json — not swapping"
  rm -rf "$NEXT"
  exit 1
fi

SKIP_NPM=0
# House 31→34: start:box script is the only package.json byte change; lockfile
# matches. npm ci on 4GB next to live Vite + Sonarr ffprobe D-state is the 28
# "home never returned" pattern. Reuse node_modules when the lockfile matches.
if [ -f "$ROOT/app/package-lock.json" ] && [ -f "$NEXT/app/package-lock.json" ] \
  && cmp -s "$ROOT/app/package-lock.json" "$NEXT/app/package-lock.json" \
  && [ -d "$ROOT/app/node_modules" ]; then
  SKIP_NPM=1
  log "copying node_modules into staging (8080 still up)"
step "Stage"
  copy_node_modules_with_heartbeat "$ROOT/app/node_modules" "$NEXT/app/node_modules"
  if [ -f "$ROOT/app/package.json" ] && [ -f "$NEXT/app/package.json" ] \
    && cmp -s "$ROOT/app/package.json" "$NEXT/app/package.json"; then
    log "package.json unchanged — reused node_modules"
  else
    log "package-lock.json unchanged — reused node_modules (package.json scripts-only ok)"
  fi
fi
if [ "$SKIP_NPM" = 0 ] && [ -f "$NEXT/app/package.json" ]; then
  log "package.json or package-lock.json changed — running npm ci"
  export DEBIAN_FRONTEND=noninteractive
  command -v npm >/dev/null 2>&1 || apt-get install -y nodejs npm || true
  if [ -f "$NEXT/app/package-lock.json" ]; then
    (cd "$NEXT/app" && npm ci --no-audit --no-fund) || {
      log "npm ci failed — not swapping"
      rm -rf "$NEXT"
      exit 1
    }
  else
    (cd "$NEXT/app" && npm install --no-audit --no-fund) || {
      log "npm failed — not swapping"
      rm -rf "$NEXT"
      exit 1
    }
  fi
fi

if [ -f "$NEXT/app/package.json" ] && [ -d "$NEXT/app/node_modules" ]; then
  mem_kb=$(awk '/MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  avail_kb=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  # House is 3.2Gi. Staging vite build next to live :8080 is an OOM even when
  # fail-soft — 28 starved Home. Skip on 4GB / low MemAvailable; start:box
  # already falls back to vite --host :8080.
  if [ "${mem_kb:-0}" -gt 0 ] && [ "$mem_kb" -le 4608000 ]; then
    log "vite build skipped — 4GB box (start:box falls back to vite --host :8080)"
  elif [ "${avail_kb:-0}" -gt 0 ] && [ "$avail_kb" -lt 1843200 ]; then
    log "vite build skipped — 4GB box (start:box falls back to vite --host :8080)"
  else
    log "vite build for production door (8080 still on previous tree)"
    if (cd "$NEXT/app" && PATH="$PWD/node_modules/.bin:$PATH" NODE_ENV=production timeout 180 node scripts/with-app-env.mjs vite build); then
      log "production client built"
    else
      log "vite build skipped — start:box falls back to vite --host :8080"
    fi
  fi
fi

if [ -d "$ROOT.prev" ]; then
  log "dropping old backup (8080 still up)"
  rm -rf "$ROOT.prev"
fi
mkdir -p "$ROOT.prev"
cp -a "$ROOT/VERSION" "$ROOT.prev/VERSION" 2>/dev/null || true
[ -f "$ROOT/compose/docker-compose.yml" ] && cp -a "$ROOT/compose/docker-compose.yml" "$ROOT.prev/docker-compose.yml" || true

caddy_updating() {
  mkdir -p /etc/caddy
  if [ -f /etc/caddy/Caddyfile ]; then
    cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.reelos.bak
  fi
  cat >/etc/caddy/Caddyfile <<'EOF'
{
	auto_https off
	admin off
}
:80 {
	header Content-Type "text/html; charset=utf-8"
	respond "ReelOS is updating. The shell comes back first; engines may still be configuring." 200
}
EOF
  caddy_dropin
  if caddy_listen; then
    timeout 8 systemctl reload caddy >/dev/null 2>&1 || true
  else
    systemctl reset-failed caddy >/dev/null 2>&1 || true
    timeout 25 systemctl start caddy >/dev/null 2>&1 || true
  fi
  log "caddy parked on updating page"
}

caddy_dropin() {
  mkdir -p /etc/systemd/system/caddy.service.d
  cat >/etc/systemd/system/caddy.service.d/reelos.conf <<'EOF'
[Service]
Type=simple
TimeoutStartSec=45
TimeoutStopSec=10
Restart=on-failure
RestartSec=2
ExecStart=
ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
EOF
  systemctl daemon-reload || true
  systemctl enable caddy >/dev/null 2>&1 || true
}

caddy_listen() {
  ss -lptn 2>/dev/null | grep -qE ':80 |:80$' && return 0
  curl -sS -o /dev/null --max-time 1 http://127.0.0.1/ && return 0
  return 1
}

start_shell() {
  if systemctl start reelos >/dev/null 2>&1; then
    return 0
  fi
  log "systemd dbus down — starting shell without unit"
  if curl -s -o /dev/null -w "%{http_code}" --max-time 1 http://127.0.0.1:8080/ 2>/dev/null | grep -q 200; then
    return 0
  fi
  (
    cd /opt/reelos/app && exec /usr/bin/env npm run start:box
  ) >>/var/lib/reelos/reelos.log 2>&1 &
  echo $! >"$STATE/reelos.pid" || true
}

caddy_clear() {
  timeout 8 systemctl stop caddy >/dev/null 2>&1 || true
  pkill -x caddy >/dev/null 2>&1 || true
  sleep 0.4
}

caddy_reelos() {
  mkdir -p /etc/caddy
  if [ -f "$ROOT/compose/Caddyfile" ]; then
    cp "$ROOT/compose/Caddyfile" /etc/caddy/Caddyfile
  elif [ -f /etc/caddy/Caddyfile.reelos.bak ]; then
    cp /etc/caddy/Caddyfile.reelos.bak /etc/caddy/Caddyfile
  fi
  if ! grep -q 'auto_https off' /etc/caddy/Caddyfile 2>/dev/null; then
    printf '%s\n' '{' '	auto_https off' '	admin off' '}' '' | cat - /etc/caddy/Caddyfile > /etc/caddy/Caddyfile.tmp
    mv /etc/caddy/Caddyfile.tmp /etc/caddy/Caddyfile
  fi
  caddy_dropin
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 8080/tcp >/dev/null 2>&1 || true
  ufw allow 8096/tcp >/dev/null 2>&1 || true
  systemctl reset-failed caddy >/dev/null 2>&1 || true
  # admin off → reload is a no-op. Restart or the updating page sticks forever.
  caddy_clear
  if timeout 25 systemctl start caddy >/dev/null 2>&1 && sleep 1 && caddy_listen; then
    log "caddy systemd active"
  elif timeout 25 systemctl restart caddy >/dev/null 2>&1 && sleep 1 && caddy_listen; then
    log "caddy systemd active after restart"
  else
    log "caddy systemd stuck — last journal:"
    journalctl -u caddy.service -n 15 --no-pager 2>/dev/null | tail -15 | while read -r line; do log "caddy $line"; done || true
    pkill -x caddy >/dev/null 2>&1 || true
    sleep 0.3
    nohup /usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >>/var/lib/reelos/caddy.log 2>&1 &
    sleep 1
    log "caddy nohup fallback — unit still enabled for reboot"
  fi
  log "caddy proxying to live 8080"
}

restore() {
  log "restore after failure"
  bug_snap "restore"
  trap - ERR
  systemctl stop reelos 2>/dev/null || true
  if [ -d "$ROOT.prev/app" ]; then
    # Move the bad tree aside first. Never rm live app before .prev is ready.
    rm -rf "$ROOT/app.broken"
    if [ -d "$ROOT/app" ]; then
      mv "$ROOT/app" "$ROOT/app.broken" || rm -rf "$ROOT/app"
    fi
    mv "$ROOT.prev/app" "$ROOT/app"
    rm -rf "$ROOT/app.broken"
    [ -f "$ROOT.prev/VERSION" ] && cp -a "$ROOT.prev/VERSION" "$ROOT/VERSION"
    [ -f "$ROOT.prev/docker-compose.yml" ] && cp -a "$ROOT.prev/docker-compose.yml" "$ROOT/compose/docker-compose.yml"
  fi
  systemctl daemon-reload 2>/dev/null || true
  start_shell
  sleep 2
  start_shell
  local i code
  for i in $(seq 1 20); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/ 2>/dev/null || true)
    [ "$code" = "200" ] && break
    sleep 1
  done
  caddy_reelos
}

# Unit + daemon-reload BEFORE stop so start never uses a stale unit.
UNIT_SRC=""
if [ -f "$NEXT/systemd/reelos.service" ]; then
  UNIT_SRC="$NEXT/systemd/reelos.service"
elif [ -f "$WORK/src/install/systemd/reelos.service" ]; then
  UNIT_SRC="$WORK/src/install/systemd/reelos.service"
fi
if [ -n "$UNIT_SRC" ]; then
  mkdir -p "$ROOT/systemd"
  cp "$UNIT_SRC" "$ROOT/systemd/reelos.service"
  cp "$UNIT_SRC" /etc/systemd/system/reelos.service
  if systemctl daemon-reload >/dev/null 2>&1; then
    log "unit installed, daemon-reload (8080 still up)"
  else
    log "unit installed, daemon-reload skipped (systemd dbus)"
  fi
fi

trap restore ERR
caddy_updating
log "stopping shell for mv (seconds, not minutes)"
systemctl stop reelos 2>/dev/null || true
mv "$ROOT/app" "$ROOT.prev/app"
mv "$NEXT/app" "$ROOT/app"
mkdir -p "$ROOT/bin" "$ROOT/compose" "$ROOT/systemd"
cp -a "$NEXT/bin/." "$ROOT/bin/"
cp -a "$NEXT/systemd/." "$ROOT/systemd/" 2>/dev/null || true
cp "$NEXT/compose/docker-compose.yml" "$ROOT/compose/docker-compose.yml" 2>/dev/null || true
cp "$NEXT/compose/Caddyfile" "$ROOT/compose/Caddyfile" 2>/dev/null || true
# firstboot ExecStart=/opt/reelos/install.sh — refresh so a re-enabled unit
# gets the HERE==ROOT / already-provisioned no-op, not the ISO copy.
if [ -f "$WORK/src/install/reelos-install.sh" ]; then
  cp "$WORK/src/install/reelos-install.sh" "$ROOT/install.sh"
  chmod 755 "$ROOT/install.sh" || true
fi
rm -rf "$NEXT"

log "starting shell"
# Do not systemctl-enable the firstboot unit. ISO owns it; Apply must not bring the loop back.
systemctl enable reelos reelos-ensure caddy >/dev/null 2>&1 || true
if [ -f "$ROOT/systemd/reelos-ensure.service" ]; then
  cp "$ROOT/systemd/reelos-ensure.service" /etc/systemd/system/reelos-ensure.service
  chmod 755 "$ROOT/bin/reelos-ensure.sh" 2>/dev/null || true
fi
if [ -f "$ROOT/systemd/reelos-mnt-rshared.service" ]; then
  cp "$ROOT/systemd/reelos-mnt-rshared.service" /etc/systemd/system/reelos-mnt-rshared.service
  systemctl enable --now reelos-mnt-rshared >/dev/null 2>&1 || true
fi
if [ -f "$ROOT/systemd/reelos-lock-clients.service" ]; then
  cp "$ROOT/systemd/reelos-lock-clients.service" /etc/systemd/system/reelos-lock-clients.service
fi
if [ -f "$ROOT/systemd/reelos-lock-clients.timer" ]; then
  cp "$ROOT/systemd/reelos-lock-clients.timer" /etc/systemd/system/reelos-lock-clients.timer
  systemctl enable --now reelos-lock-clients.timer >/dev/null 2>&1 || true
fi
if [ -f "$ROOT/systemd/reelos-selfheal.service" ]; then
  cp "$ROOT/systemd/reelos-selfheal.service" /etc/systemd/system/reelos-selfheal.service
fi
if [ -f "$ROOT/systemd/reelos-selfheal.timer" ]; then
  cp "$ROOT/systemd/reelos-selfheal.timer" /etc/systemd/system/reelos-selfheal.timer
  chmod 755 "$ROOT/bin/reelos-selfheal.sh" 2>/dev/null || true
  systemctl enable --now reelos-selfheal.timer >/dev/null 2>&1 || true
fi
systemctl daemon-reload >/dev/null 2>&1 || true
start_shell

probe_home() {
  local i code restarted=0
  log "waiting for :8080 — door :80 stays on updating page"
  # Unit file may have changed on disk (house: daemon-reload needed).
  # systemctl start is a no-op on a hung/failed unit — restart once at ~15s.
  systemctl daemon-reload >/dev/null 2>&1 || true
  start_shell
  # Vite cold-start after npm ci can exceed 45s under disk load. 90s of
  # fast-fail curls; only nudge the unit every 5s so we do not restart storms.
  for i in $(seq 1 90); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/ 2>/dev/null || true)
    if [ "$code" = "200" ]; then
      log "home 200"
      return 0
    fi
    printf '\r[waiting Home] %d/90   ' "$i" >&2
    if [ "$restarted" = "0" ] && [ "$i" -ge 15 ]; then
      log "probe_home :8080 not 200 after 15s — restart hung reelos"
      timeout 20 systemctl restart reelos >/dev/null 2>&1 || true
      restarted=1
      start_shell
    elif [ "$i" = "1" ] || [ $((i % 5)) -eq 0 ]; then
      start_shell
    fi
    sleep 1
  done
  printf '\n' >&2
  journalctl -u reelos --no-pager -n 50 >>"$LOG" 2>/dev/null || true
  log "home never returned"
  return 1
}

probe_port80() {
  local i code page
  for i in $(seq 1 20); do
    code=$(curl -sS -o /tmp/reelos-ota-80.html -w "%{http_code}" --max-time 3 http://127.0.0.1/ || true)
    page=$(head -c 800 /tmp/reelos-ota-80.html 2>/dev/null || true)
    log "probe :80 $i code=$code"
    if echo "$page" | grep -qiE 'Caddy works|Welcome to Caddy'; then
      log "stock Caddy on :80 — reinstalling ReelOS Caddyfile"
      caddy_reelos
      sleep 1
      continue
    fi
    if echo "$page" | grep -qi 'ReelOS is updating'; then
      log ":80 still updating page — restart caddy (reload is a no-op with admin off)"
      caddy_reelos
      sleep 2
      continue
    fi
    if [ "$code" = "200" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! probe_home; then
  log "probe failed — restoring previous app"
  restore
  exit 1
fi
trap - ERR
log "home up — not stamping VERSION"
step "Home"

caddy_reelos
if ! probe_port80; then
  log ":80 still down — Home is on :8080, not rolling back"
fi
step "Door :80"

ensure_door() {
  # Import/indexer heal can OOM *arr and leave Vite accepting TCP with no HTTP.
  # systemctl start is a no-op on a hung-but-active unit — restart it.
  start_fuse_readers
  systemctl start reelos >/dev/null 2>&1 || true
  caddy_reelos
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/ 2>/dev/null || true)
  if [ "$code" != "200" ]; then
    log "door :8080 not 200 (got ${code:-000}) — restart hung reelos"
    timeout 20 systemctl restart reelos >/dev/null 2>&1 || true
    start_shell
    sleep 2
  fi
  if probe_home && probe_port80; then
    log "door :80 is ReelOS"
    return 0
  fi
  log "door :80 dead — retry caddy"
  timeout 12 systemctl restart caddy >/dev/null 2>&1 || true
  sleep 2
  caddy_reelos
  probe_home || true
  probe_port80 || true
  if curl -fsS -o /dev/null --max-time 3 http://127.0.0.1/; then
    log "door :80 is ReelOS"
    return 0
  fi
  log "door :80 still dead"
  return 1
}

sshd_open() {
  mkdir -p /etc/ssh/sshd_config.d
  cat >/etc/ssh/sshd_config.d/reelos.conf <<'EOF'
ListenAddress 0.0.0.0
ListenAddress ::
PasswordAuthentication yes
EOF
  systemctl enable --now ssh 2>/dev/null || systemctl enable --now sshd 2>/dev/null || true
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow in on tailscale0 >/dev/null 2>&1 || true
  fi
  if command -v tailscale >/dev/null 2>&1; then
    tailscale set --ssh 2>/dev/null || true
  fi
  log "ssh listening on 0.0.0.0:22"
}
sshd_open


# [ -e /mnt/debrid/__all__ ] is true on an ENOTCONN leftover. listdir is not.
fuse_live() {
  ls /mnt/debrid/__all__ >/dev/null 2>&1 && return 0
  ls /mnt/debrid/version.txt >/dev/null 2>&1
}

clear_stale_fuse() {
  if fuse_live; then
    return 0
  fi
  if [ -e /mnt/debrid ] || [ -L /mnt/debrid ] || mount | grep -q ' on /mnt/debrid '; then
    log "stale /mnt/debrid FUSE — lazy unmount"
    local i
    for i in $(seq 1 8); do
      if ls /mnt/debrid >/dev/null 2>&1 && ! mount | grep -q 'fuse.decypharr on /mnt/debrid'; then
        break
      fi
      fusermount -uz /mnt/debrid 2>/dev/null || umount -l /mnt/debrid 2>/dev/null || true
      sleep 1
    done
  fi
}

start_fuse_readers() {
  docker start decypharr 2>/dev/null || true
  docker start reelos-jellyfin-1 reelos-radarr-1 reelos-sonarr-1 2>/dev/null || true
  # After a recreate/FUSE remount on a low-power box, some compose containers get
  # left in "Created"/"Exited" instead of "Up" (then the indexer heal sees a down
  # Sonarr and heal_reds, and the box is left with *arr down). Start every
  # container in the reelos project; `docker start` on a running one is a no-op.
  local c
  for c in $(docker ps -aq --filter "label=com.docker.compose.project=reelos" 2>/dev/null); do
    docker start "$c" 2>/dev/null || true
  done
}

nudge_fuse() {
  # Stale FUSE (ENOTCONN) makes mkdir -p fail with "Already exists" under set -e.
  clear_stale_fuse
  mkdir -p /mnt /mnt/debrid /mnt/symlinks
  mount --make-rshared /mnt 2>/dev/null || log "rshared /mnt skipped"
  if fuse_live; then
    log "fuse already on host — not bind-mounting /mnt"
  elif [ -x "$ROOT/bin/wire-engines.py" ]; then
    log "fuse not on host — remount decypharr"
    python3 "$ROOT/bin/wire-engines.py" fuse || log "fuse remount non-fatal"
    start_fuse_readers
  else
    log "fuse not mounted — skip remount"
  fi
}

wait_fuse() {
  local i
  for i in $(seq 1 30); do
    if fuse_live; then
      log "fuse ready ($i/30)"
      return 0
    fi
    sleep 2
  done
  log "fuse not ready after wait — hops will fail-close if still empty"
  return 0
}
nudge_fuse
step "FUSE"

load_env() {
  if [ -f "$ROOT/compose/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT/compose/.env"
    set +a
  fi
}

if [ -f /var/lib/reelos/provisioned ] && [ -f "$ROOT/compose/docker-compose.yml" ]; then
  log "clear stale FUSE before compose up"
  clear_stale_fuse
  mkdir -p /mnt /mnt/symlinks /mnt/debrid
  mount --make-rshared /mnt 2>/dev/null || log "rshared /mnt skipped"
  load_env
  COMPOSE_CHANGED=0
  if [ -f "$WORK/src/install/compose/docker-compose.yml" ]; then
    # Swap already copied the tarball onto $ROOT/compose. Comparing those two
    # always says unchanged and skips `docker compose up` — house 1.2.50.13
    # kept 14h-old containers with HostConfig.Dns=1.1.1.1. Compare the tarball
    # to the pre-swap yml instead.
    PREV_YML="$ROOT.prev/docker-compose.yml"
    if [ -f "$PREV_YML" ] && cmp -s "$WORK/src/install/compose/docker-compose.yml" "$PREV_YML" 2>/dev/null; then
      log "compose yml unchanged — skip full compose up and indexer test (FUSE remount still runs)"
    else
      COMPOSE_CHANGED=1
      cp "$WORK/src/install/compose/docker-compose.yml" "$ROOT/compose/docker-compose.yml"
      log "compose yml from tarball"
    fi
  fi
  # Yml can already lack dns: while *arr still have HostConfig.Dns=1.1.1.1 from
  # the 1.2.50.13 create (house radarr/sonarr/prowlarr/decypharr, Sept 8–9).
  DNS_IDS=""
  for id in $(docker ps -q 2>/dev/null); do
    case "$(docker inspect -f '{{json .HostConfig.Dns}}' "$id" 2>/dev/null || true)" in
      *1.1.1.1*)
        COMPOSE_CHANGED=1
        DNS_IDS="$DNS_IDS $id"
        ;;
    esac
  done
  if [ -n "$DNS_IDS" ]; then
    # `up -d` alone will not drop a runtime HostConfig.Dns=1.1.1.1, and services
    # with a fixed container_name (seerr, decypharr) make it fail with
    # "container name already in use" — the whole recreate is skipped and the
    # stale DNS survives. Remove the offending containers first so compose can
    # recreate them fresh without dns:1.1.1.1.
    log "containers still have HostConfig.Dns=1.1.1.1 — remove before recreate"
    # shellcheck disable=SC2086
    docker rm -f $DNS_IDS 2>/dev/null || true
  fi
  if [ "$COMPOSE_CHANGED" = "1" ]; then
    (cd "$ROOT/compose" && docker compose \
      --profile indexers --profile movies --profile tv --profile debrid --profile jellyfin --profile subtitles \
      up -d --remove-orphans) || log "compose up skipped"
    log "waiting for Prowlarr :9696"
    for _i in $(seq 1 20); do
      if curl -fsS -o /dev/null --max-time 2 http://127.0.0.1:9696/; then
        log "prowlarr up"
        break
      fi
      sleep 1
    done
    log "compose recreated — remount FUSE before hops"
    nudge_fuse
    wait_fuse
    start_fuse_readers
  fi
fi
if [ "${COMPOSE_CHANGED:-0}" = "1" ] && [ -f /var/lib/reelos/provisioned ] && [ -x "$ROOT/bin/wire-engines.py" ]; then
  # Run the heavy wire (import loops, 1080 companion sweep, recycle) at the
  # lowest CPU + idle IO priority so it yields to Vite/the app on a low-power
  # box. Same work, just deprioritized — children inherit the nice/ionice level,
  # so the app stays responsive and the door probe does not time out mid-Apply.
  NICE=""
  command -v nice >/dev/null 2>&1 && NICE="nice -n 19"
  command -v ionice >/dev/null 2>&1 && NICE="$NICE ionice -c 3"
  REELOS_OTA=1 $NICE python3 "$ROOT/bin/wire-engines.py" || log "wire-engines non-fatal"
fi

indexer_canary() {
  python3 - <<'PY'
import json, os, re, sys, urllib.error, urllib.request
from pathlib import Path
root = Path(os.environ.get("REELOS_ROOT", "/opt/reelos"))
state = Path("/var/lib/reelos")
src = ""
answers = {}
ap = state / "answers.json"
if ap.exists():
    try:
        answers = json.loads(ap.read_text())
        src = str(answers.get("source") or "").strip()
    except json.JSONDecodeError:
        src = ""
envp = root / "compose" / ".env"
if envp.exists():
    for line in envp.read_text().splitlines():
        if line.startswith("SOURCE=") and not src:
            src = line.split("=", 1)[1].strip()
debrid = {"torbox", "real-debrid", "alldebrid", "premiumize", "realdebrid"}
if src == "local-vpn":
    print("skip")
    sys.exit(0)
errp = state / "releases-error.txt"
err = errp.read_text().strip()[:400] if errp.exists() else ""
xml = root / "compose" / "configs" / "prowlarr" / "config.xml"
key = None
if xml.exists():
    m = re.search(r"<ApiKey>([^<]+)</ApiKey>", xml.read_text())
    key = m.group(1) if m else None
if not key:
    print(err or "Prowlarr has no API key")
    sys.exit(1)
req = urllib.request.Request(
    "http://127.0.0.1:9696/api/v1/indexer",
    headers={"X-Api-Key": key},
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        rows = json.load(r)
except Exception as e:
    print(err or f"{type(e).__name__}: {e}")
    sys.exit(1)
ok_names = []
last = err
for ix in rows or []:
    if not ix.get("enable"):
        continue
    req = urllib.request.Request(
        "http://127.0.0.1:9696/api/v1/indexer/test",
        data=json.dumps(ix).encode(),
        method="POST",
        headers={"X-Api-Key": key, "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=25).read()
        ok_names.append(str(ix.get("name")))
    except urllib.error.HTTPError as e:
        last = e.read().decode()[:300] if e.fp else str(e)
    except Exception as e:
        last = f"{type(e).__name__}: {e}"
if not ok_names:
    print(last or "no indexer passed test")
    sys.exit(1)
print(",".join(ok_names))
sys.exit(0)
PY
}

CANARY_FAIL=0
HOP_FAIL=0
SEARCH_HOP_FAIL=0

hop_stack() {
  log "hops: FUSE + Jellyfin + search (search advisory)"
  step "Jellyfin"
  if fuse_live; then
    log "hop FUSE green"
  else
    if [ "${COMPOSE_CHANGED:-0}" = "1" ]; then
      log "hop FUSE empty after compose — waiting"
      wait_fuse
    fi
    if fuse_live; then
      log "hop FUSE green"
    else
      log "hop FUSE red — /mnt/debrid empty"
      HOP_FAIL=1
    fi
  fi
  local j i jf_tries=20
  [ "${COMPOSE_CHANGED:-0}" = "1" ] && jf_tries=60
  j=0
  for i in $(seq 1 "$jf_tries"); do
    if curl -fsS --max-time 3 http://127.0.0.1:8096/System/Info/Public >/dev/null 2>&1; then
      j=1
      break
    fi
    printf '\r[waiting Jellyfin] %d/%d   ' "$i" "$jf_tries" >&2
    sleep 1
  done
  printf '\n' >&2
  if [ "$j" = "1" ]; then
    log "hop Jellyfin green"
  else
    log "hop Jellyfin red — :8096 silent"
    HOP_FAIL=1
  fi
  step "Search"
  # Seerr/TMDB can Abort under load, and /api/lookup returns 200 + empty
  # titles when Seerr has no key yet. That is not "the tree missed disk."
  # #47 retry (4×) kept; red still sets SEARCH_HOP_FAIL only (advisory).
  local s i
  s=0
  for i in $(seq 1 4); do
    if python3 - <<'PY'
import json, sys, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:8080/api/lookup?q=Batman", timeout=20) as r:
        d = json.load(r)
except Exception as e:
    print(type(e).__name__, e, file=sys.stderr)
    sys.exit(1)
titles = d.get("titles") if isinstance(d, dict) else []
if titles:
    print((titles[0].get("title") or "ok")[:80], file=sys.stderr)
    sys.exit(0)
print(d.get("error") or "no titles", file=sys.stderr)
sys.exit(1)
PY
    then
      s=1
      log "hop search green"
      break
    fi
    log "hop search retry $i/4 — Seerr/Vite still coming up"
    sleep 5
  done
  if [ "$s" != "1" ]; then
    log "hop search red"
    SEARCH_HOP_FAIL=1
  fi
}

HEAL_FAIL=0
if [ -f /var/lib/reelos/provisioned ]; then
  hop_stack
  if [ -x "$ROOT/bin/wire-engines.py" ]; then
    log "public TV indexers + Prowlarr→Sonarr sync (EZTV/ShowRSS RSS fallback; YTS is movies-only)"
    if ! python3 "$ROOT/bin/wire-engines.py" indexers; then
      log "indexers heal red"
      if [ -f /var/lib/reelos/wire.log ]; then
        grep -E 'heal red|torznab |search indexers |prowlarr api' /var/lib/reelos/wire.log | tail -n 20 | while IFS= read -r line; do
          log "wire ${line}"
        done
      fi
      HEAL_FAIL=1
    fi
    log "import after hops (TV/movies into the library)"
    if ! python3 "$ROOT/bin/wire-engines.py" import; then
      log "import/heal red"
      HEAL_FAIL=1
    fi
  fi
fi

if [ "${COMPOSE_CHANGED:-0}" = "1" ] && [ -f /var/lib/reelos/provisioned ]; then
  CANARY_OUT=$(indexer_canary) || {
    CANARY_FAIL=1
    log "indexer canary FAIL ${CANARY_OUT:-} — not stamping installed version"
    [ -f "$STATE/releases-error.txt" ] && log "$(head -c 400 "$STATE/releases-error.txt")"
  }
  [ "$CANARY_FAIL" = "0" ] && log "indexer canary ${CANARY_OUT:-ok}"
else
  log "indexer canary skipped (compose unchanged — UI-only OTA)"
fi

STAMP_OK=1
if [ "${SEARCH_HOP_FAIL:-0}" = "1" ]; then
  log "hop search red — not blocking UI-only stamp"
  bug_snap "search-hop-red"
fi
if [ "${HOP_FAIL:-0}" = "1" ] && [ "${COMPOSE_CHANGED:-0}" != "1" ]; then
  log "hop FUSE/Jellyfin red — compose unchanged, not blocking stamp"
  bug_snap "hops-red-ui-only"
fi
if [ "${COMPOSE_CHANGED:-0}" = "1" ] && [ "${HOP_FAIL:-0}" = "1" ]; then
  log "not printing applied — hops or indexer red"
  bug_snap "hops-red"
  log "installed remains $(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
  STAMP_OK=0
fi
if [ "$CANARY_FAIL" = "1" ]; then
  log "not printing applied — hops or indexer red"
  bug_snap "hops-red"
  log "installed remains $(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
  STAMP_OK=0
fi
if [ "${HEAL_FAIL:-0}" = "1" ]; then
  log "not printing applied — jellyfin/indexer heal red"
  bug_snap "heal-red"
  log "installed remains $(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
  STAMP_OK=0
fi

if ! ensure_door; then
  log "not printing applied — phone would see connection refused"
  bug_snap "door-dead"
  exit 1
fi
if [ "$STAMP_OK" != "1" ]; then
  log "door restored — still not stamping"
  exit 1
fi

echo "$REMOTE" >"$ROOT/VERSION"
echo "$REMOTE" >"$STATE/installed-version"
if [ -n "${HEAD_SHA:-}" ]; then
  echo "$HEAD_SHA" >"$STATE/applied-sha"
fi
log "$NOTES"
log "ReelOS $REMOTE applied."
# Pull after stamp so a long image fetch cannot un-apply a live tree.
# Separate unit from Vite (unlike Finish/provision spawnSync pull).
if [ -f /var/lib/reelos/stack-images ]; then
  log "stack images — docker compose pull"
  (cd "$ROOT/compose" && timeout 600 docker compose pull) || log "compose pull non-fatal"
fi
