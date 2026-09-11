import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  applyRemovedTitles,
  arrItemPath,
  arrTitleFolderPath,
  deleteFilesAllowed,
  dropCacheTitles,
  dropLibraryOverlay,
  expandDropKeys,
  forgetRemovedIds,
  forgetRemovedTitleIds,
  fuseWholesalePath,
  jellyfinItemDeleteAllowed,
  libraryDropKeys,
  localDiskPath,
  matchArrItem,
  mergeRemovedIds,
  planArrDeleteUrl,
  planArrUnmonitorUrl,
  planSeerrDeletes,
  rememberRemovedTitleIds,
  removeLibraryTitle,
  resolveRemoveTarget,
  titleInDropSet,
  unmonitorArrBody,
} from "./reelos-library-remove.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("deleteFiles refuses /media, FUSE roots, and dump roots; allows a title folder", () => {
  assert.equal(localDiskPath("/media"), true);
  assert.equal(localDiskPath("/media/movies/Dune (2021)"), true);
  assert.equal(localDiskPath("/srv/media/sda"), true);
  assert.equal(fuseWholesalePath("/mnt/debrid/__all__"), true);
  assert.equal(fuseWholesalePath("/mnt/symlinks"), true);
  assert.equal(fuseWholesalePath("/mnt/symlinks/radarr"), true);
  assert.equal(fuseWholesalePath("/symlinks/sonarr"), true);
  assert.equal(fuseWholesalePath("/mnt/symlinks/__all__"), true);
  assert.equal(arrTitleFolderPath("/mnt/symlinks/radarr/Dune (2021)"), true);
  assert.equal(arrTitleFolderPath("/symlinks/sonarr/The Walking Dead"), true);
  assert.equal(arrTitleFolderPath("/movies/John Wick (2014)"), true);
  assert.equal(deleteFilesAllowed("/media/movies/Dune (2021)"), false);
  assert.equal(deleteFilesAllowed("/mnt/debrid/__all__"), false);
  assert.equal(deleteFilesAllowed("/mnt/symlinks"), false);
  assert.equal(deleteFilesAllowed("/mnt/symlinks/radarr"), false);
  assert.equal(deleteFilesAllowed("/mnt/symlinks/radarr/Dune (2021)"), true);
  assert.equal(jellyfinItemDeleteAllowed("/media/movies/Dune (2021)"), false);
  assert.equal(jellyfinItemDeleteAllowed("/mnt/symlinks/sonarr/The Walking Dead"), true);
});

test("overlay drop removes movie and every TV season row", () => {
  const movie = dropLibraryOverlay({
    shelf: [
      { id: "tmdb-1593", kind: "movie", ids: ["tmdb-1593", "jf-a"], jellyfinId: "a" },
      { id: "tmdb-550", kind: "movie", ids: ["tmdb-550"] },
    ],
    library: ["tmdb-1593", "tmdb-550"],
    requests: [
      { id: "seerr-1", titleId: "tmdb-1593", status: "available" },
      { id: "seerr-2", titleId: "tmdb-550", status: "downloading" },
    ],
    titleId: "tmdb-1593",
  });
  assert.deepEqual(movie.shelf.map((t) => t.id), ["tmdb-550"]);
  assert.deepEqual(movie.library, ["tmdb-550"]);
  assert.deepEqual(movie.requests.map((r) => r.id), ["seerr-2"]);

  const tv = dropLibraryOverlay({
    shelf: [{ id: "tvdb-153021", kind: "tv", ids: ["tvdb-153021", "tmdb-1402", "tmdb-tv-1402"], jellyfinId: "twd" }],
    library: ["tvdb-153021", "tmdb-tv-1402"],
    requests: [
      { id: "s1", titleId: "tmdb-tv-1402", season: 1, status: "available" },
      { id: "s2", titleId: "tmdb-tv-1402", season: 2, status: "downloading" },
      { id: "other", titleId: "tmdb-99", status: "waiting" },
    ],
    titleId: "tvdb-153021",
    extraIds: ["tmdb-tv-1402"],
  });
  assert.equal(tv.shelf.length, 0);
  assert.equal(tv.library.length, 0);
  assert.deepEqual(tv.requests.map((r) => r.id), ["other"]);
});

test("Seerr delete plan uses existing /api/v1/request/:id and /api/v1/media/:id", () => {
  const plan = planSeerrDeletes({
    mediaInfo: {
      id: 44,
      requests: [{ id: 9 }, { id: "seerr-12" }],
    },
  });
  assert.equal(plan.mediaPath, "/api/v1/media/44");
  assert.deepEqual(plan.requestPaths, ["/api/v1/request/9", "/api/v1/request/12"]);
});

