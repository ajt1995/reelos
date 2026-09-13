/**
 * Discover curator prefs on this box (`curator.json`).
 * Like boosts similar in Discover. Dislike hides from Discover.
 * Library / Home owned titles are never filtered.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export function curatorStateDir(state = process.env.REELOS_STATE || "/var/lib/reelos") {
  return String(state || "/var/lib/reelos").replace(/\/$/, "") || "/var/lib/reelos";
}

export function curatorPath(state) {
  return `${curatorStateDir(state)}/curator.json`;
}

export function emptyCurator() {
  return { hidden: [], hiddenAt: {}, liked: [], likedAt: {} };
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

function collectKeyedList(src, times, now) {
  const out = [];
  const at = {};
  const seen = new Set();
  const list = Array.isArray(src) ? src : [];
  const stamps = times && typeof times === "object" ? times : {};
  for (const id of list) {
    const key = String(id || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    const n = Number(stamps[key]);
    at[key] = Number.isFinite(n) && n > 0 ? n : now;
  }
  return { list: out, at };
}

export function normalizeCurator(raw) {
  const now = Date.now();
  const hidden = collectKeyedList(raw?.hidden, raw?.hiddenAt, now);
  const liked = collectKeyedList(raw?.liked, raw?.likedAt, now);
  return {
    hidden: hidden.list,
    hiddenAt: hidden.at,
    liked: liked.list,
    likedAt: liked.at,
  };
}

export function readCurator(state) {
  try {
    return normalizeCurator(JSON.parse(readFileSync(curatorPath(state), "utf8")));
  } catch {
    return emptyCurator();
  }
}

export function writeCurator(doc, state) {
  const dir = curatorStateDir(state);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const next = normalizeCurator(doc);
  writeFileSync(curatorPath(state), JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  return next;
}

export function curatorHiddenSet(doc) {
  return new Set((doc?.hidden || []).map((id) => String(id)));
}

export function curatorLikedSet(doc) {
  return new Set((doc?.liked || []).map((id) => String(id)));
}

export function titleIsCuratorHidden(title, hidden) {
  const set = hidden instanceof Set ? hidden : curatorHiddenSet(hidden);
  if (!set.size) return false;
  for (const key of curatorTitleKeys(title)) if (set.has(key)) return true;
  return false;
}

export function titleIsCuratorLiked(title, liked) {
  const set = liked instanceof Set ? liked : curatorLikedSet(liked);
  if (!set.size) return false;
  for (const key of curatorTitleKeys(title)) if (set.has(key)) return true;
  return false;
}

export function filterCuratorHidden(titles, hidden) {
  const set = hidden instanceof Set ? hidden : curatorHiddenSet(hidden);
  if (!set.size) return Array.isArray(titles) ? titles : [];
  return (titles || []).filter((t) => !titleIsCuratorHidden(t, set));
}

/** Home / Library / /api/library must keep owned titles even if Discover hid or liked them. */
export function filterLibraryTitles(titles) {
  return Array.isArray(titles) ? titles : [];
}

function dropKeys(list, at, keys) {
  const drop = new Set(keys);
  const next = [];
  const nextAt = {};
  for (const id of list) {
    if (drop.has(id)) continue;
    next.push(id);
    if (at[id]) nextAt[id] = at[id];
  }
  return { list: next, at: nextAt };
}

function addKeys(list, at, keys, now) {
  const seen = new Set(list);
  const next = [...list];
  const nextAt = { ...at };
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(key);
    nextAt[key] = now;
  }
  return { list: next, at: nextAt };
}

export function recentLikedIds(doc, limit = 4) {
  const liked = Array.isArray(doc?.liked) ? doc.liked : [];
  const at = doc?.likedAt && typeof doc.likedAt === "object" ? doc.likedAt : {};
  return [...liked]
    .sort((a, b) => Number(at[b] || 0) - Number(at[a] || 0))
    .slice(0, Math.max(0, limit));
}

export function titleMatchesCuratorKeys(title, ids) {
  const set = ids instanceof Set ? ids : new Set([...(ids || [])].map(String));
  if (!set.size) return false;
  for (const key of curatorTitleKeys(title)) if (set.has(key)) return true;
  return false;
}

export function rankDiscoverByLikes(titles, boostIds) {
  const set = boostIds instanceof Set ? boostIds : new Set([...(boostIds || [])].map(String));
  if (!set.size) return Array.isArray(titles) ? titles : [];
  const boosted = [];
  const rest = [];
  for (const t of titles || []) {
    if (titleMatchesCuratorKeys(t, set)) boosted.push(t);
    else rest.push(t);
  }
  return [...boosted, ...rest];
}

export function mergeLikedSimilar(discoverTitles, similarTitles, { limit = 16, excludeHidden } = {}) {
  const seen = new Set();
  const out = [];
  for (const t of [...(similarTitles || []), ...(discoverTitles || [])]) {
    if (!t?.id || seen.has(t.id)) continue;
    if (excludeHidden && titleIsCuratorHidden(t, excludeHidden)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

export function voteCuratorTitle(title, vote, state, now = Date.now()) {
  const keys = [...curatorTitleKeys(title)];
  if (!keys.length) return { ok: false, error: "Need a title id", ...emptyCurator() };
  const want = String(vote || "dislike").toLowerCase();
  if (!["like", "dislike", "none", "clear"].includes(want)) {
    return { ok: false, error: "vote must be like, dislike, or none", ...readCurator(state) };
  }
  const cur = readCurator(state);
  let hidden = { list: cur.hidden, at: cur.hiddenAt };
  let liked = { list: cur.liked, at: cur.likedAt };
  if (want === "like") {
    hidden = dropKeys(hidden.list, hidden.at, keys);
    liked = addKeys(liked.list, liked.at, keys, now);
  } else if (want === "dislike") {
    liked = dropKeys(liked.list, liked.at, keys);
    hidden = addKeys(hidden.list, hidden.at, keys, now);
  } else {
    hidden = dropKeys(hidden.list, hidden.at, keys);
    liked = dropKeys(liked.list, liked.at, keys);
  }
  const next = writeCurator(
    { hidden: hidden.list, hiddenAt: hidden.at, liked: liked.list, likedAt: liked.at },
    state,
  );
  return { ok: true, ...next };
}

export function hideCuratorTitle(title, state, now = Date.now()) {
  return voteCuratorTitle(title, "dislike", state, now);
}

export function likeCuratorTitle(title, state, now = Date.now()) {
  return voteCuratorTitle(title, "like", state, now);
}

export function resetCurator(state) {
  writeCurator(emptyCurator(), state);
  return { ok: true, ...emptyCurator(), count: 0 };
}

export function curatorPublic(doc = emptyCurator()) {
  const next = normalizeCurator(doc);
  return {
    ok: true,
    hidden: next.hidden,
    liked: next.liked,
    count: next.hidden.length + next.liked.length,
    hiddenCount: next.hidden.length,
    likedCount: next.liked.length,
  };
}
