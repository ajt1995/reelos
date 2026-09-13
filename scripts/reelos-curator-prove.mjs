#!/usr/bin/env node
/**
 * Cloud-prove Discover downvote then Settings reset. No Seerr, no Google, no /media.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hideCuratorTitle, readCurator, resetCurator, filterCuratorHidden, filterLibraryTitles } from "./reelos-curator.mjs";
import { mapSeerrDiscoverResults } from "./reelos-seerr.mjs";

const state = mkdtempSync(join(tmpdir(), "reelos-curator-prove-"));
process.env.REELOS_STATE = state;

const fight = { id: 550, title: "Fight Club", releaseDate: "1999-10-15", mediaType: "movie" };
const moon = { id: 17431, title: "Moon", releaseDate: "2009-07-17", mediaType: "movie" };
const wick = { id: "tmdb-245891", title: "John Wick", year: 2014, kind: "movie", jellyfinId: "wick" };

const before = mapSeerrDiscoverResults([fight, moon], { mediaType: "movie", now: Date.parse("2026-09-12T00:00:00Z") });
assert.deepEqual(
  before.map((t) => t.id),
  ["tmdb-550", "tmdb-17431"],
  "pick tonight starts with Fight Club",
);

const hidden = hideCuratorTitle({ id: "tmdb-550", ids: ["tmdb-550"], title: "Fight Club" }, state);
assert.ok(hidden.hidden.includes("tmdb-550"));
const afterHide = filterCuratorHidden(before, readCurator(state));
assert.deepEqual(
  afterHide.map((t) => t.id),
  ["tmdb-17431"],
  "downvote drops Fight Club from Discover",
);
assert.deepEqual(
  filterLibraryTitles([wick, { id: "tmdb-550", title: "Fight Club" }]).map((t) => t.id),
  ["tmdb-245891", "tmdb-550"],
  "owned library is not hidden",
);

resetCurator(state);
const afterReset = filterCuratorHidden(before, readCurator(state));
assert.deepEqual(
  afterReset.map((t) => t.id),
  ["tmdb-550", "tmdb-17431"],
  "reset curator preferences brings Fight Club back",
);

const { dispatchReelOsApi } = await import("./reelos-lookup-plugin.mjs");

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        if (await dispatchReelOsApi(req, res)) return;
        res.statusCode = 404;
        res.end("no");
      } catch (e) {
        reject(e);
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const opts = { method, hostname: "127.0.0.1", port, path: url, headers: { "content-type": "application/json" } };
      import("node:http").then(({ request: httpRequest }) => {
        const req = httpRequest(opts, (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({ status: res.statusCode, json: JSON.parse(text || "{}") });
          });
        });
        req.on("error", reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    });
  });
}

const postLike = await request("POST", "/api/curator", { id: "tmdb-949", title: "Heat", vote: "like" });
assert.equal(postLike.status, 200);
assert.ok(postLike.json.liked.includes("tmdb-949"));
const post = await request("POST", "/api/curator", { id: "tmdb-550", title: "Fight Club", vote: "dislike" });
assert.equal(post.status, 200);
assert.ok(post.json.hidden.includes("tmdb-550"));
assert.equal(post.json.count >= 1, true);
const get = await request("GET", "/api/curator");
assert.ok(get.json.hidden.includes("tmdb-550"));
assert.ok(get.json.liked.includes("tmdb-949"));
const reset = await request("POST", "/api/curator/reset");
assert.equal(reset.status, 200);
assert.equal(reset.json.count, 0);
assert.deepEqual(reset.json.hidden, []);
assert.deepEqual(reset.json.liked, []);
const gone = await request("GET", "/api/curator");
assert.equal(gone.json.count, 0);

rmSync(state, { recursive: true, force: true });
console.log("curator prove ok: like + downvote then reset; library unchanged; no Google");