test("Radarr/Sonarr delete URLs unmonitor then DELETE; files only when allowed", () => {
  assert.equal(
    planArrDeleteUrl({ mediaType: "movie", id: 7, deleteFiles: true }),
    "http://127.0.0.1:7878/api/v3/movie/7?deleteFiles=true&addImportExclusion=false",
  );
  assert.equal(
    planArrDeleteUrl({ mediaType: "tv", id: 3, deleteFiles: false }),
    "http://127.0.0.1:8989/api/v3/series/3?deleteFiles=false",
  );
  assert.equal(planArrUnmonitorUrl({ mediaType: "movie", id: 7 }), "http://127.0.0.1:7878/api/v3/movie/7");
  const movie = unmonitorArrBody({ id: 7, monitored: true, path: "/movies/Dune (2021)" }, "movie");
  assert.equal(movie.monitored, false);
  const series = unmonitorArrBody(
    { id: 3, monitored: true, seasons: [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: true }] },
    "tv",
  );
  assert.equal(series.monitored, false);
  assert.equal(series.seasons.every((s) => s.monitored === false), true);
});

test("matchArrItem finds movies by tmdb and series by tmdb or tvdb", () => {
  assert.equal(matchArrItem([{ tmdbId: 1593, id: 1 }], { mediaType: "movie", tmdb: "1593" }).id, 1);
  assert.equal(matchArrItem([{ tmdbId: 1402, tvdbId: 153021, id: 8 }], { mediaType: "tv", tvdb: "153021" }).id, 8);
  assert.equal(matchArrItem([{ tmdbId: 1402, id: 8 }], { mediaType: "tv", tmdb: "1402" }).id, 8);
});

test("remove without confirm is refused", async () => {
  const r = await removeLibraryTitle({ titleId: "tmdb-1593", confirm: false });
  assert.equal(r.ok, false);
  assert.match(r.error, /Confirm/);
});

