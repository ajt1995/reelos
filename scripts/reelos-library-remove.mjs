/** Remove a title from the phone library without wiping /media or Decypharr FUSE. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseTitleId } from "./reelos-seerr.mjs";

export const LIBRARY_REMOVED_FILE = "/var/lib/reelos/library-removed.json";

export function dumpViewPath(path) {
  const p = String(path || "").replace(/\/+$/, "");
  return p === "/symlinks" || p === "/mnt/symlinks" || p.startsWith("/symlinks/") || p.startsWith("/mnt/symlinks/");
}

export function localDiskPath(path) {
  const p = String(path || "").replace(/\/+$/, "");
  return p === "/media" || p.startsWith("/media/") || p === "/srv/media" || p.startsWith("/srv/media/");
}

/** Whole FUSE/debrid trees — never pass these to *arr deleteFiles or Jellyfin DELETE /Items. */
export function fuseWholesalePath(path) {
  const p = String(path || "").replace(/\/+$/, "");
  if (!p) return false;
  const parts = p.split("/").filter(Boolean);
  if (p === "/mnt/debrid" || p === "/mnt/symlinks" || p === "/symlinks") return true;
  if (parts.includes("__all__")) return true;
  if (parts.length <= 2 && parts[0] === "mnt" && (parts[1] === "debrid" || parts[1] === "symlinks")) return true;
  if (parts.length === 3 && parts[0] === "mnt" && parts[1] === "symlinks" && (parts[2] === "radarr" || parts[2] === "sonarr")) {
    return true;
  }
  if (parts.length === 2 && parts[0] === "symlinks" && (parts[1] === "radarr" || parts[1] === "sonarr")) return true;
  return false;
}

/** A single title folder under radarr/sonarr dumps (or *arr container /movies /tv). Not a root. */
export function arrTitleFolderPath(path) {
  const p = String(path || "").replace(/\/+$/, "");
  if (!p || localDiskPath(p) || fuseWholesalePath(p)) return false;
  const parts = p.split("/").filter(Boolean);
  if (parts[0] === "symlinks" && (parts[1] === "radarr" || parts[1] === "sonarr") && parts.length >= 3) return true;
  if (parts[0] === "mnt" && parts[1] === "symlinks" && (parts[2] === "radarr" || parts[2] === "sonarr") && parts.length >= 4) {
    return true;
  }
  if ((parts[0] === "movies" || parts[0] === "tv") && parts.length >= 2) return true;
  return false;
}

export function deleteFilesAllowed(path) {
  return arrTitleFolderPath(path);
}

export function jellyfinItemDeleteAllowed(path) {
  return arrTitleFolderPath(path);
}

export function libraryDropKeys(titleId, extra = []) {
  const keys = new Set();
  const add = (raw) => {
    const s = String(raw || "").trim();
    if (s) keys.add(s);
  };
  add(titleId);
  for (const id of extra || []) add(id);
  const parsed = parseTitleId(titleId);
  if (parsed?.tmdb && parsed.mediaType === "tv") add(`tmdb-${parsed.tmdb}`);
  if (parsed?.tmdb && parsed.mediaType === "movie") add(`tmdb-tv-${parsed.tmdb}`);
  if (parsed?.tvdb) add(`tvdb-${parsed.tvdb}`);
  if (String(titleId).startsWith("jf-")) add(String(titleId).slice(3));
  return [...keys];
}

export function titleInDropSet(t, keys) {
  const set = keys instanceof Set ? keys : new Set(keys || []);
  const ids = [t?.id, ...(Array.isArray(t?.ids) ? t.ids : []), t?.jellyfinId, t?.jellyfinId ? `jf-${t.jellyfinId}` : ""];
  return ids.some((id) => id && set.has(String(id)));
}

export function isHashDumpRemoveTarget(titleId, extraIds = []) {
  const ids = [titleId, ...(extraIds || [])].map(String);
  const hasHash = ids.some((id) => /^[0-9a-f]{32,64}$/i.test(id) || /^jf-[0-9a-f]{32,64}$/i.test(id));
  const hasCatalog = ids.some((id) => /^(tmdb-|tvdb-)/.test(id));
  return hasHash && !hasCatalog;
}

export function expandDropKeys({ titleId, extraIds = [], shelf = [] } = {}) {
  const keys = new Set(libraryDropKeys(titleId, extraIds));
  const hashOnly = isHashDumpRemoveTarget(titleId, extraIds);
  for (const t of shelf || []) {
    if (!titleInDropSet(t, keys)) continue;
    for (const k of libraryDropKeys(t.id, t.ids || [])) {
      if (hashOnly && /^(tmdb-|tvdb-)/.test(String(k))) continue;
      if (hashOnly && !/^(jf-)?[0-9a-f]{32,64}$/i.test(String(k)) && !String(k).startsWith("jf-")) continue;
      keys.add(k);
    }
    if (t.jellyfinId && !hashOnly) {
      keys.add(String(t.jellyfinId));
      keys.add(`jf-${t.jellyfinId}`);
    } else if (t.jellyfinId && hashOnly) {
      const jf = String(t.jellyfinId);
      if ([titleId, ...(extraIds || [])].some((id) => String(id) === jf || String(id) === `jf-${jf}`)) {
        keys.add(jf);
        keys.add(`jf-${jf}`);
      }
    }
  }
  return keys;
}

