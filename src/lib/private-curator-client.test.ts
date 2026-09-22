import assert from "node:assert/strict";
import test from "node:test";
import { loadPrivateCurator, savePrivateCuratorVote } from "./private-curator-client.ts";

const snapshot = { ok: true, profileId: "person-a", liked: ["movie-a"], hidden: ["movie-b"] };
const vote = { id: "movie-a", vote: "comfort" as const, expectedProfileId: "person-a" };

test("curator GET uses session authority and validates canonical profile identity", async () => {
  const result = await loadPrivateCurator("person-a", undefined, async (url, init) => {
    assert.equal(url, "/api/curator");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.body, undefined);
    return Response.json(snapshot);
  });
  assert.deepEqual(result, { profileId: "person-a", liked: ["movie-a"], hidden: ["movie-b"] });
  await assert.rejects(loadPrivateCurator("person-b", undefined, async () => Response.json(snapshot)));
});

test("curator vote sends one acknowledged request with one id and preserves comfort", async () => {
  let calls = 0;
  const result = await savePrivateCuratorVote({ ...vote, ids: ["alias-a", "alias-b"], jellyfinId: "alias-c" } as typeof vote,
    undefined, async (url, init) => {
      calls += 1;
      assert.equal(url, "/api/curator");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), vote);
      return Response.json({ ...snapshot, persisted: true });
    });
  assert.equal(calls, 1);
  assert.deepEqual(result.liked, ["movie-a"]);
});

test("curator rejects malformed, unpersisted and wrong-profile acknowledgements", async () => {
  for (const invalid of [
    { ...snapshot, persisted: false }, snapshot,
    { ...snapshot, persisted: true, profileId: "person-b" },
    { ...snapshot, persisted: true, liked: [123] },
    { ...snapshot, persisted: true, hidden: null },
    { ...snapshot, persisted: true, liked: [""] },
    { ...snapshot, persisted: true, ok: false },
    null, [], "saved", { ok: true, persisted: true },
  ]) {
    await assert.rejects(savePrivateCuratorVote(vote, undefined, async () => Response.json(invalid)));
  }
  for (const status of [201, 400, 401, 403, 409, 500, 503]) {
    await assert.rejects(savePrivateCuratorVote(vote, undefined, async () => Response.json({ ...snapshot, persisted: true }, { status })));
  }
  await assert.rejects(savePrivateCuratorVote(vote, undefined, async () => new Response("invalid json")));
  await assert.rejects(savePrivateCuratorVote(vote, undefined, async () => { throw new Error("offline"); }));
});

test("curator GET fails closed for malformed data and HTTP errors", async () => {
  for (const invalid of [{ ...snapshot, ok: false }, { ...snapshot, liked: null }, { ...snapshot, hidden: [false] }, {}]) {
    await assert.rejects(loadPrivateCurator("person-a", undefined, async () => Response.json(invalid)));
  }
  await assert.rejects(loadPrivateCurator("person-a", undefined, async () => Response.json(snapshot, { status: 403 })));
  await assert.rejects(loadPrivateCurator("person-a", undefined, async () => new Response("invalid json")));
  await assert.rejects(loadPrivateCurator("person-a", undefined, async () => { throw new Error("offline"); }));
});

test("every supported vote, including none, uses the same single persistence endpoint", async () => {
  for (const value of ["like", "dislike", "comfort", "none"] as const) {
    let calls = 0;
    await savePrivateCuratorVote({ ...vote, vote: value }, undefined, async (url, init) => {
      calls += 1;
      assert.equal(url, "/api/curator");
      assert.equal(JSON.parse(String(init?.body)).vote, value);
      return Response.json({ ...snapshot, persisted: true });
    });
    assert.equal(calls, 1);
  }
});

test("invalid vote input cannot write and cancellation signals reach both transports", async () => {
  let calls = 0;
  for (const invalid of [{ ...vote, id: "" }, { ...vote, expectedProfileId: "" }, { ...vote, vote: "love" }]) {
    await assert.rejects(savePrivateCuratorVote(invalid as typeof vote, undefined, async () => {
      calls += 1;
      return Response.json({ ...snapshot, persisted: true });
    }));
  }
  assert.equal(calls, 0);
  const controller = new AbortController();
  await loadPrivateCurator("person-a", controller.signal, async (_url, init) => {
    assert.equal(init?.signal, controller.signal);
    return Response.json(snapshot);
  });
  await savePrivateCuratorVote(vote, controller.signal, async (_url, init) => {
    assert.equal(init?.signal, controller.signal);
    return Response.json({ ...snapshot, persisted: true });
  });
});