test("remove movie: Seerr + Radarr deleteFiles on dump folder, never /media", async () => {
  const calls = [];
  const r = await removeLibraryTitle({
    titleId: "tmdb-1593",
    jellyfinId: "jf-museum",
    confirm: true,
    mediaType: "movie",
    tmdb: "1593",
    shelf: [{ id: "tmdb-1593", kind: "movie", jellyfinId: "jf-museum", ids: ["tmdb-1593"] }],
    seerrKey: "k",
    seerrFetch: async (path, opts = {}) => {
      calls.push(["seerr", opts.method || "GET", path]);
      if (path.startsWith("/api/v1/movie/")) {
        return { json: { mediaInfo: { id: 21, tmdbId: 1593, requests: [{ id: 5 }] } } };
      }
      return { ok: true };
    },
    radarrKey: "rk",
    sonarrKey: "sk",
    fetchArr: async (url, _key, _ms, opts = {}) => {
      calls.push(["arr", opts.method || "GET", url]);
      if (String(url).includes("/api/v3/movie") && !opts.method) {
        return [{ id: 70, tmdbId: 1593, monitored: true, path: "/mnt/symlinks/radarr/Night at the Museum (2006)" }];
      }
      return { ok: true, empty: true };
    },
    jellyfinGetItem: async (id) => ({ Id: id, Path: "/mnt/symlinks/radarr/Night at the Museum (2006)" }),
    jellyfinDeleteItem: async (id, path) => {
      calls.push(["jf", "DELETE", id, path]);
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.steps.deleteFiles, true);
  assert.ok(calls.some((c) => c[0] === "seerr" && c[1] === "DELETE" && c[2] === "/api/v1/request/5"));
  assert.ok(calls.some((c) => c[0] === "seerr" && c[1] === "DELETE" && c[2] === "/api/v1/media/21"));
  assert.ok(calls.some((c) => c[0] === "arr" && c[1] === "PUT" && String(c[2]).includes("/movie/70")));
  assert.ok(calls.some((c) => c[0] === "arr" && c[1] === "DELETE" && String(c[2]).includes("deleteFiles=true")));
  assert.ok(calls.some((c) => c[0] === "jf" && c[1] === "DELETE"));
});

test("remove TV: Sonarr unmonitor+delete; JF skipped when path is /media", async () => {
  const calls = [];
  const r = await removeLibraryTitle({
    titleId: "tvdb-153021",
    confirm: true,
    mediaType: "tv",
    tmdb: "1402",
    tvdb: "153021",
    jellyfinId: "twd",
    shelf: [{ id: "tvdb-153021", kind: "tv", ids: ["tvdb-153021", "tmdb-tv-1402"], jellyfinId: "twd" }],
    seerrKey: "k",
    seerrFetch: async (path, opts = {}) => {
      calls.push(["seerr", opts.method || "GET", path]);
      if (path.startsWith("/api/v1/tv/")) {
        return { json: { mediaInfo: { id: 8, tmdbId: 1402, requests: [{ id: 1 }, { id: 2 }] } } };
      }
      return { ok: true };
    },
    sonarrKey: "sk",
    radarrKey: "rk",
    fetchArr: async (url, _key, _ms, opts = {}) => {
      calls.push(["arr", opts.method || "GET", url]);
      if (String(url).includes("/api/v3/series") && !opts.method) {
        return [{ id: 4, tmdbId: 1402, tvdbId: 153021, path: "/media/tv/The Walking Dead", monitored: true, seasons: [{ seasonNumber: 1, monitored: true }] }];
      }
      return { ok: true, empty: true };
    },
    jellyfinGetItem: async (id) => ({ Id: id, Path: "/media/tv/The Walking Dead" }),
    jellyfinDeleteItem: async () => {
      calls.push(["jf", "DELETE"]);
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.steps.deleteFiles, false);
  assert.equal(r.steps.jellyfin.deleted, false);
  assert.ok(calls.some((c) => c[0] === "arr" && c[1] === "DELETE" && String(c[2]).includes("deleteFiles=false")));
  assert.equal(calls.some((c) => c[0] === "jf"), false);
  assert.ok(calls.filter((c) => c[0] === "seerr" && c[1] === "DELETE").length >= 3);
});

test("removed-id overlay persists across serve filter and forgets on re-request", () => {
  const dir = join(tmpdir(), `reelos-removed-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "library-removed.json");
  const ids = rememberRemovedTitleIds(["tmdb-1593", "tmdb-tv-1402"], {
    file,
    write: { mkdirSync, writeFileSync },
  });
  assert.ok(ids.includes("tmdb-1593"));
  const titles = applyRemovedTitles(
    [
      { id: "tmdb-1593", ids: ["tmdb-1593"] },
      { id: "tmdb-550", ids: ["tmdb-550"] },
    ],
    ids,
  );
  assert.deepEqual(titles.map((t) => t.id), ["tmdb-550"]);
  const left = forgetRemovedTitleIds("tmdb-1593", [], {
    file,
    read: { readFileSync, existsSync },
    write: { mkdirSync, writeFileSync },
  });
  assert.equal(left.includes("tmdb-1593"), false);
  assert.ok(existsSync(file));
});

test("plugin, phone UI, and mailman wire DELETE /api/library", () => {
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const title = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  const library = readFileSync(join(root, "src/components/library-view.tsx"), "utf8");
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  const updater = readFileSync(join(root, "daemon/reelos-update.sh"), "utf8");
  assert.match(plugin, /handleLibraryRemove/);
  assert.match(plugin, /removeLibraryTitle/);
  assert.match(plugin, /method === "DELETE"/);
  assert.match(plugin, /forgetRemovedTitleIds/);
  assert.doesNotMatch(plugin, /rm -rf \/media/);
  assert.doesNotMatch(plugin, /__all__.*unlink/);
  assert.match(title, /RemoveFromBox/);
  assert.match(library, /RemoveFromBox/);
  assert.match(home, /RemoveFromBox/);
  assert.match(updater, /reelos-library-remove\.mjs/);
  assert.match(updater, /Remove from this box/);
});

test("resolveRemoveTarget maps tvdb shelf rows onto tmdb-tv for Seerr", () => {
  const t = resolveRemoveTarget({
    titleId: "tvdb-153021",
    shelf: [{ id: "tvdb-153021", kind: "tv", ids: ["tvdb-153021", "tmdb-1402", "tmdb-tv-1402"], jellyfinId: "twd" }],
  });
  assert.equal(t.mediaType, "tv");
  assert.equal(t.tmdb, "1402");
  assert.equal(t.tvdb, "153021");
  assert.equal(t.jellyfinId, "twd");
});

test("helpers: drop cache + merge/forget ids + arr path", () => {
  assert.equal(titleInDropSet({ id: "tmdb-1", ids: ["tmdb-1"] }, ["tmdb-1"]), true);
  assert.deepEqual(mergeRemovedIds(["a"], ["a", "b"]), ["a", "b"]);
  assert.deepEqual(forgetRemovedIds(["a", "b"], ["a"]), ["b"]);
  assert.deepEqual(
    dropCacheTitles([{ id: "tmdb-1" }, { id: "tmdb-2" }], expandDropKeys({ titleId: "tmdb-1" })).map((t) => t.id),
    ["tmdb-2"],
  );
  assert.equal(arrItemPath({ path: "/movies/X" }), "/movies/X");
  assert.ok(libraryDropKeys("tmdb-tv-1402").includes("tmdb-1402"));
});
