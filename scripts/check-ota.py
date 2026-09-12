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
    ("daemon/reelos_hardware.py", "ram_gb"),
    ("daemon/reelos_hardware.py", "disk_kind"),
    ("daemon/reelos_hardware.py", "catchup_memory_max"),
    ("daemon/reelos_hardware.py", "not a Pi"),
    ("daemon/reelos_hardware.py", "cgroup_hiding"),
    ("daemon/reelos_hardware.py", "probe_version"),
    ("daemon/reelos_hardware.py", "root-on-internal"),
    ("daemon/reelos-selfheal.sh", "library catch-up deferred"),
    ("daemon/reelos-update.sh", "hardware profile"),
    ("daemon/sonarr_manual_import.py", "concurrency 0"),
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
    ("daemon/reelos-update.sh", "library catch-up in background"),
    ("daemon/reelos-update.sh", "import/heal red — not un-stamping UI swap"),
    ("daemon/reelos-selfheal.sh", "library catch-up in background"),
    ("daemon/reelos-selfheal.sh", "systemd-run"),
    ("daemon/reelos-selfheal.sh", "reelos-library-catchup"),
    ("install/systemd/reelos-selfheal.service", "KillMode=process"),
    ("daemon/sonarr_manual_import.py", "skip folder on timeout"),
    ("daemon/sonarr_manual_import.py", "already has files"),
    ("daemon/wire-engines.parts/01.part", "skip FUSE relink"),
    ("daemon/wire-engines.parts/08.part", "skip hybrid 1080 grab"),
    ("daemon/wire-engines.parts/09.part", "first provision — library walk"),
    ("src/components/library-catchup-bar.tsx", "Library catching up"),
    ("src/components/applying-bar.tsx", "Applying"),
    ("scripts/reelos-ota-status.mjs", "applyProductRunning"),
    ("scripts/reelos-ota-status.mjs", "shouldSplashLock"),
    ("src/components/applying-bar.tsx", "Updating ReelOS"),
    ("src/components/splash.tsx", "Updating ReelOS"),
    ("src/components/splash.tsx", "/api/update/status"),
    ("src/components/splash.tsx", "stalled"),
    ("src/components/splash.tsx", "/api/hardware"),
    ("src/components/splash.tsx", "Update failed, still on previous"),
    ("src/components/settings-panels.tsx", "This is what I detected"),
    ("src/components/settings-panels.tsx", "/api/hardware"),
    ("src/components/settings-view.tsx", "HardwareDetectedCard"),
    ("scripts/reelos-lookup-plugin.mjs", "/api/hardware"),
    ("scripts/reelos-box-scale.mjs", "hardwareProfilePath"),
    ("install/udev/99-reelos-hw-probe.rules", "reelos-hw-probe.service"),
    ("install/systemd/reelos-hw-probe.service", "--ensure"),
    ("src/lib/library-catchup.ts", "catchupLocksHome"),
    ("src/lib/library-catchup.ts", "updateLocksUi"),
    ("src/components/gate.tsx", "updateLocksUi"),
    ("src/components/gate.tsx", "Splash updating"),
    ("src/components/gate.tsx", "Splash failed"),
    ("daemon/reelos-ota-clean.sh", "Never /media"),
    ("daemon/reelos-ota-clean.sh", "Never ota.lock"),
    ("daemon/reelos-ota-clean.sh", "OTA cleaner done"),
    ("daemon/reelos_os_tune.py", "crashkernel=no"),
    ("daemon/wire-engines.parts/09.part", "ota-clean bounded heal"),
    ("scripts/reelos-box.mjs", "killOrphan8080"),
    ("scripts/reelos-ota-status.mjs", "productSwapDone"),
    ("scripts/reelos-lookup-plugin.mjs", "libraryCatchup"),
    ("install/systemd/reelos-library-catchup.service", "TimeoutStartSec=infinity"),
    ("install/systemd/reelos-library-catchup.service", "MemoryMax"),
    ("daemon/reelos-library-catchup.sh", "do not remount if listed"),
    ("daemon/sonarr_manual_import.py", "import catch-up idle"),
    ("daemon/sonarr_manual_import.py", "ffprobe stubbed"),
    ("daemon/wire-engines.parts/00.part", "peel extra /mnt binds"),
    ("daemon/wire-engines.parts/07.part", "stub_container_ffprobe"),
    ("daemon/wire-engines.parts/01.part", "do not remount if listed"),
    ("daemon/reelos-update.sh", "ui_wants_beta"),
    ("daemon/reelos-update.sh", "beta channel from ui-settings.json"),
    ("daemon/reelos-update.sh", "leave beta for last stable"),
    ("daemon/reelos-update.sh", "channel-beta stub — keep looking"),
    ("scripts/reelos-lookup-plugin.mjs", "rollback"),
    ("scripts/reelos-lookup-plugin.mjs", "ui apply using local mailman"),
    ("scripts/reelos-lookup-plugin.mjs", "/api/update/progress"),
    ("scripts/reelos-ota-progress.mjs", "honestApplyProgress"),
    ("daemon/reelos-update.sh", "apply-progress.json"),
    ("daemon/reelos-update.sh", "Copying house settings"),
    ("daemon/reelos-update.sh", 'write_progress extract "${EX_BYTES:-1}" "${EX_BYTES:-1}" "Extracted"'),
    ("daemon/reelos_apply_progress.py", "byte_percent"),
    ("src/components/settings-updates.tsx", "Roll back"),
    ("compose/Caddyfile", "handle_errors"),
    ("compose/Caddyfile", "Updating ReelOS"),
    ("compose/Caddyfile", "respond `"),
    ("install/compose/Caddyfile", "handle_errors"),
    ("src/lib/library-catchup.ts", "catchupShowsBanner"),
    ("src/components/home-view.tsx", "catchupShowsBanner"),
    ("src/components/discover-view.tsx", "/discover/movies"),
    ("src/components/discover-view.tsx", "/discover/shows"),
    ("src/components/title-view-live.tsx", "resolved.jellyfinId"),
    ("scripts/reelos-seerr.mjs", "discoverBrowseSeerrPath"),
)


