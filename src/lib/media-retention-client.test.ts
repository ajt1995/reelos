import assert from "node:assert/strict";
import test from "node:test";
import { createMediaRetentionController, loadMediaRetention, saveMediaRetention, MediaRetentionError } from "./media-retention-client.ts";

const identity = { id: "local-file-a", expectedProfileId: "profile-a" };
const fileVersion = "a".repeat(64);
const writeIdentity = { ...identity, expectedFileVersion: fileVersion };
const ack = { ok: true, id: identity.id, profileId: identity.expectedProfileId, kept: false, storage: "local-original", fileVersion };

test("retention GET and POST assert exact file/profile without expanding aliases", async () => {
  await loadMediaRetention(identity, undefined, async (url, init) => {
    assert.equal(url, "/api/library/keep?id=local-file-a&expectedProfileId=profile-a");
    assert.equal(init?.cache, "no-store");
    return Response.json(ack);
  });
  for (const keep of [true, false]) {
    await saveMediaRetention({ ...writeIdentity, alias: "other-file" } as typeof writeIdentity, keep, undefined, async (url, init) => {
      assert.equal(url, "/api/library/keep");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), { ...writeIdentity, keep });
      return Response.json({ ...ack, kept: keep, persisted: true });
    });
  }
});

test("retention rejects wrong identity, storage, kept state, malformed or unpersisted acknowledgements", async () => {
  const good = { ...ack, kept: true, persisted: true };
  for (const invalid of [
    { ...good, profileId: "other" }, { ...good, id: "series-parent" }, { ...good, storage: "cloud-cache" },
    { ...good, kept: false }, { ...good, persisted: false }, { ...good, ok: false },
    { ...good, kept: "true" }, { ...good, fileVersion: "b".repeat(64) }, { ...good, fileVersion: "wrong" }, { ok: true }, [], null,
  ]) await assert.rejects(saveMediaRetention(writeIdentity, true, undefined, async () => Response.json(invalid)), MediaRetentionError);
  for (const invalid of [{ ...ack, id: "other" }, { ...ack, profileId: "other" }, { ...ack, storage: "remote" }, { ...ack, kept: null }, { ...ack, fileVersion: undefined }, { ...ack, fileVersion: "z".repeat(64) }]) {
    await assert.rejects(loadMediaRetention(identity, undefined, async () => Response.json(invalid)));
  }
  await assert.rejects(saveMediaRetention(writeIdentity, true, undefined, async () => Response.json(good, { status: 409 })));
  await assert.rejects(loadMediaRetention(identity, undefined, async () => new Response("offline", { status: 503 })));
  await assert.rejects(saveMediaRetention(writeIdentity, true, undefined, async () => new Response("bad json")));
});

test("invalid or missing profile/file never causes a retention write", async () => {
  let calls = 0;
  for (const invalid of [{ ...writeIdentity, id: "" }, { ...writeIdentity, expectedProfileId: "" }, { ...writeIdentity, expectedFileVersion: "" }]) {
    await assert.rejects(saveMediaRetention(invalid, true, undefined, async () => { calls += 1; return Response.json(ack); }));
  }
  assert.equal(calls, 0);
});

test("controller requires acknowledged GET and never paints keep before persistence", async () => {
  let finish: ((response: Response) => void) | undefined;
  let posts = 0;
  const controller = createMediaRetentionController({ ...identity, fetcher: async (_url, init) => {
    if (init?.method !== "POST") return Response.json(ack);
    posts += 1;
    return new Promise<Response>((resolve) => { finish = resolve; });
  } });
  assert.equal(await controller.save(true), false);
  assert.equal(posts, 0);
  assert.equal(await controller.load(), true);
  const saving = controller.save(true);
  assert.equal(controller.getState().snapshot?.kept, false);
  assert.equal(controller.getState().saving, true);
  assert.equal(await controller.save(true), false);
  assert.equal(posts, 1);
  finish!(Response.json({ ...ack, kept: true, persisted: true }));
  assert.equal(await saving, true);
  assert.equal(controller.getState().snapshot?.kept, true);
});

test("failed save retains only earlier acknowledged state; explicit reload checks before retry", async () => {
  let writes = 0;
  const controller = createMediaRetentionController({ ...identity, fetcher: async (_url, init) => {
    if (init?.method !== "POST") return Response.json(ack);
    writes += 1;
    return Response.json({ ok: false, code: "write_failed", error: "Try again" }, { status: 500 });
  } });
  await controller.load();
  assert.equal(await controller.save(true), false);
  assert.equal(controller.getState().snapshot?.kept, false);
  assert.match(controller.getState().error!, /could not be confirmed/);
  await controller.load();
  assert.equal(writes, 1);
  assert.equal(controller.getState().error, null);
});

test("disposal aborts and ignores late responses even if transport ignores cancellation", async () => {
  let finish: ((response: Response) => void) | undefined;
  let signal: AbortSignal | null | undefined;
  let changes = 0;
  const controller = createMediaRetentionController({ ...identity, onChange: () => { changes += 1; }, fetcher: async (_url, init) => {
    signal = init?.signal;
    return new Promise<Response>((resolve) => { finish = resolve; });
  } });
  const loading = controller.load();
  controller.dispose();
  assert.equal(signal?.aborted, true);
  finish!(Response.json(ack));
  assert.equal(await loading, false);
  assert.equal(changes, 1);
  assert.equal(controller.getState().snapshot, null);
  assert.equal(await controller.save(true), false);
});

