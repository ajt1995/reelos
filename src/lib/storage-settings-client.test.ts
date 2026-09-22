import assert from "node:assert/strict";
import test from "node:test";
import {
  createStorageSettingsController, loadStorageSettings, saveStorageSettings,
  automaticStorageAllowanceBytes, maximumFixedStorageGb, StorageSettingsError, type StorageSettingsSnapshot,
} from "./storage-settings-client.ts";

const GiB = 2 ** 30;
const snapshot: StorageSettingsSnapshot = {
  profileId: "owner-a", revision: "revision-a",
  strategy: { mode: "smart_hybrid", storageAllocation: "dynamic_20", allocatedGb: 20,
    autoDownloadFavorites: true, autoDownloadWatchlist: false, autoDownloadCabinVault: false },
  storage: { ok: true, available: true, totalBytes: 100 * GiB, freeBytes: 60 * GiB, totalGb: 100, freeGb: 60, dynamic20Gb: 12 },
  budget: { available: true, limitBytes: 12 * GiB, protectedFreeBytes: 5 * GiB, usedBytes: 2 * GiB, reservedBytes: GiB, remainingBytes: 9 * GiB },
  preparation: { available: false, reason: "Automatic preparation is not connected yet." }, canEdit: true,
};
const ack = { ok: true, ...snapshot };
const patch = { storageAllocation: "fixed" as const, allocatedGb: 15 };
const savedAck = { ...ack, persisted: true, revision: "revision-b", strategy: { ...snapshot.strategy, ...patch } };

test("storage GET uses server session and POST sends acknowledged profile and revision", async () => {
  const loaded = await loadStorageSettings("owner-a", undefined, async (url, init) => {
    assert.equal(url, "/api/strategy");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.body, undefined);
    return Response.json(ack);
  });
  assert.deepEqual(loaded, snapshot);
  const saved = await saveStorageSettings(loaded, { ...patch, invented: "ignored" } as typeof patch, undefined, async (url, init) => {
    assert.equal(url, "/api/strategy");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { expectedProfileId: "owner-a", expectedRevision: "revision-a", ...patch });
    return Response.json(savedAck);
  });
  assert.equal(saved.revision, "revision-b");
  assert.equal(saved.strategy.allocatedGb, 15);
});

test("storage save requires exact preference echo, identity, revision and durable acknowledgement", async () => {
  for (const invalid of [
    { ...savedAck, persisted: false }, { ...savedAck, profileId: "owner-b" }, { ...savedAck, revision: "" },
    { ...savedAck, canEdit: false }, { ...savedAck, strategy: snapshot.strategy },
    { ...savedAck, storage: { ok: false, available: false } },
    { ...savedAck, budget: { ...snapshot.budget, reservedBytes: -1 } },
    { ...savedAck, storage: { ...snapshot.storage, freeBytes: Infinity } },
    null, [], { ok: true },
  ]) await assert.rejects(saveStorageSettings(snapshot, patch, undefined, async () => Response.json(invalid)), StorageSettingsError);
  await assert.rejects(loadStorageSettings("owner-b", undefined, async () => Response.json(ack)));
  await assert.rejects(saveStorageSettings(snapshot, patch, undefined, async () => new Response("invalid json")));
});

test("unavailable measurements remain unknown and cannot enable writes; members are read-only", async () => {
  const unavailable = { ...snapshot, storage: { ok: false, available: false, totalBytes: null, freeBytes: null }, budget: { available: false }, canEdit: true };
  const loaded = await loadStorageSettings("owner-a", undefined, async () => Response.json({ ok: true, ...unavailable }));
  assert.equal(loaded.storage.totalBytes, null);
  assert.equal(loaded.budget.remainingBytes, undefined);
  assert.equal(maximumFixedStorageGb(loaded), 0);
  let writes = 0;
  for (const denied of [loaded, { ...snapshot, canEdit: false }]) {
    await assert.rejects(saveStorageSettings(denied, patch, undefined, async () => { writes += 1; return Response.json(savedAck); }));
  }
  assert.equal(writes, 0);
  assert.equal(maximumFixedStorageGb(snapshot), 95);
  assert.equal(maximumFixedStorageGb({ ...snapshot, budget: { ...snapshot.budget, protectedFreeBytes: 5.2 * GiB } }), 94);
});

test("invalid strategy values never issue a write", async () => {
  let writes = 0;
  for (const invalid of [{ allocatedGb: -1 }, { allocatedGb: NaN }, { mode: "invented" }, {}]) {
    await assert.rejects(saveStorageSettings(snapshot, invalid as typeof patch, undefined, async () => { writes += 1; return Response.json(savedAck); }));
  }
  assert.equal(writes, 0);
});

