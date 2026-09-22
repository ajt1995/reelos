import assert from "node:assert/strict";
import test from "node:test";
import { createPreparationController, loadPreparation, preparedFileUrl, type PreparationJob, PreparationError } from "./preparation-client.ts";

const profileId = "owner-a";
const job: PreparationJob = { id: "11111111-1111-4111-8111-111111111111", titleId: "personal-a", title: "Personal original", recipe: "travel",
  status: "preparing", progress: 0.25, message: "Preparing the selected copy.", createdAt: 100, updatedAt: 200, canRetry: false };
const listing = { ok: true, profileId, canManage: true, recipes: [{ id: "travel", label: "Travel copy" }], jobs: [] as PreparationJob[], available: true };
const noSchedule = () => () => {};

test("preparation GET validates exact profile, recipe metadata, job identity and measured progress", async () => {
  const snapshot = await loadPreparation(profileId, undefined, async (url, init) => {
    assert.equal(url, "/api/preparation?expectedProfileId=owner-a");
    assert.equal(init?.cache, "no-store");
    return Response.json({ ...listing, jobs: [job] });
  });
  assert.equal(snapshot.jobs[0].progress, 0.25);
  for (const invalid of [
    { ...listing, profileId: "owner-b" }, { ...listing, available: false },
    { ...listing, jobs: [{ ...job, id: "not-uuid" }] }, { ...listing, jobs: [{ ...job, progress: 25 }] },
    { ...listing, jobs: [{ ...job, progress: -1 }] }, { ...listing, jobs: [job, job] },
    { ...listing, recipes: [{ id: "travel" }] }, { ok: true }, null,
  ]) await assert.rejects(loadPreparation(profileId, undefined, async () => Response.json(invalid)));
  assert.equal((await loadPreparation(profileId, undefined, async () => Response.json({ ...listing, jobs: [{ ...job, progress: null }] }))).jobs[0].progress, null);
});

test("preparing always rechecks server authority before one ID-only POST and never invents ready", async () => {
  const calls: string[] = [];
  const controller = createPreparationController({ expectedProfileId: profileId, schedule: noSchedule, fetcher: async (url, init) => {
    calls.push(init?.method || "GET");
    if (init?.method !== "POST") return Response.json(listing);
    assert.equal(url, "/api/preparation");
    assert.deepEqual(JSON.parse(String(init.body)), { expectedProfileId: profileId, titleId: job.titleId, recipe: job.recipe });
    return Response.json({ ok: true, persisted: true, profileId, job }, { status: 202 });
  } });
  await controller.refresh();
  assert.equal(await controller.prepare(job.titleId, job.recipe), true);
  assert.deepEqual(calls, ["GET", "GET", "POST"]);
  assert.equal(controller.getState().snapshot?.jobs[0].status, "preparing");
  assert.equal(preparedFileUrl(controller.getState().snapshot!.jobs[0], profileId), null);
});

test("memory-pressure deferral is accepted as retryable but never exposed as prepared playback", async () => {
  const deferred = { ...job, status: "deferred" as const, progress: null, canRetry: true,
    message: "Preparation needs more free memory. Close an unused app or try again later." };
  const controller = createPreparationController({ expectedProfileId: profileId, schedule: noSchedule, fetcher: async (_url, init) =>
    Response.json(init?.method === "POST" ? { ok: true, persisted: true, profileId, job: deferred } : listing, { status: init?.method === "POST" ? 202 : 200 }),
  });
  await controller.refresh();
  assert.equal(await controller.prepare(job.titleId, job.recipe), true);
  assert.equal(controller.getState().error, null);
  assert.equal(controller.getState().snapshot?.jobs[0].status, "deferred");
  assert.equal(controller.getState().snapshot?.jobs[0].canRetry, true);
  assert.equal(preparedFileUrl(controller.getState().snapshot!.jobs[0], profileId), null);
});

test("mutation acknowledgements require persistence and the exact requested profile, title and recipe", async () => {
  for (const invalid of [
    { ok: true, profileId, job }, { ok: true, persisted: false, profileId, job },
    { ok: true, persisted: true, profileId: "owner-b", job },
    { ok: true, persisted: true, profileId, job: { ...job, titleId: "other" } },
    { ok: true, persisted: true, profileId, job: { ...job, recipe: "other" } },
    { ok: true, persisted: true, profileId, job: { ...job, progress: 200 } },
  ]) {
    const controller = createPreparationController({ expectedProfileId: profileId, schedule: noSchedule, fetcher: async (_url, init) =>
      Response.json(init?.method === "POST" ? invalid : listing),
    });
    await controller.refresh();
    assert.equal(await controller.prepare(job.titleId, job.recipe), false);
    assert.equal(controller.getState().snapshot, null);
    assert.ok(controller.getState().error);
  }
});

