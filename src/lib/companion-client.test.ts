import assert from "node:assert/strict";
import { test } from "node:test";
import {
  companionProgress,
  companionSeekTicks,
  loadActiveCompanionState,
  loadCompanionDossier,
  queueCompanionCommand,
  type CompanionSession,
} from "../experience/companion-client.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("Companion projects real session timing instead of invented remaining time", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const state = await loadActiveCompanionState(undefined, (async (url, init) => {
    requestUrl = String(url);
    requestInit = init;
    return jsonResponse({
      ok: true,
      active: true,
      session: {
        active: true,
        sessionId: "living-room",
        titleName: "Verified title",
        positionTicks: 1_200_000_000,
        durationTicks: 3_000_000_000,
        isPaused: true,
      },
      dossier: {
        available: false,
        title: "Verified title",
        storySoFar: [],
        whoIsWho: [],
        whisperNotes: [],
        spoilerShield: { active: false },
      },
    });
  }) as typeof fetch);

  assert.equal(requestUrl, "/api/companion/active");
  assert.equal(requestInit?.credentials, "same-origin");
  assert.equal(requestInit?.cache, "no-store");
  assert.equal(state.active, true);
  assert.equal(state.session?.isPaused, true);
  assert.deepEqual(companionProgress(state.session), {
    positionSeconds: 120,
    durationSeconds: 300,
    remainingMinutes: 3,
  });
  assert.equal(state.dossier?.available, false);
  assert.equal(state.dossier?.spoilerShield.active, false);
});

test("Companion timing is honest when duration is not reported", () => {
  const session: CompanionSession = {
    active: true,
    sessionId: "tv",
    positionTicks: 900_000_000,
    durationTicks: 0,
    isPaused: false,
  };
  assert.deepEqual(companionProgress(session), {
    positionSeconds: 90,
    durationSeconds: 0,
    remainingMinutes: null,
  });
  assert.equal(companionSeekTicks(-10), -100_000_000);
  assert.equal(companionSeekTicks(10), 100_000_000);
});

test("A deep-link dossier remains unavailable unless the service has verified evidence", async () => {
  const dossier = await loadCompanionDossier(
    "series-one",
    2,
    4,
    undefined,
    (async (url) => {
      assert.equal(String(url), "/api/companion/series-one?season=2&episode=4");
      return jsonResponse({
        ok: true,
        dossier: {
          available: false,
          message: "Verified companion context is not available for this title yet.",
          title: "Series One",
          season: 2,
          episode: 4,
          storySoFar: [],
          whoIsWho: [],
          whisperNotes: [],
          spoilerShield: { active: false },
        },
      });
    }) as typeof fetch,
  );
  assert.equal(dossier?.available, false);
  assert.deepEqual(dossier?.storySoFar, []);
  assert.equal(dossier?.spoilerShield.futureLoreBlocked, false);
});

test("Remote commands target the authenticated active session and preserve ten-second ticks", async () => {
  let sent: Record<string, unknown> | null = null;
  const id = await queueCompanionCommand(
    "living-room",
    "seek",
    { deltaTicks: companionSeekTicks(-10) },
    (async (_url, init) => {
      assert.equal(init?.credentials, "same-origin");
      sent = JSON.parse(String(init?.body));
      return jsonResponse({ ok: true, command: { id: "cmd-one" } });
    }) as typeof fetch,
  );
  assert.equal(id, "cmd-one");
  assert.deepEqual(sent, {
    sessionId: "living-room",
    action: "seek",
    payload: { deltaTicks: -100_000_000 },
  });
});

test("A stale remote target is surfaced instead of pretending control succeeded", async () => {
  await assert.rejects(
    queueCompanionCommand(
      "old-session",
      "pause",
      {},
      (async () => jsonResponse({ ok: false }, 409)) as typeof fetch,
    ),
    /session has ended/i,
  );
});
