/** Background JF token, request recover, unstick searching-if-file-on-disk.
 *  No TorBox. No FUSE walk. No firstboot. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  arrHasFile,
  libraryHit,
  seerrApiKey,
  seerrFetch,
  seerrMediaGhostRows,
  seerrRequestRow,
} from "./reelos-seerr.mjs";
import {
  kickArrRecover,
  listRecoverTargets,
  loadPresenceFacts,
  planUnstickSearchingIfFileOnDisk,
  spawnWireImport,
} from "./reelos-request-status.mjs";
import { filterRemovedRequests, readRemovedTitleIds } from "./reelos-library-remove.mjs";

const STATE = "/var/lib/reelos";
const RECOVER_COOLDOWN_MS = 120_000;
const JF_AUTH =
  'MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos", Version="1.2.50"';

export function answersFromDisk() {
  try {
    return JSON.parse(readFileSync(join(STATE, "answers.json"), "utf8"));
  } catch {
    return {};
  }
}

export function isProvisioned() {
  return existsSync(join(STATE, "provisioned"));
}

function readStamp(name) {
  try {
    return Number(readFileSync(join(STATE, name), "utf8").trim()) || 0;
  } catch {
    return 0;
  }
}

function writeStamp(name) {
  try {
    mkdirSync(STATE, { recursive: true, mode: 0o700 });
    writeFileSync(join(STATE, name), `${Date.now()}\n`);
  } catch {
    /* */
  }
}

function cooled(name, ms) {
  return Date.now() - readStamp(name) < ms;
}

export async function probeJellyfinToken() {
  const a = answersFromDisk();
  const user = a.adminName || "reelos";
  const password = a.adminPassword || "reelos";
  try {
    const pub = await fetch("http://127.0.0.1:8096/System/Info/Public", {
      signal: AbortSignal.timeout(1500),
    });
    if (!pub.ok) return { ok: false, reason: "Jellyfin not on :8096" };
  } catch {
    return { ok: false, reason: "Jellyfin not on :8096" };
  }
  try {
    const r = await fetch("http://127.0.0.1:8096/Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: JF_AUTH,
        "X-Emby-Authorization": JF_AUTH,
      },
      body: JSON.stringify({ Username: user, Pw: password }),
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return { ok: false, reason: "Jellyfin has no matching user/PIN" };
    const j = await r.json();
    if (!j?.AccessToken) return { ok: false, reason: "Jellyfin token missing" };
    return { ok: true, reason: "Jellyfin token ok" };
  } catch {
    return { ok: false, reason: "Jellyfin token probe failed" };
  }
}

async function seerrRowsForRecover() {
  const key = seerrApiKey();
  if (!key) return [];
  let seerrRows = [];
  try {
    const r = await seerrFetch("/api/v1/request?take=100&filter=all&sort=added", { key, ms: 4000 });
    const rows = Array.isArray(r.json) ? r.json : r.json?.results || [];
    seerrRows = rows.map((row) => seerrRequestRow(row)).filter((rec) => rec?.titleId);
  } catch {
    seerrRows = [];
  }
  try {
    const media = await seerrFetch("/api/v1/media?take=100&filter=all&sort=added", { key, ms: 3000 });
    const mediaItems = Array.isArray(media.json) ? media.json : media.json?.results || [];
    seerrRows = [...seerrRows, ...seerrMediaGhostRows(mediaItems)];
  } catch {
    /* request rows still recover movie orphans */
  }
  return filterRemovedRequests(seerrRows, readRemovedTitleIds());
}

export async function recoverInFlightRequests() {
  if (cooled("selfheal-recover.at", RECOVER_COOLDOWN_MS)) {
    return { recover: true, skipped: "cooldown" };
  }
  writeStamp("selfheal-recover.at");
  const facts = await loadPresenceFacts();
  const seerrRows = await seerrRowsForRecover();
  const missing = listRecoverTargets({
    series: facts?.series,
    movies: facts?.movies,
    seerrRows,
  });
  let kicked = 0;
  for (const m of missing) {
    await kickArrRecover({ mediaType: m.mediaType, tmdb: m.tmdb, season: m.season });
    kicked += 1;
  }
  return { recover: true, kicked };
}

export async function unstickSearchingIfFileOnDisk() {
  if (cooled("selfheal-unstick.at", RECOVER_COOLDOWN_MS)) {
    return { unstick: true, skipped: "cooldown" };
  }
  const facts = await loadPresenceFacts();
  const seerrRows = await seerrRowsForRecover();
  let importWanted = false;
  let n = 0;
  for (const row of seerrRows) {
    const plan = planUnstickSearchingIfFileOnDisk({
      status: row.status,
      engine: row.engine,
      arrHasFile: arrHasFile(row, facts?.arrIndex),
      libraryHit: libraryHit(row, facts?.libraryTitles),
    });
    if (plan.action === "import") {
      n += 1;
      importWanted = true;
    }
  }
  writeStamp("selfheal-unstick.at");
  if (importWanted) spawnWireImport();
  return { unstick: true, import: importWanted, count: n };
}

export async function runSelfHeal() {
  const steps = [];
  if (!isProvisioned()) {
    return { ok: true, provisioned: false, steps: ["skip engines — not provisioned"] };
  }
  const jf = await probeJellyfinToken();
  steps.push(jf.ok ? "jf token ok" : `jf ${jf.reason}`);
  const recover = await recoverInFlightRequests();
  steps.push(
    recover.skipped
      ? `recover ${recover.skipped}`
      : `recover kicked ${recover.kicked || 0}`,
  );
  const unstick = await unstickSearchingIfFileOnDisk();
  steps.push(
    unstick.skipped
      ? `unstick ${unstick.skipped}`
      : unstick.import
        ? `unstick import ${unstick.count}`
        : "unstick idle",
  );
  return { ok: true, provisioned: true, jf: jf.ok, recover, unstick, steps };
}

function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(fileURLToPath(moduleUrl)).href === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (process.argv[1] && isMainModule(import.meta.url)) {
  runSelfHeal()
    .then((r) => {
      process.stdout.write(`${JSON.stringify(r)}\n`);
    })
    .catch((e) => {
      process.stderr.write(`${e}\n`);
      process.exitCode = 1;
    });
}