test("a switched profile cannot rebind a loaded file or apply a late save", async () => {
  let current = true;
  let finish: ((response: Response) => void) | undefined;
  const controller = createMediaRetentionController({ ...identity, isCurrent: () => current, fetcher: async (_url, init) => {
    if (init?.method !== "POST") return Response.json(ack);
    assert.deepEqual(JSON.parse(String(init.body)), { ...writeIdentity, keep: true });
    return new Promise<Response>((resolve) => { finish = resolve; });
  } });
  await controller.load();
  const saving = controller.save(true);
  current = false;
  finish!(Response.json({ ...ack, kept: true, persisted: true }));
  assert.equal(await saving, false);
  assert.equal(controller.getState().snapshot?.kept, false);
  assert.equal(await controller.save(false), false);
});

test("retrying a GET invalidates prior requests and forwards abort signals", async () => {
  const pending: { finish(response: Response): void; signal: AbortSignal | null | undefined }[] = [];
  const controller = createMediaRetentionController({ ...identity, fetcher: async (_url, init) => new Promise<Response>((finish) => {
    pending.push({ finish, signal: init?.signal });
  }) });
  const old = controller.load();
  const current = controller.load();
  assert.equal(pending[0].signal?.aborted, true);
  pending[1].finish(Response.json({ ...ack, kept: true }));
  assert.equal(await current, true);
  pending[0].finish(Response.json(ack));
  assert.equal(await old, false);
  assert.equal(controller.getState().snapshot?.kept, true);
});

test("typed retention errors preserve the response status and denial code", async () => {
  await assert.rejects(saveMediaRetention(writeIdentity, false, undefined, async () =>
    Response.json({ ok: false, code: "retention_identity_changed", error: "Local file changed" }, { status: 409 })),
  (error: unknown) => {
    assert.ok(error instanceof MediaRetentionError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "retention_identity_changed");
    assert.equal(error.invalidatesSnapshot, true);
    return true;
  });
});

test("identity and source denial removes a stale kept badge and requires GET before another save", async () => {
  for (const denial of [
    { status: 401, code: "not_authenticated" }, { status: 403, code: "profile_forbidden" },
    { status: 404, code: "file_missing" }, { status: 409, code: "retention_identity_changed" },
    { status: 503, code: "retention_unavailable" },
  ]) {
    let reads = 0;
    let writes = 0;
    const nextVersion = "b".repeat(64);
    const controller = createMediaRetentionController({ ...identity, fetcher: async (_url, init) => {
      if (init?.method !== "POST") {
        reads += 1;
        return Response.json({ ...ack, kept: true, fileVersion: reads === 1 ? fileVersion : nextVersion });
      }
      writes += 1;
      if (writes === 1) return Response.json({ ok: false, code: denial.code }, { status: denial.status });
      assert.deepEqual(JSON.parse(String(init.body)), { ...identity, expectedFileVersion: nextVersion, keep: false });
      return Response.json({ ...ack, fileVersion: nextVersion, kept: false, persisted: true });
    } });
    assert.equal(await controller.load(), true);
    assert.equal(controller.getState().snapshot?.kept, true);
    assert.equal(await controller.save(false), false);
    assert.equal(controller.getState().snapshot, null, denial.code);
    assert.deepEqual(controller.getState().failure, denial);
    assert.equal(await controller.save(false), false);
    assert.equal(writes, 1, "no write may reuse the denied snapshot");
    assert.equal(await controller.load(), true);
    assert.equal(controller.getState().snapshot?.fileVersion, nextVersion);
    assert.equal(await controller.save(false), true);
    assert.equal(controller.getState().snapshot?.kept, false);
  }
});

test("mismatched file version or malformed save acknowledgement invalidates the loaded snapshot", async () => {
  for (const invalid of [
    { ...ack, fileVersion: "b".repeat(64), persisted: true },
    { ...ack, persisted: false }, { ...ack, fileVersion: undefined, persisted: true }, null,
  ]) {
    let writes = 0;
    const controller = createMediaRetentionController({ ...identity, fetcher: async (_url, init) => {
      if (init?.method !== "POST") return Response.json({ ...ack, kept: true });
      writes += 1;
      return Response.json(invalid);
    } });
    await controller.load();
    assert.equal(await controller.save(false), false);
    assert.equal(controller.getState().snapshot, null);
    assert.deepEqual(controller.getState().failure, { status: 200, code: "malformed_retention_ack" });
    assert.equal(await controller.save(false), false);
    assert.equal(writes, 1);
  }
});

test("a transient 503 without identity denial preserves the last-known state for explicit retry", async () => {
  let writes = 0;
  const controller = createMediaRetentionController({ ...identity, fetcher: async (_url, init) => {
    if (init?.method !== "POST") return Response.json(ack);
    writes += 1;
    if (writes === 1) return Response.json({ ok: false, error: "Temporarily unavailable" }, { status: 503 });
    return Response.json({ ...ack, kept: true, persisted: true });
  } });
  await controller.load();
  assert.equal(await controller.save(true), false);
  assert.equal(controller.getState().snapshot?.kept, false);
  assert.deepEqual(controller.getState().failure, { status: 503, code: "retention_request_failed" });
  assert.equal(await controller.save(true), true);
  assert.equal(controller.getState().snapshot?.kept, true);
});