/** Drop a title from ReelOS shelf / library ids / request overlay. TV drops every season row. */
export function dropLibraryOverlay({ shelf = [], library = [], requests = [], titleId, extraIds = [] } = {}) {
  const keys = expandDropKeys({ titleId, extraIds, shelf });
  const requestGone = (r) => {
    if (!r?.titleId) return false;
    if (keys.has(r.titleId)) return true;
    return libraryDropKeys(r.titleId).some((k) => keys.has(k));
  };
  return {
    shelf: (shelf || []).filter((t) => !titleInDropSet(t, keys)),
    library: (library || []).filter((id) => !keys.has(String(id))),
    requests: (requests || []).filter((r) => !requestGone(r)),
    keys: [...keys],
  };
}

export function applyRemovedTitles(titles, removedIds) {
  const keys = new Set(removedIds || []);
  if (!keys.size) return titles || [];
  return (titles || []).filter((t) => !titleInDropSet(t, keys));
}

/** Recover must not re-add a title the phone already Removed. */
export function filterRemovedRequests(rows, removedIds) {
  const keys = new Set((removedIds || []).map((id) => String(id)).filter(Boolean));
  if (!keys.size) return rows || [];
  return (rows || []).filter((r) => {
    if (!r?.titleId) return true;
    if (keys.has(String(r.titleId))) return false;
    return !libraryDropKeys(r.titleId).some((k) => keys.has(k));
  });
}

export function mergeRemovedIds(prev, next) {
  return [...new Set([...(prev || []), ...(next || [])].map((id) => String(id).trim()).filter(Boolean))];
}

export function forgetRemovedIds(prev, dropKeys) {
  const keys = new Set(dropKeys || []);
  return (prev || []).filter((id) => !keys.has(String(id)));
}

/** Live JF rows that a failed Remove still hides — forget those keys so On this box matches Jellyfin. */
export function removedIdsStillOnShelf(titles, removedIds) {
  const hide = new Set((removedIds || []).map((id) => String(id)).filter(Boolean));
  if (!hide.size) return [];
  const still = [];
  for (const t of titles || []) {
    if (!titleInDropSet(t, hide)) continue;
    still.push(...libraryDropKeys(t.id, [...(t.ids || []), t.jellyfinId, t.jellyfinId ? `jf-${t.jellyfinId}` : ""]));
  }
  return [...new Set(still.filter(Boolean))];
}

export function forgetRemovedKeys(keys, { file = LIBRARY_REMOVED_FILE, read, write } = {}) {
  const prev = readRemovedTitleIds(file, read ? { readFileSync: read.readFileSync, existsSync: read.existsSync } : {});
  const ids = forgetRemovedIds(prev, keys);
  writeRemovedTitleIds(ids, file, write);
  return ids;
}

