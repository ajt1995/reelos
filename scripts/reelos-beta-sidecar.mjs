/**
 * Runtime Arena+Books sidecar. Default off = stable movies/TV.
 * Toggle lives in /var/lib/reelos/ui-settings.json as betaChannel (same #122 key).
 * Leaves the movie/TV library under /media. Does not need a second OTA to roll back.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export const BETA_FLAG = "/var/lib/reelos/beta-arena-books";
export const BOOKS_MEDIA = "/srv/media/books";
export const KAVITA_IMAGE = "lscr.io/linuxserver/kavita:latest";

export function uiSettingsPath() {
  return process.env.REELOS_UI_SETTINGS || "/var/lib/reelos/ui-settings.json";
}

export function readUiSettings() {
  try {
    return JSON.parse(readFileSync(uiSettingsPath(), "utf8"));
  } catch {
    return { betaChannel: false };
  }
}

export function betaEnabled() {
  return readUiSettings().betaChannel === true;
}

export function composeDir() {
  const root = process.env.REELOS_ROOT || "/opt/reelos";
  if (existsSync(join(root, "compose/docker-compose.yml"))) return join(root, "compose");
  if (existsSync("/workspace/compose/docker-compose.yml")) return "/workspace/compose";
  if (existsSync("/workspace/install/compose/docker-compose.yml")) return "/workspace/install/compose";
  return join(root, "compose");
}

function docker(args, opts = {}) {
  const cwd = opts.cwd || composeDir();
  const timeout = opts.timeout ?? 45000;
  const run = (bin, rest) =>
    spawnSync(bin, rest, { cwd, encoding: "utf8", timeout, env: { ...process.env, ...(opts.env || {}) } });
  let r = run("docker", args);
  const err = `${r.stderr || ""}${r.stdout || ""}`;
  if (r.error || r.status !== 0) {
    if (/permission denied|Cannot connect/i.test(err) || r.error?.code === "EACCES") {
      r = run("sudo", ["-n", "docker", ...args]);
    }
  }
  return r;
}

function kavitaConfigDir() {
  return join(composeDir(), "configs/kavita");
}

export function startBooks() {
  const notes = [];
  try {
    mkdirSync(BOOKS_MEDIA, { recursive: true });
    notes.push(`mkdir ${BOOKS_MEDIA}`);
  } catch (e) {
    notes.push(`mkdir books: ${e}`);
  }
  try {
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync(BETA_FLAG, "1\n");
  } catch {
    /* Vite may not be root */
  }
  const up = docker(["compose", "--profile", "books", "up", "-d", "kavita"], { timeout: 90000 });
  notes.push(
    up.status === 0
      ? "kavita up"
      : `kavita up skipped: ${(up.stderr || up.stdout || up.error || "docker unavailable").toString().slice(0, 180)}`,
  );
  return { ok: true, started: true, notes };
}

/**
 * Stop books/arena extras. Leaves movies/TV/Request/Watch/Jellyfin/TorBox/wizard.
 * Drops Kavita config indexes we created. Keeps user sideloads in /srv/media/books.
 */
export function stopBooks() {
  const notes = [];
  const stop = docker(["compose", "--profile", "books", "stop", "kavita"], { timeout: 25000 });
  notes.push(stop.status === 0 ? "kavita stopped" : "kavita stop skipped");
  const rm = docker(["compose", "--profile", "books", "rm", "-f", "kavita"], { timeout: 25000 });
  notes.push(rm.status === 0 ? "kavita container removed" : "kavita rm skipped");
  docker(["rm", "-f", "kavita"], { timeout: 15000 });

  const cfg = kavitaConfigDir();
  if (existsSync(cfg)) {
    try {
      for (const name of readdirSync(cfg)) {
        if (name === ".gitkeep") continue;
        rmSync(join(cfg, name), { recursive: true, force: true });
        notes.push(`dropped kavita index ${name}`);
      }
    } catch (e) {
      notes.push(`kavita config: ${e}`);
    }
  }
  try {
    rmSync(BETA_FLAG, { force: true });
  } catch {
    /* */
  }
  return { ok: true, started: false, notes, leftovers: leftoverList() };
}

export function applyBetaSidecar(on) {
  return on ? startBooks() : stopBooks();
}

/** Door boot: if the toggle is off, do not leave Kavita eating RAM. */
export function idleOffBooksIfNeeded() {
  if (betaEnabled()) return { skipped: true, reason: "beta on" };
  return stopBooks();
}

export function leftoverList() {
  return [
    "Kavita image lscr.io/linuxserver/kavita (optional docker rmi — OTA cleaner can sweep)",
    "User sideloads in /srv/media/books (kept; not the movie/TV library)",
    "Caddy handle /kavita* (502s when Kavita is stopped; harmless)",
    "compose/configs/kavita/.gitkeep (empty dir)",
    "/var/lib/reelos/beta-arena-books flag (removed on toggle-off)",
  ];
}
