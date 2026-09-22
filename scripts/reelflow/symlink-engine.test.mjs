import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  linkMovie,
  linkTvEpisodes,
  scanForDeadSymlinks,
  createAtomicSymlink,
} from "./symlink-engine.mjs";

function getLinkTarget(filePath) {
  try {
    return fs.readlinkSync(filePath);
  } catch {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.startsWith("REELOS_SYMLINK:")) {
      return content.slice("REELOS_SYMLINK:".length);
    }
    return filePath;
  }
}

test("symlink-engine: creates canonical movie symlink atomically", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelflow-movie-"));
  const fakeDebridFile = path.join(tmpDir, "source-movie.mkv");
  fs.writeFileSync(fakeDebridFile, "fake movie content");

  const res = linkMovie({
    cleanTitle: "Interstellar",
    year: 2014,
    resolution: "2160p",
    sourceVideoPath: fakeDebridFile,
    mediaRootDir: tmpDir,
  });

  assert.equal(res.ok, true);
  assert.equal(res.created, true);
  assert.ok(fs.existsSync(res.targetPath));
  assert.equal(getLinkTarget(res.targetPath), fakeDebridFile);

  // Calling again with same source should be a clean no-op
  const res2 = linkMovie({
    cleanTitle: "Interstellar",
    year: 2014,
    resolution: "2160p",
    sourceVideoPath: fakeDebridFile,
    mediaRootDir: tmpDir,
  });
  assert.equal(res2.ok, true);
  assert.equal(res2.created, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("symlink-engine: creates dual symlinks for multi-episode file (S01E01-E02)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelflow-tv-"));
  const fakeEpFile = path.join(tmpDir, "Severance.S01E01-E02.2160p.mkv");
  fs.writeFileSync(fakeEpFile, "fake dual episode content");

  const res = linkTvEpisodes({
    cleanShowTitle: "Severance",
    seasonNum: 1,
    sourceVideoPaths: [fakeEpFile],
    mediaRootDir: tmpDir,
  });

  assert.equal(res.ok, true);
  assert.equal(res.linked.length, 2, "Must create 2 symlinks for S01E01-E02");

  const ep1 = res.linked.find((l) => l.episode === 1);
  const ep2 = res.linked.find((l) => l.episode === 2);

  assert.ok(ep1, "Episode 1 symlink must exist");
  assert.ok(ep2, "Episode 2 symlink must exist");
  assert.ok(ep1.targetPath.includes("S01E01"));
  assert.ok(ep2.targetPath.includes("S01E02"));
  assert.equal(getLinkTarget(ep1.targetPath), fakeEpFile);
  assert.equal(getLinkTarget(ep2.targetPath), fakeEpFile);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("symlink-engine: detects dead symlinks when debrid target is evicted", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelflow-dead-"));
  const validTarget = path.join(tmpDir, "valid.mkv");
  const evictedTarget = path.join(tmpDir, "evicted.mkv");

  fs.writeFileSync(validTarget, "valid content");
  // evictedTarget is NOT created (simulating cloud eviction)

  const movieDir = path.join(tmpDir, "movies", "Test Movie (2020)");
  fs.mkdirSync(movieDir, { recursive: true });

  const goodLink = path.join(movieDir, "Test Movie (2020) [1080p].mkv");
  const deadLink = path.join(movieDir, "Dead Movie (2020) [1080p].mkv");

  createAtomicSymlink(validTarget, goodLink);
  createAtomicSymlink(evictedTarget, deadLink);

  const dead = scanForDeadSymlinks(tmpDir);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].symlinkPath, deadLink);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