test("pending saves remain unacknowledged and concurrent saves are blocked", async () => {
  let finish: ((response: Response) => void) | undefined;
  let writes = 0;
  const controller = createStorageSettingsController({ expectedProfileId: "owner-a", fetcher: async (_url, init) => {
    if (init?.method !== "POST") return Response.json(ack);
    writes += 1;
    return new Promise<Response>((resolve) => { finish = resolve; });
  } });
  assert.equal(await controller.save(patch), false);
  await controller.load();
  const pending = controller.save(patch);
  assert.equal(controller.getState().snapshot?.strategy.allocatedGb, 20);
  assert.equal(controller.getState().saved, false);
  assert.equal(await controller.save(patch), false);
  assert.equal(writes, 1);
  finish!(Response.json(savedAck));
  assert.equal(await pending, true);
  assert.equal(controller.getState().saved, true);
  assert.equal(controller.getState().snapshot?.strategy.allocatedGb, 15);
});

test("stale revisions require explicit GET retry and the next save binds to the new revision", async () => {
  let reads = 0;
  let writes = 0;
  const controller = createStorageSettingsController({ expectedProfileId: "owner-a", fetcher: async (_url, init) => {
    if (init?.method !== "POST") { reads += 1; return Response.json({ ...ack, revision: reads === 1 ? "revision-a" : "revision-new" }); }
    writes += 1;
    if (writes === 1) return Response.json({ ok: false, code: "strategy_changed", error: "Settings changed. Reload them." }, { status: 409 });
    assert.equal(JSON.parse(String(init.body)).expectedRevision, "revision-new");
    return Response.json(savedAck);
  } });
  await controller.load();
  assert.equal(await controller.save(patch), false);
  assert.equal(controller.getState().snapshot, null);
  assert.equal(controller.getState().saved, false);
  assert.equal(await controller.save(patch), false);
  assert.equal(writes, 1);
  await controller.load();
  assert.equal(await controller.save(patch), true);
});

test("profile changes and disposal ignore old responses even when transport ignores abort", async () => {
  for (const change of ["profile", "dispose"] as const) {
    let current = true;
    let finish: ((response: Response) => void) | undefined;
    let signal: AbortSignal | null | undefined;
    const controller = createStorageSettingsController({ expectedProfileId: "owner-a", isCurrent: () => current, fetcher: async (_url, init) => {
      signal = init?.signal;
      return new Promise<Response>((resolve) => { finish = resolve; });
    } });
    const loading = controller.load();
    if (change === "profile") current = false;
    else controller.dispose();
    if (change === "dispose") assert.equal(signal?.aborted, true);
    finish!(Response.json(ack));
    assert.equal(await loading, false);
    assert.equal(controller.getState().snapshot, null);
    assert.equal(await controller.save(patch), false);
  }
});

test("load failures can be retried and response errors retain typed status and code", async () => {
  let attempts = 0;
  const controller = createStorageSettingsController({ expectedProfileId: "owner-a", fetcher: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("offline");
    return Response.json(ack);
  } });
  assert.equal(await controller.load(), false);
  assert.equal(controller.getState().snapshot, null);
  assert.equal(await controller.load(), true);
  assert.equal(controller.getState().error, null);
  await assert.rejects(loadStorageSettings("owner-a", undefined, async () => Response.json({ ok: false, code: "child_denied" }, { status: 403 })),
    (error: unknown) => error instanceof StorageSettingsError && error.status === 403 && error.code === "child_denied");
});

test("automatic allowance stays unavailable when disk is measured but budget is not", () => {
  assert.equal(automaticStorageAllowanceBytes(snapshot), 12 * GiB);
  assert.equal(automaticStorageAllowanceBytes({ ...snapshot, budget: { available: false } }), null);
  assert.equal(automaticStorageAllowanceBytes({ ...snapshot, storage: { ...snapshot.storage, ok: false } }), null);
  assert.equal(automaticStorageAllowanceBytes({ ...snapshot, storage: { ...snapshot.storage, dynamic20Gb: null } }), null);
});

test("explicit storage-unavailable save failure clears old measurements and requires a fresh GET", async () => {
  let reads = 0;
  let writes = 0;
  const controller = createStorageSettingsController({ expectedProfileId: "owner-a", fetcher: async (_url, init) => {
    if (init?.method !== "POST") { reads += 1; return Response.json(ack); }
    writes += 1;
    if (writes === 1) return Response.json({ ok: false, code: "storage_unavailable", error: "Storage cannot be measured." }, { status: 503 });
    return Response.json(savedAck);
  } });
  await controller.load();
  assert.equal(await controller.save(patch), false);
  assert.equal(controller.getState().snapshot, null);
  assert.equal(controller.getState().saved, false);
  assert.equal(await controller.save(patch), false);
  assert.equal(writes, 1);
  assert.equal(await controller.load(), true);
  assert.equal(reads, 2);
  assert.equal(await controller.save(patch), true);
});

test("generic transient 503 preserves the earlier acknowledgement for an explicit retry", async () => {
  let writes = 0;
  const controller = createStorageSettingsController({ expectedProfileId: "owner-a", fetcher: async (_url, init) => {
    if (init?.method !== "POST") return Response.json(ack);
    writes += 1;
    if (writes === 1) return Response.json({ ok: false, error: "Temporary write failure" }, { status: 503 });
    return Response.json(savedAck);
  } });
  await controller.load();
  assert.equal(await controller.save(patch), false);
  assert.equal(controller.getState().snapshot?.revision, "revision-a");
  assert.equal(controller.getState().saved, false);
  assert.equal(await controller.save(patch), true);
});