def fail(msg: str) -> int:
    print(msg, file=sys.stderr)
    return 1


def main() -> int:
    import json

    apply = "--apply" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--apply"]
    root = Path(args[0] if args else ".").resolve()
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
    if "1.2.51" in ver or ver.startswith("1.2.51"):
        return fail("1.2.51 is parked; do not stamp it")
    beta_tree = ver.startswith("2.") or "-beta" in ver
    if beta_tree:
        if ver != s or ver != l:
            return fail(f"VERSION skew VERSION={ver} shipped={s} latest={l}")
        if not str(chan).startswith("1.2.50."):
            return fail(f"stable channel.json must stay 1.2.50.x on a beta tree, got {chan}")
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
        sidecar = (root / "scripts/reelos-beta-sidecar.mjs").read_text() if (root / "scripts/reelos-beta-sidecar.mjs").is_file() else ""
        if "applyBetaSidecar" not in sidecar or "stopBooks" not in sidecar:
            return fail("beta tree must ship applyBetaSidecar/stopBooks")
        if "betaChannel: false" not in (root / "src/lib/store.ts").read_text():
            return fail("beta toggle must default off")
    elif ver != chan or ver != s or ver != l:
        return fail(f"VERSION skew VERSION={ver} channel={chan} shipped={s} latest={l}")

    beta_path = root / "channel-beta.json"
    if beta_path.is_file() and not beta_tree:
        beta_doc = json.loads(beta_path.read_text())
        bver = str(beta_doc.get("version") or "")
        tar = str(beta_doc.get("tarball") or "")
        if beta_doc.get("channel") != "beta":
            return fail("channel-beta.json must be channel=beta")
        if "main.tar.gz" in tar:
            return fail("sidecar channel-beta.json must not point at main.tar.gz")
        if not (bver.startswith("2.") or "-beta" in bver):
            return fail(f"sidecar channel-beta.json must be 2.x, got {bver}")
        if "beta-arena-books" not in tar:
            return fail("sidecar beta tarball must be the beta-arena-books branch")
        styles = (root / "src/styles.css").read_text() if (root / "src/styles.css").is_file() else ""
        if ".arena-page" in styles:
            store = (root / "src/lib/store.ts").read_text() if (root / "src/lib/store.ts").is_file() else ""
            sidecar = (root / "scripts/reelos-beta-sidecar.mjs").read_text() if (root / "scripts/reelos-beta-sidecar.mjs").is_file() else ""
            if "betaChannel: false" not in store:
                return fail("Arena CSS on a stable stamp requires betaChannel default off")
            if "applyBetaSidecar" not in sidecar or "stopBooks" not in sidecar:
                return fail("Arena CSS on a stable stamp requires in-tree applyBetaSidecar/stopBooks")
            if "idleOffBooksIfNeeded" not in sidecar:
                return fail("Arena CSS on a stable stamp requires idleOffBooksIfNeeded so toggle-off does not leave Kavita")

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
    catchup = updater.find("library catch-up in background", applied)
    if catchup < 0:
        return fail("OTA contract: library catch-up must come after applied.")
    if 'log "import after hops' in updater[:applied]:
        return fail("OTA contract: Apply must not await import after hops before applied")
    if 'if ! python3 "$ROOT/bin/wire-engines.py" indexers' in updater[:applied]:
        return fail("OTA contract: indexers must not block stamp")
    for line in updater[:applied].splitlines():
        s = line.strip()
        if s.startswith("#") or s.startswith("need "):
            continue
        if "wire-engines.py" not in s:
            continue
        if '-x "$ROOT/bin/wire-engines.py"' in s:
            continue
        if 'wire-engines.py" fuse' in s or 'wire-engines.py" no-ffprobe' in s:
            continue
        return fail(f"OTA contract: Apply path must not run library wire-engines before stamp: {s[:120]}")
    if 'REELOS_OTA=1' in updater[:applied] and 'python3 "$ROOT/bin/wire-engines.py"' in updater[:applied]:
        # Bare main() with REELOS_OTA still does indexers/ensure_fuse before stamp.
        bare = False
        for line in updater[:applied].splitlines():
            s = line.strip()
            if s.startswith("#"):
                continue
            if "REELOS_OTA=1" in s and "wire-engines.py" in s and "no-ffprobe" not in s and '" fuse' not in s:
                bare = True
                break
        if bare:
            return fail("OTA contract: REELOS_OTA wire-engines main() must not block stamp")
    catch_sh = root / "daemon/reelos-library-catchup.sh"
    install_catch = root / "install/bin/reelos-library-catchup.sh"
    if catch_sh.is_file() and install_catch.is_file() and catch_sh.read_text() != install_catch.read_text():
        return fail("OTA contract: install/bin/reelos-library-catchup.sh must match daemon/")
    hw = root / "daemon/reelos_hardware.py"
    install_hw = root / "install/bin/reelos_hardware.py"
    if hw.is_file() and install_hw.is_file() and hw.read_text() != install_hw.read_text():
        return fail("OTA contract: install/bin/reelos_hardware.py must match daemon/")
    heal = root / "daemon/reelos-selfheal.sh"
    install_heal = root / "install/bin/reelos-selfheal.sh"
    if heal.is_file() and install_heal.is_file() and heal.read_text() != install_heal.read_text():
        return fail("OTA contract: install/bin/reelos-selfheal.sh must match daemon/")
    unit = (root / "install/systemd/reelos-library-catchup.service").read_text()
    boot = (root / "firstboot/reelos-library-catchup.service").read_text() if (root / "firstboot/reelos-library-catchup.service").is_file() else ""
    if unit != boot:
        return fail("OTA contract: firstboot/reelos-library-catchup.service must match install/systemd/")

    install_up = root / "install/bin/reelos-update.sh"
    if install_up.is_file() and install_up.read_text() != updater:
        return fail("OTA contract: install/bin/reelos-update.sh must match daemon/")
    caddy = root / "compose/Caddyfile"
    install_caddy = root / "install/compose/Caddyfile"
    if caddy.is_file() and install_caddy.is_file() and caddy.read_text() != install_caddy.read_text():
        return fail("OTA contract: install/compose/Caddyfile must match compose/")
    if caddy.is_file() and "<<HTML" in caddy.read_text():
        return fail("OTA contract: compose/Caddyfile must not use Caddy 2.8 heredoc respond (Ubuntu is 2.6)")
    for rel_a, rel_b in (
        ("daemon/reelos-ota-clean.sh", "install/bin/reelos-ota-clean.sh"),
        ("daemon/reelos_ota_clean.py", "install/bin/reelos_ota_clean.py"),
        ("daemon/reelos_os_tune.py", "install/bin/reelos_os_tune.py"),
        ("daemon/reelos_apply_progress.py", "install/bin/reelos_apply_progress.py"),
    ):
        a, b = root / rel_a, root / rel_b
        if a.is_file() and b.is_file() and a.read_text() != b.read_text():
            return fail(f"OTA contract: {rel_b} must match {rel_a}")

    cleaner = updater.find("OTA cleaner — leftover nonsense")
    if cleaner < 0 or not (cleaner < applied):
        return fail("OTA contract: cleaner must run before applied.")
    tmp_clean = updater.find('reelos-ota-clean.sh" --tmp')
    if tmp_clean < 0 or tmp_clean < applied:
        return fail("OTA contract: tmp leftover cleaner must come after applied.")
    if "Home can open" in updater:
        return fail("OTA contract: mailman must not say Home can open during Apply")

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