export function readRemovedTitleIds(file = LIBRARY_REMOVED_FILE, { readFileSync: read = readFileSync, existsSync: exists = existsSync } = {}) {
  try {
    if (!exists(file)) return [];
    const j = JSON.parse(read(file, "utf8"));
    return Array.isArray(j?.ids) ? j.ids.map((id) => String(id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeRemovedTitleIds(
  ids,
  file = LIBRARY_REMOVED_FILE,
  { mkdirSync: mkdir = mkdirSync, writeFileSync: write = writeFileSync } = {},
) {
  mkdir(dirname(file), { recursive: true });
  write(file, JSON.stringify({ ids: [...new Set((ids || []).map((id) => String(id)).filter(Boolean))] }) + "\n");
}

export function rememberRemovedTitleIds(keys, { file = LIBRARY_REMOVED_FILE, read, write } = {}) {
  const prev = readRemovedTitleIds(file, read ? { readFileSync: read.readFileSync, existsSync: read.existsSync } : {});
  const ids = mergeRemovedIds(prev, keys);
  writeRemovedTitleIds(ids, file, write);
  return ids;
}

export function forgetRemovedTitleIds(titleId, extraIds = [], { file = LIBRARY_REMOVED_FILE, read, write } = {}) {
  const keys = libraryDropKeys(titleId, extraIds);
  const prev = readRemovedTitleIds(file, read ? { readFileSync: read.readFileSync, existsSync: read.existsSync } : {});
  const ids = forgetRemovedIds(prev, keys);
  writeRemovedTitleIds(ids, file, write);
  return ids;
}

export function planSeerrDeletes(detail) {
  const media = detail?.mediaInfo || detail?.media || (detail?.id && detail.mediaType ? detail : null) || {};
  const mediaId = media?.id ?? detail?.id;
  const reqs = Array.isArray(media?.requests)
    ? media.requests
    : Array.isArray(detail?.requests)
      ? detail.requests
      : [];
  const requestIds = [];
  for (const r of reqs) {
    const id = r?.id;
    if (id == null || id === "") continue;
    const n = Number(String(id).replace(/^seerr-/, ""));
    if (Number.isFinite(n) && n > 0) requestIds.push(n);
    else requestIds.push(id);
  }
  return {
    mediaId: mediaId != null && mediaId !== "" ? mediaId : null,
    requestIds,
    requestPaths: requestIds.map((id) => `/api/v1/request/${id}`),
    mediaPath: mediaId != null && mediaId !== "" ? `/api/v1/media/${mediaId}` : null,
  };
}

export function matchArrItem(items, { mediaType, tmdb, tvdb } = {}) {
  const rows = Array.isArray(items) ? items : [];
  if (mediaType === "movie") {
    return rows.find((m) => tmdb != null && String(m?.tmdbId) === String(tmdb)) || null;
  }
  return (
    rows.find(
      (s) =>
        (tmdb != null && String(s?.tmdbId) === String(tmdb)) ||
        (tvdb != null && String(s?.tvdbId) === String(tvdb)),
    ) || null
  );
}

export function arrItemPath(item) {
  return String(item?.path || item?.folderPath || item?.Path || "").trim();
}

export function unmonitorArrBody(item, mediaType) {
  if (!item || typeof item !== "object") return null;
  if (mediaType === "tv" || mediaType === "anime") {
    const seasons = Array.isArray(item.seasons)
      ? item.seasons.map((s) => ({ ...s, monitored: false }))
      : item.seasons;
    return { ...item, monitored: false, seasons };
  }
  return { ...item, monitored: false };
}

export function planArrDeleteUrl({ mediaType, id, deleteFiles = false } = {}) {
  if (id == null || id === "") return null;
  const flag = deleteFiles ? "true" : "false";
  if (mediaType === "movie") {
    return `http://127.0.0.1:7878/api/v3/movie/${id}?deleteFiles=${flag}&addImportExclusion=false`;
  }
  return `http://127.0.0.1:8989/api/v3/series/${id}?deleteFiles=${flag}`;
}

export function planArrUnmonitorUrl({ mediaType, id } = {}) {
  if (id == null || id === "") return null;
  if (mediaType === "movie") return `http://127.0.0.1:7878/api/v3/movie/${id}`;
  return `http://127.0.0.1:8989/api/v3/series/${id}`;
}

export function idsFromTitleLike(title) {
  const extra = [...(Array.isArray(title?.ids) ? title.ids : [])];
  if (title?.jellyfinId) extra.push(String(title.jellyfinId), `jf-${title.jellyfinId}`);
  return extra;
}

export function resolveRemoveTarget({ titleId, jellyfinId, tmdb, tvdb, mediaType, ids = [], shelf = [] } = {}) {
  const extra = [...ids, ...(jellyfinId ? [String(jellyfinId), `jf-${jellyfinId}`] : [])];
  const keys = expandDropKeys({ titleId, extraIds: extra, shelf });
  const hit = (shelf || []).find((t) => titleInDropSet(t, keys));
  const parsed = parseTitleId(titleId) || parseTitleId(hit?.id);
  let type = mediaType === "tv" || mediaType === "anime" || parsed?.mediaType === "tv" || hit?.kind === "tv" || hit?.kind === "anime"
    ? "tv"
    : mediaType === "movie" || parsed?.mediaType === "movie" || hit?.kind === "movie"
      ? "movie"
      : parsed?.mediaType || null;
  if (!type && (parsed?.tvdb || String(titleId || "").startsWith("tvdb-") || String(titleId || "").startsWith("tmdb-tv-"))) {
    type = "tv";
  }
  const hashOnly = isHashDumpRemoveTarget(titleId, extra);
  const tmdbOut = hashOnly
    ? null
    : tmdb || parsed?.tmdb || (hit?.ids || []).map((id) => {
        const s = String(id);
        if (s.startsWith("tmdb-tv-")) return s.slice(8);
        if (s.startsWith("tmdb-")) return s.slice(5);
        return "";
      }).find(Boolean);
  const tvdbOut = hashOnly
    ? null
    : tvdb || parsed?.tvdb || (hit?.ids || []).map((id) => {
        const s = String(id);
        return s.startsWith("tvdb-") ? s.slice(5) : "";
      }).find(Boolean);
  return {
    titleId: titleId || hit?.id || null,
    mediaType: type,
    tmdb: tmdbOut || null,
    tvdb: tvdbOut || null,
    jellyfinId: jellyfinId || hit?.jellyfinId || null,
    extraIds: [...keys],
    hit: hit || null,
  };
}

export function dropCacheTitles(titles, keys) {
  const set = keys instanceof Set ? keys : new Set(keys || []);
  return (titles || []).filter((t) => !titleInDropSet(t, set));
}

/**
 * Orchestrate Seerr request/media DELETE, *arr unmonitor+DELETE, optional Jellyfin item DELETE.
 * Never deleteFiles on /media or FUSE roots. Test-env: inject fetchers, no house keys.
 */
export async function removeLibraryTitle({
  titleId,
  jellyfinId,
  tmdb,
  tvdb,
  mediaType,
  ids,
  confirm,
  shelf = [],
  seerrKey,
  seerrFetch,
  fetchArr,
  radarrKey,
  sonarrKey,
  jellyfinGetItem,
  jellyfinDeleteItem,
  onRemovedIds,
} = {}) {
  if (!confirm) return { ok: false, error: "Confirm remove" };
  const target = resolveRemoveTarget({ titleId, jellyfinId, tmdb, tvdb, mediaType, ids, shelf });
  if (!target.titleId) return { ok: false, error: "No title" };
  const steps = { seerr: [], arr: null, jellyfin: null, deleteFiles: false, media: target.mediaType };

  if (seerrKey && typeof seerrFetch === "function" && target.tmdb && target.mediaType) {
    const path = target.mediaType === "tv" ? `/api/v1/tv/${target.tmdb}` : `/api/v1/movie/${target.tmdb}`;
    try {
      const detail = await seerrFetch(path, { key: seerrKey, ms: 15000 });
      const plan = planSeerrDeletes(detail?.json || detail);
      for (const reqPath of plan.requestPaths) {
        await seerrFetch(reqPath, { key: seerrKey, method: "DELETE", ms: 15000 });
        steps.seerr.push(reqPath);
      }
      if (plan.mediaPath) {
        await seerrFetch(plan.mediaPath, { key: seerrKey, method: "DELETE", ms: 15000 });
        steps.seerr.push(plan.mediaPath);
      }
    } catch {
      /* Seerr down — still try *arr / overlay */
    }
  }

  if (typeof fetchArr === "function" && (target.mediaType === "movie" || target.mediaType === "tv")) {
    const movie = target.mediaType === "movie";
    const key = movie ? radarrKey : sonarrKey;
    const listUrl = movie ? "http://127.0.0.1:7878/api/v3/movie" : "http://127.0.0.1:8989/api/v3/series";
    if (key) {
      try {
        const rows = await fetchArr(listUrl, key, 8000);
        const hit = matchArrItem(rows, target);
        if (hit?.id) {
          const path = arrItemPath(hit);
          const files = deleteFilesAllowed(path);
          steps.deleteFiles = files;
          const body = unmonitorArrBody(hit, target.mediaType);
          const putUrl = planArrUnmonitorUrl({ mediaType: target.mediaType, id: hit.id });
          if (putUrl && body) {
            await fetchArr(putUrl, key, 12000, { method: "PUT", body });
          }
          const delUrl = planArrDeleteUrl({ mediaType: target.mediaType, id: hit.id, deleteFiles: files });
          if (delUrl) {
            await fetchArr(delUrl, key, 15000, { method: "DELETE" });
            steps.arr = { id: hit.id, deleteFiles: files, path };
          }
        } else {
          steps.arr = { missing: true };
        }
      } catch {
        steps.arr = { error: true };
      }
    }
  }

  const jfId = target.jellyfinId;
  if (jfId && typeof jellyfinGetItem === "function") {
    try {
      const item = await jellyfinGetItem(jfId);
      const path = arrItemPath(item) || String(item?.Path || "");
      if (jellyfinItemDeleteAllowed(path) && typeof jellyfinDeleteItem === "function") {
        await jellyfinDeleteItem(jfId, path);
        steps.jellyfin = { id: jfId, deleted: true, path };
      } else {
        steps.jellyfin = { id: jfId, deleted: false, path, reason: localDiskPath(path) || fuseWholesalePath(path) ? "refused path" : "not a title dump folder" };
      }
    } catch {
      steps.jellyfin = { id: jfId, error: true };
    }
  }

  const overlay = dropLibraryOverlay({
    shelf,
    library: (shelf || []).map((t) => t.id),
    requests: [],
    titleId: target.titleId,
    extraIds: target.extraIds,
  });
  if (typeof onRemovedIds === "function") onRemovedIds(overlay.keys);

  return {
    ok: true,
    titleId: target.titleId,
    mediaType: target.mediaType,
    keys: overlay.keys,
    steps,
  };
}
