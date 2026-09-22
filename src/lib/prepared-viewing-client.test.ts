import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedViewingController, postPreparedViewing, type PreparedViewingAction } from "./prepared-viewing-client.ts";

const identity = { profileId: "owner-a", jobId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222" };
const ack = (action: PreparedViewingAction, expiresAt = 61_000) => ({ ok: true, ...identity, action, expiresAt: action === "stop" ? null : expiresAt });
const noSchedule = () => () => {};

test("prepared viewing sends exact captured identity and keepalive stop without persistence claims", async () => {
  for (const action of ["start", "heartbeat", "stop"] as const) {
    await postPreparedViewing(identity, action, { now: () => 1_000, fetcher: async (url, init) => {
      assert.equal(url, `/api/preparation/${identity.jobId}/viewing`);
      assert.deepEqual(JSON.parse(String(init?.body)), { expectedProfileId: identity.profileId, sessionId: identity.sessionId, action });
      assert.equal(init?.keepalive, action === "stop");
      return Response.json(ack(action));
    } });
  }
});

test("viewing rejects wrong identity, action, expired/malformed acknowledgement and non-200 responses", async () => {
  for (const invalid of [
    { ...ack("start"), profileId: "owner-b" }, { ...ack("start"), jobId: "other" },
    { ...ack("start"), sessionId: "other" }, { ...ack("start"), action: "heartbeat" },
    { ...ack("start"), expiresAt: 1_000 }, { ...ack("start"), expiresAt: null },
    { ...ack("start"), expiresAt: "61000" }, { ...ack("start"), ok: false }, {}, null,
  ]) await assert.rejects(postPreparedViewing(identity, "start", { now: () => 1_000, fetcher: async () => Response.json(invalid) }));
  for (const status of [201, 401, 403, 409, 503]) {
    await assert.rejects(postPreparedViewing(identity, "start", { now: () => 1_000, fetcher: async () => Response.json(ack("start"), { status }) }));
  }
  await assert.rejects(postPreparedViewing(identity, "stop", { fetcher: async () => Response.json({ ...ack("stop"), expiresAt: 61_000 }) }));
});

test("native playback gate stays starting until start is acknowledged", async () => {
  let finish: ((response: Response) => void) | undefined;
  const controller = createPreparedViewingController({ ...identity, now: () => 1_000, schedule: noSchedule, fetcher: async (_url, init) => {
    const action = JSON.parse(String(init?.body)).action;
    if (action === "start") return new Promise<Response>((resolve) => { finish = resolve; });
    return Response.json(ack(action));
  } });
  const opening = controller.start();
  assert.equal(controller.getState().status, "starting");
  finish!(Response.json(ack("start")));
  assert.equal(await opening, true);
  assert.equal(controller.getState().status, "active");
  await controller.dispose();
});

test("start failure never opens playback and remains recoverable with a new session", async () => {
  const controller = createPreparedViewingController({ ...identity, now: () => 1_000, schedule: noSchedule, fetcher: async () => Response.json({ ok: false }, { status: 503 }) });
  assert.equal(await controller.start(), false);
  assert.equal(controller.getState().status, "error");
  assert.match(controller.getState().error!, /Play prepared copy/);
  await controller.dispose();
});

test("unmount during pending start waits for its reply then sends exactly one keepalive stop", async () => {
  let finish: ((response: Response) => void) | undefined;
  const actions: string[] = [];
  const published: string[] = [];
  const controller = createPreparedViewingController({ ...identity, now: () => 1_000, schedule: noSchedule, onChange: (state) => published.push(state.status), fetcher: async (_url, init) => {
    const action = JSON.parse(String(init?.body)).action;
    actions.push(action);
    if (action === "start") return new Promise<Response>((resolve) => { finish = resolve; });
    assert.equal(init?.keepalive, true);
    return Response.json(ack(action));
  } });
  const opening = controller.start();
  const cleanup = controller.dispose();
  assert.deepEqual(actions, ["start"]);
  finish!(Response.json(ack("start")));
  assert.equal(await opening, false);
  await cleanup;
  await controller.dispose();
  assert.deepEqual(actions, ["start", "stop"]);
  assert.deepEqual(published, ["starting"]);
});

test("a switched profile cannot activate a late start or rebind the stop identity", async () => {
  let current = true;
  let finish: ((response: Response) => void) | undefined;
  let stops = 0;
  const controller = createPreparedViewingController({ ...identity, isCurrent: () => current, now: () => 1_000, schedule: noSchedule, fetcher: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.action === "start") return new Promise<Response>((resolve) => { finish = resolve; });
    assert.equal(body.expectedProfileId, identity.profileId);
    assert.equal(body.sessionId, identity.sessionId);
    stops += 1;
    return Response.json(ack(body.action));
  } });
  const opening = controller.start();
  current = false;
  finish!(Response.json(ack("start")));
  assert.equal(await opening, false);
  assert.equal(controller.getState().status, "stopped");
  assert.equal(stops, 1);
});