test("cancel binds to the fresh job identity and retry accepts a new UUID while keeping history", async () => {
  const failed = { ...job, status: "failed" as const, canRetry: true, progress: null };
  const retried = { ...job, id: "22222222-2222-4222-8222-222222222222", progress: null };
  let sourceJob = job;
  const controller = createPreparationController({ expectedProfileId: profileId, schedule: noSchedule, fetcher: async (url, init) => {
    if (init?.method !== "POST") return Response.json({ ...listing, jobs: [sourceJob] });
    assert.deepEqual(JSON.parse(String(init.body)), { expectedProfileId: profileId });
    if (String(url).endsWith("/cancel")) return Response.json({ ok: true, persisted: true, profileId, job: { ...job, status: "cancelled", canRetry: true } });
    assert.equal(url, `/api/preparation/${job.id}/retry`);
    return Response.json({ ok: true, persisted: true, profileId, job: retried }, { status: 202 });
  } });
  await controller.refresh();
  assert.equal(await controller.cancel(job), true);
  assert.equal(controller.getState().snapshot?.jobs[0].status, "cancelled");
  sourceJob = failed;
  assert.equal(await controller.retry(failed), true);
  assert.deepEqual(controller.getState().snapshot?.jobs.map((item) => item.id), [retried.id, failed.id]);
});

test("read-only profiles and changed jobs cannot mutate after the required fresh GET", async () => {
  for (const fresh of [{ ...listing, canManage: false }, { ...listing, jobs: [{ ...job, status: "ready", progress: 1 }] }]) {
    let posts = 0;
    const controller = createPreparationController({ expectedProfileId: profileId, schedule: noSchedule, fetcher: async (_url, init) => {
      if (init?.method === "POST") posts += 1;
      return Response.json(fresh);
    } });
    assert.equal(await controller.cancel(job), false);
    assert.equal(posts, 0);
  }
});

test("pending preparation stays unready, serializes mutations and ignores switched-profile replies", async () => {
  let current = true;
  let finish: ((response: Response) => void) | undefined;
  let posted: (() => void) | undefined;
  const postStarted = new Promise<void>((resolve) => { posted = resolve; });
  const controller = createPreparationController({ expectedProfileId: profileId, isCurrent: () => current, schedule: noSchedule, fetcher: async (_url, init) => {
    if (init?.method !== "POST") return Response.json(listing);
    posted!();
    return new Promise<Response>((resolve) => { finish = resolve; });
  } });
  await controller.refresh();
  const preparing = controller.prepare(job.titleId, job.recipe);
  await postStarted;
  assert.equal(controller.getState().mutating, true);
  assert.equal(controller.getState().snapshot?.jobs.length, 0);
  assert.equal(await controller.prepare(job.titleId, job.recipe), false);
  current = false;
  finish!(Response.json({ ok: true, persisted: true, profileId, job }, { status: 202 }));
  assert.equal(await preparing, false);
  assert.equal(controller.getState().snapshot?.jobs.length, 0);
});

test("polling runs only for active visible jobs and stops on completion and disposal", async () => {
  const timers: { callback(): void; cancelled: boolean }[] = [];
  let reads = 0;
  let ready = false;
  const controller = createPreparationController({ expectedProfileId: profileId, schedule: (callback, delay) => {
    assert.equal(delay, 2_000);
    const timer = { callback, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; };
  }, fetcher: async () => {
    reads += 1;
    return Response.json({ ...listing, jobs: [{ ...job, status: ready ? "ready" : "preparing", progress: ready ? 1 : 0.25 }] });
  } });
  await controller.refresh();
  assert.equal(timers.length, 1);
  controller.setVisible(false);
  assert.equal(timers[0].cancelled, true);
  timers[0].callback();
  assert.equal(reads, 1);
  controller.setVisible(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 2);
  ready = true;
  timers.at(-1)!.callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 3);
  assert.equal(controller.getState().snapshot?.jobs[0].status, "ready");
  assert.equal(timers.length, 2);
  controller.dispose();
  timers[1].callback();
  assert.equal(reads, 3);
});

test("unmount aborts a pending read and errors support explicit retry with typed status", async () => {
  let finish: ((response: Response) => void) | undefined;
  let signal: AbortSignal | null | undefined;
  const controller = createPreparationController({ expectedProfileId: profileId, schedule: noSchedule, fetcher: async (_url, init) => {
    signal = init?.signal;
    return new Promise<Response>((resolve) => { finish = resolve; });
  } });
  const pending = controller.refresh();
  controller.dispose();
  assert.equal(signal?.aborted, true);
  finish!(Response.json(listing));
  assert.equal(await pending, false);
  assert.equal(controller.getState().snapshot, null);
  let attempts = 0;
  const retrying = createPreparationController({ expectedProfileId: profileId, schedule: noSchedule, fetcher: async () => {
    if (++attempts === 1) return Response.json({ ok: false, code: "preparation_unavailable" }, { status: 503 });
    return Response.json(listing);
  } });
  assert.equal(await retrying.refresh(), false);
  assert.equal(await retrying.refresh(), true);
  assert.equal(retrying.getState().error, null);
  await assert.rejects(loadPreparation(profileId, undefined, async () => Response.json({ ok: false, code: "child_denied" }, { status: 403 })),
    (error: unknown) => error instanceof PreparationError && error.status === 403 && error.code === "child_denied");
});

test("only an acknowledged ready job gets the profile-bound browser playback endpoint", () => {
  assert.equal(preparedFileUrl(job, profileId), null);
  assert.equal(preparedFileUrl({ ...job, status: "ready", progress: 1 }, profileId), `/api/preparation/${job.id}/file?expectedProfileId=owner-a`);
  assert.equal(preparedFileUrl({ ...job, status: "ready" }, ""), null);
});
