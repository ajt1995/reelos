import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, it } from "node:test";
import { processMediaRetentionRequest } from "./media-retention-service.mjs";
import { saveProfile } from "./profile-service.mjs";
import { registerAuthorizedDevice, signDeviceToken, getGateSecret, setAuthorizedDeviceActiveProfile, revokeAuthorizedDevice } from "./reelos-gate-service.mjs";
import { replaceProfileSession } from "./profile-session-service.mjs";

describe("Verified local original retention", () => {
  let stateDir, profilesDir, mediaFile, item, options, ledgerFile;
  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "media-retention-"));
    profilesDir = path.join(stateDir, "profiles");
    mediaFile = path.join(stateDir, "original.mp4");
    ledgerFile = path.join(stateDir, "media-retention.json");
    fs.writeFileSync(mediaFile, "original local media bytes");
    for (const id of ["owner", "reader", "constructor"]) saveProfile({ id, name: id, role: id === "owner" ? "owner" : "member" }, profilesDir);
    saveProfile({ id: "child", name: "Child", isKids: true, pin: "2468" }, profilesDir);
    item = { id: "tmdb-123", jellyfinId: "local-123", type: "movie", path: mediaFile, sourceKind: "personal_import", OfficialRating: "G" };
    options = { stateDir, profilesDir, presenceService: { roomPresence: new Map() } };
    shelf([item]);
  });
  afterEach(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  function shelf(items) { fs.writeFileSync(path.join(stateDir, "library-shelf.json"), JSON.stringify({ titles: items })); }
  function client(profileId = "owner") {
    const device = registerAuthorizedDevice({ name: "Test", activeProfileId: profileId }, stateDir);
    const req = { method: "GET", url: "/api/library/keep", headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } };
    const session = replaceProfileSession(req, profilesDir, profileId, device.id);
    req.headers.cookie = `reelos_device_token=${signDeviceToken(device, getGateSecret(stateDir))}; reelos_profile_session=${session.token}`;
    return { req, device,
      get: (id = item.id, expectedProfileId = profileId) => processMediaRetentionRequest({ ...req, url: `/api/library/keep?id=${encodeURIComponent(id)}&expectedProfileId=${expectedProfileId}` }, null, options),
      post: async (body = { id: item.id, expectedProfileId: profileId }) => {
        let payload = body;
        if (body && !Array.isArray(body) && typeof body === "object" && !Object.hasOwn(body, "expectedFileVersion")) {
          const current = await processMediaRetentionRequest({ ...req, url: `/api/library/keep?id=${encodeURIComponent(body.id || item.id)}&expectedProfileId=${profileId}` }, null, options);
          payload = { ...body, expectedFileVersion: current.payload.fileVersion || "0".repeat(64) };
        }
        return processMediaRetentionRequest({ ...req, method: "POST" }, async () => payload, options);
      },
    };
  }
  function ledger() { return JSON.parse(fs.readFileSync(ledgerFile, "utf8")); }

  it("persists exact original identity and reloads own state without exposing paths or pin owners", async () => {
    const owner = client();
    const initial = await owner.get();
    const fileVersion = initial.payload.fileVersion;
    assert.match(fileVersion, /^[a-f0-9]{64}$/);
    assert.deepEqual(initial.payload, { ok: true, kept: false, id: item.id, profileId: "owner", storage: "local-original", fileVersion });
    assert.equal(fs.existsSync(ledgerFile), false);
    const profileBefore = fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8");
    const result = await owner.post();
    assert.deepEqual(result, { status: 200, payload: { ok: true, persisted: true, kept: true, id: item.id, profileId: "owner", storage: "local-original", fileVersion } });
    const saved = ledger();
    assert.equal(saved.schemaVersion, 1);
    assert.equal(saved.entries[item.id].sourceKind, "personal_import");
    assert.equal(saved.entries[item.id].file.path, fs.realpathSync(mediaFile));
    const stat = fs.lstatSync(mediaFile, { bigint: true });
    for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs"]) assert.equal(saved.entries[item.id].file[key], String(stat[key]));
    const fresh = await import("./media-retention-service.mjs?reload=retention");
    const read = await fresh.processMediaRetentionRequest({ ...owner.req, url: "/api/library/keep?id=local-123&expectedProfileId=owner" }, null, options);
    assert.deepEqual(read.payload, { ok: true, kept: true, id: "local-123", profileId: "owner", storage: "local-original", fileVersion });
    assert.equal(fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8"), profileBefore);
    assert.equal(fs.existsSync(ledgerFile + ".lock"), false);
  });

  it("keeps two profiles independent and unpins only own preference without changing original bytes", async () => {
    const owner = client(), reader = client("reader");
    await owner.post();
    assert.equal((await reader.get()).payload.kept, false);
    await reader.post();
    const before = fs.readFileSync(mediaFile);
    const statBefore = fs.statSync(mediaFile);
    assert.equal((await owner.post({ id: item.id, expectedProfileId: "owner", keep: false })).payload.kept, false);
    assert.equal((await owner.get()).payload.kept, false);
    assert.equal((await reader.get()).payload.kept, true);
    assert.deepEqual(Object.keys(ledger().entries[item.id].pins), ["reader"]);
    assert.deepEqual(fs.readFileSync(mediaFile), before);
    assert.equal(fs.statSync(mediaFile).mtimeMs, statBefore.mtimeMs);
    assert.equal(JSON.stringify((await owner.get()).payload).includes("reader"), false);
    assert.equal((await client("constructor").get()).payload.kept, false);
  });

  it("accepts explicit public originals and individual episode files but rejects aggregate or ambiguous mappings", async () => {
    const owner = client();
    shelf([{ ...item, sourceKind: "public_domain", type: undefined, Type: "Episode", kind: "tv", seasons: 3 }]);
    assert.equal((await owner.post()).status, 200);
    assert.equal(ledger().entries[item.id].sourceKind, "public_domain");
    for (const items of [[{ ...item, type: "series" }], [{ ...item, type: "tv" }], [{ ...item, seasons: [] }],
      [{ ...item, type: undefined, kind: "tv", seasons: 3 }], [{ ...item, type: undefined, seasons: 3 }],
      [item, { ...item, id: "other-title" }], [item, { ...item }]]) {
      shelf(items);
      const id = items.length > 1 && items[1].id === "other-title" ? "local-123" : item.id;
      assert.equal((await owner.get(id)).status, 503);
    }
  });

  it("rejects unknown, provider, retained, remote, missing, and revoked sources without contacting providers", async () => {
    const owner = client();
    for (const changed of [
      { ...item, sourceKind: undefined }, { ...item, sourceKind: "debrid" }, { ...item, sourceKind: "retained_local" },
      { ...item, sourceKind: "public_catalog" }, { ...item, path: "https://provider.invalid/video.mp4" },
      { ...item, path: "\\\\server\\share\\video.mp4" }, { ...item, path: path.join(stateDir, "missing.mp4") },
      { ...item, path: path.join(stateDir, "original.strm") }, { ...item, source: { kind: "debrid" } },
    ]) {
      shelf([changed]);
      const result = await owner.post();
      assert.equal(result.status, 503);
      assert.equal(result.payload.code, "retention_unavailable");
      assert.equal(fs.existsSync(ledgerFile), false);
    }
    shelf([item]);
    await owner.post();
    const before = fs.readFileSync(ledgerFile, "utf8");
    shelf([]);
    assert.equal((await owner.get()).status, 503);
    assert.equal((await owner.post()).status, 503);
    shelf([{ ...item, sourceKind: "debrid" }]);
    assert.equal((await owner.get()).status, 503);
    assert.equal(fs.readFileSync(ledgerFile, "utf8"), before);
  });

  it("does not transfer a pin to replaced bytes or a changed source identity", async () => {
    const owner = client();
    await owner.post();
    const before = fs.readFileSync(ledgerFile, "utf8");
    fs.writeFileSync(mediaFile, "different replacement bytes");
    for (const result of [await owner.get(), await owner.post(), await owner.post({ id: item.id, expectedProfileId: "owner", keep: false })]) {
      assert.equal(result.status, 409);
      assert.equal(result.payload.code, "retention_identity_changed");
      assert.equal(result.payload.kept, undefined);
    }
    assert.equal(fs.readFileSync(ledgerFile, "utf8"), before);
    shelf([{ ...item, sourceKind: "public_domain" }]);
    assert.equal((await owner.get()).status, 409);
    fs.unlinkSync(mediaFile);
    assert.equal((await owner.get()).status, 503);
  });

  it("rejects stale displayed file versions before the first pin after replacement, remapping, or source/title change", async () => {
    const owner = client();
    const replacement = path.join(stateDir, "replacement.mp4");
    fs.writeFileSync(replacement, "a different original");
    for (const change of ["bytes", "path", "source", "title"]) {
      shelf([item]);
      const shown = await owner.get("local-123");
      assert.equal(shown.payload.kept, false);
      assert.equal(fs.existsSync(ledgerFile), false);
      if (change === "bytes") fs.writeFileSync(mediaFile, "different bytes after displaying keep");
      if (change === "path") shelf([{ ...item, path: replacement }]);
      if (change === "source") shelf([{ ...item, sourceKind: "public_domain" }]);
      if (change === "title") shelf([{ ...item, id: "another-title" }]);
      const current = await owner.get("local-123");
      assert.notEqual(current.payload.fileVersion, shown.payload.fileVersion, change);
      const result = await owner.post({ id: "local-123", expectedProfileId: "owner", expectedFileVersion: shown.payload.fileVersion });
      assert.equal(result.status, 409, change);
      assert.equal(result.payload.code, "retention_identity_changed");
      assert.equal(result.payload.persisted, undefined);
      assert.equal(fs.existsSync(ledgerFile), false);
      assert.equal(fs.existsSync(ledgerFile + ".lock"), false);
    }
  });

  it("requires a well-formed expected file version and echoes the verified lowercase token", async () => {
    const owner = client();
    const payload = { id: item.id, expectedProfileId: "owner" };
    const missing = await processMediaRetentionRequest({ ...owner.req, method: "POST" }, async () => payload, options);
    assert.equal(missing.status, 400);
    for (const expectedFileVersion of [undefined, null, "", "abc", "g".repeat(64), 42]) {
      assert.equal((await owner.post({ ...payload, expectedFileVersion })).status, 400);
    }
    const fileVersion = (await owner.get()).payload.fileVersion;
    const result = await owner.post({ ...payload, expectedFileVersion: fileVersion.toUpperCase() });
    assert.equal(result.status, 200);
    assert.equal(result.payload.fileVersion, fileVersion);
  });

  it("treats prototype-like title and profile IDs as own ledger entries only", async () => {
    item = { ...item, id: "toString" };
    shelf([item]);
    const viewer = client("constructor");
    assert.equal((await viewer.get()).payload.kept, false);
    assert.equal((await viewer.post()).payload.kept, true);
    assert.equal((await viewer.get()).payload.kept, true);
    assert.equal(Object.hasOwn(ledger().entries, "toString"), true);
    assert.equal((await viewer.post({ id: "toString", expectedProfileId: "constructor", keep: false })).payload.kept, false);
    assert.equal((await viewer.get()).payload.kept, false);
    assert.equal(Object.hasOwn(ledger().entries.toString.pins, "constructor"), false);
  });

  it("detects an equal-size rewrite even when the previous modification timestamp is restored", async () => {
    const owner = client();
    const fixedTime = new Date("2000-01-01T00:00:00Z");
    fs.utimesSync(mediaFile, fixedTime, fixedTime);
    await owner.post();
    const before = ledger();
    fs.writeFileSync(mediaFile, Buffer.alloc(Number(before.entries[item.id].file.size), 0x7a));
    fs.utimesSync(mediaFile, fixedTime, fixedTime);
    const stat = fs.statSync(mediaFile, { bigint: true });
    assert.equal(String(stat.mtimeNs), before.entries[item.id].file.mtimeNs);
    assert.equal(String(stat.size), before.entries[item.id].file.size);
    assert.notEqual(String(stat.ctimeNs), before.entries[item.id].file.ctimeNs);
    const result = await owner.get();
    assert.equal(result.status, 409);
    assert.equal(result.payload.code, "retention_identity_changed");
    assert.deepEqual(ledger(), before);
  });

  it("rejects symbolic-link leaves and linked ancestor projections where creation is supported", async (t) => {
    const owner = client();
    const link = path.join(stateDir, "linked.mp4");
    const actualDir = path.join(stateDir, "actual");
    const linkedDir = path.join(stateDir, "linked-dir");
    fs.mkdirSync(actualDir);
    fs.writeFileSync(path.join(actualDir, "movie.mp4"), "original in directory");
    let exercised = 0;
    for (const [target, location, type, candidate] of [
      [mediaFile, link, "file", link],
      [actualDir, linkedDir, process.platform === "win32" ? "junction" : "dir", path.join(linkedDir, "movie.mp4")],
    ]) {
      try { fs.symlinkSync(target, location, type); }
      catch (error) {
        if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) { t.diagnostic("This host does not allow creating the requested symlink fixture."); continue; }
        throw error;
      }
      exercised++;
      shelf([{ ...item, path: candidate }]);
      const result = await owner.post();
      assert.equal(result.status, 503);
      assert.equal(result.payload.code, "retention_unavailable");
    }
    t.diagnostic(`Verified ${exercised} supported link projection cases.`);
    assert.equal(fs.existsSync(ledgerFile), false);
  });

  it("always rejects a leaf reported as a symbolic link, independent of host symlink permissions", async (t) => {
    const owner = client();
    const lstat = fs.lstatSync;
    let leafChecks = 0;
    t.mock.method(fs, "lstatSync", (file, ...args) => {
      const stat = lstat(file, ...args);
      if (file !== mediaFile) return stat;
      leafChecks++;
      // This is a deterministic guard test, not native symlink evidence.
      return { ...stat, isSymbolicLink: () => true };
    });
    const result = await owner.post({ id: item.id, expectedProfileId: "owner", expectedFileVersion: "0".repeat(64) });
    assert.equal(result.status, 503);
    assert.equal(result.payload.code, "retention_unavailable");
    assert.equal(leafChecks, 1);
    assert.equal(fs.existsSync(ledgerFile), false);
    assert.equal(fs.readFileSync(mediaFile, "utf8"), "original local media bytes");
  });

  it("requires own expected identity, rejects client metadata and paths, and restricts mutations to adults", async () => {
    const owner = client(), child = client("child");
    const valid = { id: item.id, expectedProfileId: "owner" };
    for (const body of [{}, { id: item.id }, { ...valid, path: mediaFile }, { ...valid, profileId: "reader" },
      { ...valid, sourceKind: "personal_import" }, { ...valid, keep: 1 }, { ...valid, id: "../file" },
      { ...valid, expectedProfileId: "../owner" }, [], { ...valid, item }]) {
      assert.equal((await owner.post(body)).status, 400);
    }
    assert.equal((await owner.post({ ...valid, expectedProfileId: "reader" })).status, 403);
    assert.equal((await owner.get(item.id, "reader")).status, 403);
    assert.equal((await child.post()).status, 403);
    assert.equal((await child.get()).status, 200);
    const denied = await processMediaRetentionRequest({ ...owner.req, method: "POST", headers: { ...owner.req.headers, origin: "https://hostile.invalid" } }, async () => valid, options);
    assert.equal(denied.status, 403);
    const anonymous = await processMediaRetentionRequest({ ...owner.req, method: "POST", headers: { host: "localhost" } }, async () => valid, options);
    assert.equal(anonymous.status, 401);
    for (const query of ["id=tmdb-123", "id=tmdb-123&expectedProfileId=owner&path=anything", "id=tmdb-123&id=other&expectedProfileId=owner"]) {
      assert.equal((await processMediaRetentionRequest({ ...owner.req, url: "/api/library/keep?" + query }, null, options)).status, 400);
    }
    assert.equal(fs.existsSync(ledgerFile), false);
  });

  it("respects family eligibility and revalidates identity and source after awaited body reading", async () => {
    const owner = client();
    options.presenceService.roomPresence.set(`playback:${owner.device.id}:room`, { kidsPresent: true, childProfileIds: ["child"] });
    shelf([{ ...item, OfficialRating: "R" }]);
    assert.equal((await owner.post()).payload.code, "family_title_denied");
    options.presenceService.roomPresence.clear();
    shelf([item]);
    for (const change of ["revoke", "switch", "source"]) {
      const viewer = client();
      const expectedFileVersion = (await viewer.get()).payload.fileVersion;
      const result = await processMediaRetentionRequest({ ...viewer.req, method: "POST" }, async () => {
        if (change === "revoke") revokeAuthorizedDevice(viewer.device.id, stateDir);
        else if (change === "switch") setAuthorizedDeviceActiveProfile(viewer.device.id, "reader", stateDir);
        else shelf([{ ...item, sourceKind: "retained_local" }]);
        return { id: item.id, expectedProfileId: "owner", expectedFileVersion };
      }, options);
      assert.equal(result.status, change === "source" ? 503 : 401);
      assert.equal(fs.existsSync(ledgerFile), false);
    }
  });

  it("rechecks original identity under the cross-process lock", async (t) => {
    const owner = client();
    const open = fs.openSync;
    const mock = t.mock.method(fs, "openSync", (file, flags, ...args) => {
      const handle = open(file, flags, ...args);
      if (file === ledgerFile + ".lock" && flags === "wx") fs.writeFileSync(mediaFile, "changed while obtaining lock");
      return handle;
    });
    const result = await owner.post();
    mock.mock.restore();
    assert.equal(result.status, 409);
    assert.equal(result.payload.code, "retention_identity_changed");
    assert.equal(fs.existsSync(ledgerFile), false);
    assert.equal(fs.existsSync(ledgerFile + ".lock"), false);
  });

  it("rejects revoked, switched and demoted identities observed at lock acquisition", async (t) => {
    for (const change of ["revoke", "switch", "demote"]) {
      const owner = client();
      const open = fs.openSync;
      let mutated = false;
      const mock = t.mock.method(fs, "openSync", (file, flags, ...args) => {
        const handle = open(file, flags, ...args);
        if (file === ledgerFile + ".lock" && flags === "wx" && !mutated) {
          mutated = true;
          if (change === "revoke") revokeAuthorizedDevice(owner.device.id, stateDir);
          else if (change === "switch") {
            setAuthorizedDeviceActiveProfile(owner.device.id, "reader", stateDir);
            const session = replaceProfileSession(owner.req, profilesDir, "reader", owner.device.id);
            owner.req.headers.cookie = owner.req.headers.cookie.split("; ")[0] + `; reelos_profile_session=${session.token}`;
          } else {
            const file = path.join(profilesDir, "owner.json");
            const profile = JSON.parse(fs.readFileSync(file, "utf8"));
            fs.writeFileSync(file, JSON.stringify({ ...profile, isKids: true, role: "child" }));
          }
        }
        return handle;
      });
      let result;
      try { result = await owner.post(); } finally { mock.mock.restore(); }
      assert.equal(result.status, change === "revoke" ? 401 : 403, change);
      assert.equal(fs.existsSync(ledgerFile), false);
      assert.equal(fs.existsSync(ledgerFile + ".lock"), false);
    }
  });

  it("fails closed on corrupt or unsupported ledgers and never reclaims an unverified lock", async () => {
    const owner = client();
    for (const invalid of ["{broken", JSON.stringify({ schemaVersion: 2, entries: {} }),
      JSON.stringify({ schemaVersion: 1, entries: { [item.id]: { file: mediaFile } } })]) {
      fs.writeFileSync(ledgerFile, invalid);
      assert.equal((await owner.get()).status, 503);
      assert.equal((await owner.post()).status, 503);
      assert.equal(fs.readFileSync(ledgerFile, "utf8"), invalid);
      assert.equal(fs.existsSync(ledgerFile + ".lock"), false);
    }
    fs.writeFileSync(ledgerFile, JSON.stringify({ schemaVersion: 1, entries: {} }));
    fs.writeFileSync(ledgerFile + ".lock", "another process");
    fs.utimesSync(ledgerFile + ".lock", new Date(0), new Date(0));
    const result = await owner.post();
    assert.equal(result.status, 409);
    assert.equal(result.payload.code, "retention_busy");
    assert.equal(fs.readFileSync(ledgerFile + ".lock", "utf8"), "another process");
    assert.deepEqual(ledger().entries, {});
  });

  it("acknowledges no failed persistence and preserves ledger, other pins, and original bytes", async (t) => {
    const owner = client(), reader = client("reader");
    await reader.post();
    const before = fs.readFileSync(ledgerFile, "utf8");
    const original = fs.readFileSync(mediaFile);
    for (const method of ["writeFileSync", "renameSync"]) {
      for (const [code, status] of [["ENOSPC", 507], ["EACCES", 503]]) {
        const mock = t.mock.method(fs, method, () => { throw Object.assign(new Error(code), { code }); });
        let result;
        try { result = await owner.post(); } finally { mock.mock.restore(); }
        assert.equal(result.status, status);
        assert.equal(result.payload.ok, false);
        assert.equal(result.payload.persisted, undefined);
        assert.equal(fs.readFileSync(ledgerFile, "utf8"), before);
        assert.equal(fs.existsSync(ledgerFile + ".lock"), false);
        assert.deepEqual(fs.readFileSync(mediaFile), original);
        assert.equal(fs.readdirSync(stateDir).some((name) => name.endsWith(".tmp")), false);
      }
    }
  });

  it("refuses serialized ledgers above 8MiB before writing and accepts the exact readable boundary", async (t) => {
    const owner = client(), reader = client("reader");
    await reader.post();
    const before = fs.readFileSync(ledgerFile, "utf8");
    const stringify = JSON.stringify;
    const limit = 8 * 1024 * 1024;
    let requestedSize = limit + 1;
    // JSON whitespace keeps these real on-disk boundary fixtures valid without
    // inventing thousands of profiles or altering the service's configured cap.
    t.mock.method(JSON, "stringify", (value, ...args) => {
      const text = stringify(value, ...args);
      return value?.schemaVersion === 1 && value?.entries
        ? text + " ".repeat(requestedSize - Buffer.byteLength(text, "utf8"))
        : text;
    });
    const rejected = await owner.post();
    assert.equal(rejected.status, 507);
    assert.equal(rejected.payload.code, "retention_capacity_exceeded");
    assert.equal(rejected.payload.persisted, undefined);
    assert.equal(fs.readFileSync(ledgerFile, "utf8"), before);
    assert.equal(fs.existsSync(ledgerFile + ".lock"), false);
    requestedSize = limit;
    const saved = await owner.post();
    assert.equal(saved.status, 200);
    assert.equal(saved.payload.persisted, true);
    assert.equal(fs.statSync(ledgerFile).size, limit);
    assert.equal((await owner.get()).payload.kept, true);
    assert.equal((await reader.get()).payload.kept, true);
  });
});
