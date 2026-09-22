#!/usr/bin/env python3
"""Push-time gate. If this fails, do not push and do not tell the house to Apply.

Never print 'applied' unless :80 is ReelOS. Never start a second Apply.
Never leave Caddy dead after FUSE/engine restarts.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Core OS and Updater Integrity Invariants (prevents bricking during OTA updates)
CONTRACTS = (
    ("daemon/reelos-update.sh", "apply already running"),
    ("daemon/reelos-update.sh", "ensure_door"),
    ("daemon/reelos-update.sh", "not printing applied"),
    ("daemon/reelos-update.sh", "door :80 is ReelOS"),
    ("daemon/reelos-update.sh", "staging missing package.json"),
    ("daemon/reelos-update.sh", "npm ci failed — not swapping"),
    ("daemon/reelos-update.sh", "overlay house compose/configs onto staging"),
    ("daemon/reelos-update.sh", "ROOT.prev/docker-compose.yml"),
    ("daemon/reelos-update.sh", "compose recreated — remount FUSE before hops"),
    ("daemon/reelos-update.sh", "clear stale FUSE before compose up"),
    ("daemon/reelos-update.sh", "prebuilt client staged"),
    ("compose/Caddyfile", "handle_errors"),
    ("install/compose/Caddyfile", "handle_errors"),
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
    beta_tree = "-beta" in ver
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

    updater = (root / "daemon/reelos-update.sh").read_text(encoding="utf-8", errors="replace")
    for rel, needle in CONTRACTS:
        target = root / rel
        textc = target.read_text(encoding="utf-8", errors="replace") if target.is_file() else ""
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
    if catch_sh.is_file() and install_catch.is_file() and catch_sh.read_bytes() != install_catch.read_bytes():
        return fail("OTA contract: install/bin/reelos-library-catchup.sh must match daemon/")
    hw = root / "daemon/reelos_hardware.py"
    install_hw = root / "install/bin/reelos_hardware.py"
    if hw.is_file() and install_hw.is_file() and hw.read_bytes() != install_hw.read_bytes():
        return fail("OTA contract: install/bin/reelos_hardware.py must match daemon/")
    heal = root / "daemon/reelos-selfheal.sh"
    install_heal = root / "install/bin/reelos-selfheal.sh"
    if heal.is_file() and install_heal.is_file() and heal.read_bytes() != install_heal.read_bytes():
        return fail("OTA contract: install/bin/reelos-selfheal.sh must match daemon/")
    unit = (root / "install/systemd/reelos-library-catchup.service").read_text(encoding="utf-8", errors="replace")
    boot = (root / "firstboot/reelos-library-catchup.service").read_text(encoding="utf-8", errors="replace") if (root / "firstboot/reelos-library-catchup.service").is_file() else ""
    if unit != boot:
        return fail("OTA contract: firstboot/reelos-library-catchup.service must match install/systemd/")

    install_up = root / "install/bin/reelos-update.sh"
    if install_up.is_file() and install_up.read_bytes() != (root / "daemon/reelos-update.sh").read_bytes():
        return fail("OTA contract: install/bin/reelos-update.sh must match daemon/")
    caddy = root / "compose/Caddyfile"
    install_caddy = root / "install/compose/Caddyfile"
    if caddy.is_file() and install_caddy.is_file() and caddy.read_bytes() != install_caddy.read_bytes():
        return fail("OTA contract: install/compose/Caddyfile must match compose/")
    if caddy.is_file() and "<<HTML" in caddy.read_text(encoding="utf-8", errors="replace"):
        return fail("OTA contract: compose/Caddyfile must not use Caddy 2.8 heredoc respond (Ubuntu is 2.6)")
    for rel_a, rel_b in (
        ("daemon/reelos-ota-clean.sh", "install/bin/reelos-ota-clean.sh"),
        ("daemon/reelos_ota_clean.py", "install/bin/reelos_ota_clean.py"),
        ("daemon/reelos_os_tune.py", "install/bin/reelos_os_tune.py"),
        ("daemon/reelos_apply_progress.py", "install/bin/reelos_apply_progress.py"),
        ("daemon/reelos-heartbeat.sh", "install/bin/reelos-heartbeat.sh"),
        ("daemon/reelos-bios-tune.sh", "install/bin/reelos-bios-tune.sh"),
    ):
        a, b = root / rel_a, root / rel_b
        if a.is_file() and b.is_file() and a.read_bytes() != b.read_bytes():
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
        textc = f.read_text(encoding="utf-8", errors="replace")
        if path.endswith("wire-engines.py"):
            parts_dir = f.parent / "wire-engines.parts"
            if parts_dir.is_dir():
                textc += "".join(p.read_text(encoding="utf-8", errors="replace") for p in sorted(parts_dir.glob("*.part")))
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
