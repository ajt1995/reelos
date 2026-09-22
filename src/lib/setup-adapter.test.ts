import assert from "node:assert/strict";
import test from "node:test";
import { setupProfileWrites, saveSetupHousehold, savePublicSourceChoice } from "../experience/setup-adapter.ts";
import { completeExperienceSetup } from "../experience/profile-adapter.ts";
import type { SetupDraft } from "../experience/experience-state.ts";

const draft: SetupDraft = {
  ownerId: "owner-stable", name: "Alex", color: "#2563eb", pinEnabled: false,
  reactions: { arrival: "love" }, lessLike: ["too-loud"],
  householdMembers: [{ id: "child-stable", name: "Sam", isChild: true }],
};
const secrets = { pin: "", childExitPin: "2468" };

test("setup IDs survive retries and taste is assigned only to its owner", () => {
  const writes = setupProfileWrites(draft, secrets, []);
  assert.deepEqual(writes.map(({ profile }) => profile.id), ["owner-stable", "child-stable"]);
  assert.deepEqual(writes[0].profile.reactions, { arrival: "love" });
  assert.deepEqual(writes[0].profile.lessLikeIds, ["too-loud"]);
  assert.deepEqual(writes[1].profile.reactions, {});
  assert.equal(writes[1].pin, "2468");
  assert.deepEqual(setupProfileWrites(draft, secrets, []), writes);
});

test("partial retry preserves already saved members and does not require persisted PINs", () => {
  const saved = setupProfileWrites({ ...draft, pinEnabled: true }, { pin: "1357", childExitPin: "2468" }, [])
    .map(({ profile }) => profile);
  const retry = setupProfileWrites({ ...draft, pinEnabled: true }, { pin: "", childExitPin: "" }, saved);
  assert.equal(retry.length, 1);
  assert.equal(retry[0].pin, undefined);
});

test("new protected profiles require four numeric digits before any write", () => {
  assert.throws(() => setupProfileWrites(draft, { ...secrets, childExitPin: "abcd" }, []), /exit PIN/);
  assert.throws(() => setupProfileWrites({ ...draft, pinEnabled: true }, { ...secrets, pin: "" }, []), /four-digit PIN/);
});

test("household saves await owner authorization before saving children", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, options?: RequestInit) => {
    const payload = JSON.parse(String(options?.body));
    calls.push(payload.id);
    if (payload.id === "child-stable") assert.equal(calls[0], "owner-stable");
    return Response.json({ ok: true });
  });
  assert.deepEqual(await saveSetupHousehold(draft, secrets, []), ["owner-stable", "child-stable"]);
  assert.deepEqual(calls, ["owner-stable", "child-stable"]);
});

test("failed owner write stops the household sequence", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ ok: false, error: "Offline" }, { status: 503 }); });
  await assert.rejects(saveSetupHousehold(draft, secrets, []), /Offline/);
  assert.equal(calls, 1);
});

test("public source choice requires an explicit server acknowledgement", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  await assert.rejects(savePublicSourceChoice(), /not confirmed/);
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, debridEnabled: false }));
  await savePublicSourceChoice();
});

test("setup completion rejects optimistic or failed responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, setup: { status: "in_progress" } }));
  await assert.rejects(completeExperienceSetup(["owner-stable"]), /not confirmed/);
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, setup: { status: "complete" } }));
  await completeExperienceSetup(["owner-stable"]);
});
