/**
 * Discover curator prefs on this box (`curator.json`). Library is never filtered.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export function curatorStateDir(state = process.env.REELOS_STATE || "/var/lib/reelos") {
  return String(state || "/var/lib/reelos").replace(/\/$/, "") || "/var/lib/reelos";
}

export function curatorPath(state, profileId) {
  const dir = curatorStateDir(state);
  const id = String(profileId || "").replace(/[^a-zA-Z0-9._-]/g, "");
  return id ? `${dir}/curator-${id}.json` : `${dir}/curator.json`;
}

export function emptyCurator() {
  return { hidden: [], hiddenAt: {} };
}

export function curatorTitleKeys(title) {
  const keys = new Set();
  if (title == null) return keys;
  if (typeof title === "string" || typeof title === "number") {
    const s = String(title).trim();
    if (s) keys.add(s);
    return keys;
  }
  for (const x of [title.id, title.titleId, title.jellyfinId, ...(Array.isArray(title.ids) ? title.ids : [])]) {
    const s = String(x || "").trim();
    if (s) keys.add(s);
    if (s && !s.startsWith("jf-") && title.jellyfinId && s === String(title.jellyfinId)) keys.add(`jf-${s}`);
  }
  return keys;
}

export function normalizeCurator(raw) {
  const hidden = [];
  const hiddenAt = {};
  const seen = new Set();
  const src = Array.isArray(raw?.hidden) ? raw.hidden : [];
  const times = raw?.hiddenAt && typeof raw.hiddenAt === "object" ? raw.hiddenAt : {};
  for (const id of src) {
    const key = String(id || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    hidden.push(key);
    const at = Number(times[key]);
    hiddenAt[key] = Number.isFinite(at) && at > 0 ? at : Date.now();
  }
  return { hidden, hiddenAt };
}

export function readCurator(state, profileId) {
  try {
    return normalizeCurator(JSON.parse(readFileSync(curatorPath(state, profileId), "utf8")));
  } catch {
    return emptyCurator();
  }
}

export function writeCurator(doc, state, profileId) {
  const dir = curatorStateDir(state);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const next = normalizeCurator(doc);
  writeFileSync(curatorPath(state, profileId), JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  return next;
}

export function curatorHiddenSet(doc) {
  return new Set((doc?.hidden || []).map((id) => String(id)));
}

export function titleIsCuratorHidden(title, hidden) {
  const set = hidden instanceof Set ? hidden : curatorHiddenSet(hidden);
  if (!set.size) return false;
  for (const key of curatorTitleKeys(title)) if (set.has(key)) return true;
  return false;
}

export function filterCuratorHidden(titles, hidden) {
  const set = hidden instanceof Set ? hidden : curatorHiddenSet(hidden);
  if (!set.size) return Array.isArray(titles) ? titles : [];
  return (titles || []).filter((t) => !titleIsCuratorHidden(t, set));
}

/** Home / Library / /api/library must keep owned titles even if Discover hid them. */
export function filterLibraryTitles(titles) {
  return Array.isArray(titles) ? titles : [];
}

export function hideCuratorTitle(title, state, now = Date.now(), profileId) {
  const cur = readCurator(state, profileId);
  const keys = [...curatorTitleKeys(title)];
  if (!keys.length) return { ok: false, error: "Need a title id", ...cur };
  const seen = new Set(cur.hidden);
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    cur.hidden.push(key);
    cur.hiddenAt[key] = now;
  }
  const next = writeCurator(cur, state, profileId);
  return { ok: true, count: next.hidden.length, ...next };
}

export function resetCurator(state, profileId) {
  writeCurator(emptyCurator(), state, profileId);
  return { ok: true, ...emptyCurator(), count: 0 };
}

export function curatorPublic(doc = emptyCurator()) {
  const next = normalizeCurator(doc);
  return { ok: true, hidden: next.hidden, count: next.hidden.length };
}
