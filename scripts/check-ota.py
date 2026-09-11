#!/usr/bin/env python3
"""Push-time gate. If this fails, do not push and do not tell the house to Apply.

Never print 'applied' unless :80 is ReelOS. Never start a second Apply.
Never leave Caddy dead after FUSE/engine restarts.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Always fatal, even on the box (--apply). These are the UX lies we already shipped.
CONTRACTS = (
    ("daemon/reelos-update.sh", "apply already running"),
    ("daemon/reelos-update.sh", "ensure_door"),
    ("daemon/reelos-update.sh", "not printing applied"),
    ("daemon/reelos-update.sh", "door :80 is ReelOS"),
    ("scripts/reelos-lookup-plugin.mjs", "Update already running"),
    ("scripts/reelos-lookup-plugin.mjs", "applyIsRunning"),
    ("scripts/reelos-ota-status.mjs", "lockIsHeld"),
    ("src/routes/__root.tsx", "syncUpdateFromBox"),
    ("src/components/shell.tsx", "ApplyingBar"),
    ("daemon/reelos-update.sh", "engines may still be configuring"),
    ("daemon/reelos-update.sh", "hop FUSE"),
    ("daemon/reelos-update.sh", "hop Jellyfin"),
    ("daemon/reelos-update.sh", "hop search"),
    ("daemon/reelos-update.sh", "package.json or package-lock.json changed"),
    ("daemon/reelos-update.sh", "staging missing package.json"),
    ("daemon/reelos-update.sh", "hop search red — not blocking UI-only stamp"),
    ("daemon/reelos-update.sh", "not printing applied — jellyfin/indexer heal red"),
    ("daemon/reelos-update.sh", "door restored — still not stamping"),
    ("daemon/reelos-update.sh", "restart hung reelos"),
    ("daemon/reelos-update.sh", "npm ci failed — not swapping"),
    ("daemon/reelos-update.sh", "overlay house compose/configs onto staging"),
    ("daemon/reelos-update.sh", "--exclude 'decypharr/cache/'"),
    ("daemon/reelos-update.sh", "not 200 after 15s"),
    ("scripts/reelos-lookup-plugin.mjs", "/api/ready"),
    ("src/components/splash.tsx", "Local state"),
    ("daemon/reelos-update.sh", "still copying node_modules"),
    ("daemon/reelos-update.sh", "ROOT.prev/docker-compose.yml"),
    ("daemon/reelos-update.sh", "compose recreated — remount FUSE before hops"),
    ("daemon/reelos-update.sh", "clear stale FUSE before compose up"),
    ("daemon/reelos-update.sh", "fuse_live"),
    ("src/components/settings-updates.tsx", "This install"),
    ("src/components/settings-updates.tsx", "This update"),
    ("scripts/reelos-lookup-plugin.mjs", "pendingNotes"),
    ("scripts/update-notes.mjs", "ownerEnglish"),
    ("scripts/reelos-library-remove.mjs", "deleteFilesAllowed"),
    ("src/components/remove-from-box.tsx", "Remove from this box"),
    ("daemon/reelos-selfheal.sh", "not walking FUSE"),
    ("daemon/reelos-selfheal.sh", "not enabling firstboot"),
    ("daemon/reelos-selfheal.sh", "ffprobe D-state"),
    ("scripts/reelos-box.mjs", "serving built UI"),
    ("scripts/reelos-box.mjs", "production preview"),
    ("daemon/reelos-update.sh", "vite build skipped — 4GB box"),
    ("daemon/reelos-update.sh", "package-lock.json unchanged — reused node_modules"),
    ("daemon/reelos-update.sh", "prebuilt client staged"),
    ("daemon/reelos-update.sh", "4GB box never compiles"),
    ("daemon/reelos-update.sh", "do not remount if listed"),
    ("src/components/settings-view.tsx", "Show Advanced"),
    ("src/components/settings-updates.tsx", "Beta channel"),
    ("scripts/reelos-lookup-plugin.mjs", "CHANNEL_BETA_URL"),
    ("daemon/reelos-update.sh", "no-ffprobe"),
    ("daemon/reelos-update.sh", "fuse stacked"),
    ("daemon/wire-engines.parts/07.part", "enableMediaInfo"),
    ("daemon/wire-engines.parts/07.part", "rescanAfterRefresh"),
    ("daemon/wire-engines.parts/06.part", "box_is_small"),
    ("daemon/wire-engines.parts/02.part", "do not remount if listed"),
    ("daemon/reelos-selfheal.sh", "idle load"),
    ("scripts/reelos-box.mjs", "nitro+api"),
    ("scripts/reelos-box-scale.mjs", "SMALL_MEM_KB"),
    ("scripts/reelos-box-scale.mjs", "hasVaapiDri"),
    ("daemon/wire-engines.parts/09.part", "DirectPlay/DirectStream"),
    ("daemon/wire-engines.parts/09.part", "persist_jellyfin_encoding_xml"),
    ("daemon/wire-engines.parts/09.part", "has_vaapi_dri"),
    ("scripts/reelos-selfheal.mjs", "--performance"),
    ("scripts/reelos-lookup-plugin.mjs", "seedJellyfinEncodingXml"),
    ("src/components/settings-panels.tsx", "DirectPlay/DirectStream"),
    ("prebuilt/MANIFEST.txt", "/assets/"),
    ("prebuilt/vercel-output/nitro.json", "nitro"),
    ("install/compose/configs/sonarr/reelos-debrid.json", "enableMediaInfo"),
    ("install/compose/configs/sonarr/reelos-debrid.json", "rescanAfterRefresh"),
    ("scripts/wizard-honesty.mjs", "Use TorBox."),
    ("scripts/reelos-lookup-plugin.mjs", "sourceValidateError"),
    ("scripts/reelos-lookup-plugin.mjs", "provisionHonestyError"),
    ("src/components/wizard.tsx", "TOTAL = 7"),
    ("src/components/wizard.tsx", "Untested"),
    ("src/lib/store.ts", 'source: "torbox"'),
    ("daemon/reelos-update.sh", "ui_wants_beta"),
    ("daemon/reelos-update.sh", "beta channel from ui-settings.json"),
    ("scripts/reelos-lookup-plugin.mjs", "dispatchBooksApi"),
    ("scripts/reelos-lookup-plugin.mjs", "ui apply using local mailman"),
    ("compose/docker-compose.yml", 'profiles: ["books"]'),
    ("compose/Caddyfile", "handle /kavita*"),
    ("src/components/books-view.tsx", "Download"),
    ("src/components/splash.tsx", "Begin"),
)


def fail(msg: str) -> int:
    print(msg, file=sys.stderr)
    return 1


def main() -> int:
    apply = "--apply" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--apply"]
    root = Path(args[0] if args else ".").resolve()
    import json

    ver = (root / "VERSION").read_text().strip()
    chan_doc = json.loads((root / "channel.json").read_text())
    chan = chan_doc.get("version")
    stamp_path = root / "src/lib/version-stamp.ts"
    store_path = root / "src/lib/store.ts"
    text = stamp_path.read_text() if stamp_path.is_file() else store_path.read_text()
    shipped = re.search(r'SHIPPED_VERSION = "([^"]+)"', text)
    latest = re.search(r'LATEST_VERSION = "([^"]+)"', text)
    s = shipped.group(1) if shipped else ""
    l = latest.group(1) if latest else ""
    stable = "1.2.50.38"
    if "1.2.51" in ver or ver.startswith("1.2.51"):
        return fail("1.2.51 is parked; do not stamp it")
    if "-beta" in ver:
        if ver != s or ver != l:
            return fail(f"VERSION skew VERSION={ver} shipped={s} latest={l}")
        if chan != stable:
            return fail(f"stable channel.json must stay {stable} on a beta tree, got {chan}")
        if chan_doc.get("channel") != "stable" or "main.tar.gz" not in str(chan_doc.get("tarball") or ""):
            return fail("stable channel.json must stay channel=stable tarball=main.tar.gz")
        beta_path = root / "channel-beta.json"
        if not beta_path.is_file():
            return fail("beta tree missing channel-beta.json")
        beta_doc = json.loads(beta_path.read_text())
        if beta_doc.get("version") != ver or beta_doc.get("channel") != "beta":
            return fail(
                f"channel-beta.json must match VERSION={ver} channel=beta, got {beta_doc.get('version')} {beta_doc.get('channel')}"
            )
        tar = str(beta_doc.get("tarball") or "")
        if "main.tar.gz" in tar:
            return fail("beta tarball must not be main.tar.gz")
        if "beta-arena-books" not in tar:
            return fail("beta tarball must be the beta-arena-books branch")
    elif ver != chan or ver != s or ver != l:
        return fail(f"VERSION skew VERSION={ver} channel={chan} shipped={s} latest={l}")

    updater = (root / "daemon/reelos-update.sh").read_text()
    for rel, needle in CONTRACTS:
        textc = (root / rel).read_text() if (root / rel).is_file() else ""
        if needle not in textc:
            return fail(f"OTA contract missing {rel} ~ {needle}")

    assets = root / "prebuilt/vercel-output/static/assets"
    if not list(assets.glob("styles-*.css")) or not list(assets.glob("index-*.js")):
        return fail("OTA contract: prebuilt hashed /assets styles/index missing")

    if "stale ota.lock — taking lock" in updater or 'rm -f "$STATE/ota.lock"' in updater:
        return fail("OTA contract: must not delete ota.lock (inode split = dual Apply)")
    if 'cmp -s "$WORK/src/install/compose/docker-compose.yml" "$ROOT/compose/docker-compose.yml"' in updater:
        return fail("OTA contract: compose change must compare against pre-swap yml")

    stamp = updater.find('echo "$REMOTE" >"$ROOT/VERSION"')
    applied = updater.find('log "ReelOS $REMOTE applied."')
    door = updater.find("if ! ensure_door")
    if door < 0 or stamp < 0 or applied < 0:
        return fail("OTA contract: ensure_door / VERSION stamp / applied. missing")
    if not (door < stamp < applied):
        return fail("OTA contract: stamp/applied must come after ensure_door")
    stamp_ok = updater.find("STAMP_OK=1")
    if stamp_ok < 0 or "exit 1" in updater[stamp_ok:door]:
        return fail("OTA contract: hops/heal-red must not exit before ensure_door")
    refuse = updater.find('log "door restored — still not stamping"')
    if refuse < 0 or not (door < refuse < stamp):
        return fail("OTA contract: heal-red restores door then refuses stamp")

    pull = updater.find('stack images — docker compose pull')
    if pull >= 0 and pull < applied:
        return fail("OTA contract: compose pull must come after applied. stamp")

    install_up = root / "install/bin/reelos-update.sh"
    if install_up.is_file() and install_up.read_text() != updater:
        return fail("OTA contract: install/bin/reelos-update.sh must match daemon/")

    fatal = 0
    warns = 0
    for line in updater.splitlines():
        if not line.startswith("need ") or line.startswith("need()"):
            continue
        rest = line[5:].strip()
        path, _, pat = rest.partition(" ")
        pat = pat.strip().strip("'")
        f = root / path
        if not f.is_file():
            print(f"canary missing {path}", file=sys.stderr)
            fatal += 1
            continue
        textc = f.read_text()
        if path.endswith("wire-engines.py"):
            parts_dir = f.parent / "wire-engines.parts"
            if parts_dir.is_dir():
                textc += "".join(p.read_text() for p in sorted(parts_dir.glob("*.part")))
        if pat and pat not in textc:
            print(f"canary grep miss {path} ~ {pat}", file=sys.stderr)
            if apply:
                warns += 1
            else:
                fatal += 1
    if fatal:
        return fail(f"check-ota fail fatal={fatal} warn={warns}")
    print(f"check-ota ok version={ver} warn={warns} contracts={len(CONTRACTS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