test("heartbeats are serial and keep protecting paused or buffered mounted playback", async () => {
  const timers: { callback(): void; delay: number; cancelled: boolean }[] = [];
  let finish: ((response: Response) => void) | undefined;
  let heartbeats = 0;
  let now = 1_000;
  const controller = createPreparedViewingController({ ...identity, now: () => now, schedule: (callback, delay) => {
    const timer = { callback, delay, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; };
  }, fetcher: async (_url, init) => {
    const action = JSON.parse(String(init?.body)).action;
    if (action === "heartbeat") { heartbeats += 1; return new Promise<Response>((resolve) => { finish = resolve; }); }
    return Response.json(ack(action));
  } });
  await controller.start();
  assert.equal(timers.find((timer) => timer.delay === 15_000)?.cancelled, false);
  now = 16_000;
  const heartbeat = controller.heartbeat();
  assert.equal(await controller.heartbeat(), false);
  assert.equal(heartbeats, 1);
  finish!(Response.json(ack("heartbeat", 76_000)));
  assert.equal(await heartbeat, true);
  assert.equal(controller.getState().status, "active");
  assert.equal(timers.filter((timer) => !timer.cancelled && timer.delay === 15_000).length, 1);
  // Even queued callbacks belonging to the old deadline cannot expire a renewed lease.
  now = 61_000;
  timers[0].callback();
  assert.equal(controller.getState().status, "active");
  await controller.stop();
  assert.ok(timers.every((timer) => timer.cancelled));
});

test("heartbeat denial removes playback immediately and sends stop", async () => {
  const actions: string[] = [];
  const controller = createPreparedViewingController({ ...identity, now: () => 1_000, schedule: noSchedule, fetcher: async (_url, init) => {
    const action = JSON.parse(String(init?.body)).action;
    actions.push(action);
    if (action === "heartbeat") return Response.json({ ok: false, code: "viewing_session_expired" }, { status: 409 });
    return Response.json(ack(action));
  } });
  await controller.start();
  assert.equal(await controller.heartbeat(), false);
  assert.equal(controller.getState().status, "error");
  await controller.stop();
  assert.deepEqual(actions, ["start", "heartbeat", "stop"]);
});

test("the lease deadline stops playback even while a heartbeat is still pending", async () => {
  const timers: { callback(): void; delay: number }[] = [];
  let now = 1_000;
  let finish: ((response: Response) => void) | undefined;
  const actions: string[] = [];
  const controller = createPreparedViewingController({ ...identity, now: () => now, schedule: (callback, delay) => { timers.push({ callback, delay }); return () => {}; }, fetcher: async (_url, init) => {
    const action = JSON.parse(String(init?.body)).action;
    actions.push(action);
    if (action === "heartbeat") return new Promise<Response>((resolve) => { finish = resolve; });
    return Response.json(ack(action));
  } });
  await controller.start();
  const heartbeat = controller.heartbeat();
  now = 61_000;
  timers.find((timer) => timer.delay === 60_000)!.callback();
  assert.equal(controller.getState().status, "error");
  assert.deepEqual(actions, ["start", "heartbeat"]);
  finish!(Response.json(ack("heartbeat", 121_000)));
  assert.equal(await heartbeat, false);
  await controller.stop();
  assert.deepEqual(actions, ["start", "heartbeat", "stop"]);
  assert.equal(controller.getState().status, "error");
});
