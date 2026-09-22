import test from "node:test";
import assert from "node:assert/strict";
import { createPlaybackFixture } from "../test-harness/playback-fixtures.mjs";
import { createMockRequest, createMockResponse } from "../test-harness/harness-utils.mjs";
import { NativeMediaRegistry } from "./native-media-registry.mjs";
import { NativeAcquisitionService } from "./native-acquisition-service.mjs";
import { CapabilityLedger } from "./capability-ledger.mjs";
import { handleNativeControlPlaneRoute } from "./native-control-plane-routes.mjs";

function fixture() {
  const who = createPlaybackFixture({ profile: { id: "owner", name: "Owner", role: "owner" } });
  const capabilityLedger = new CapabilityLedger({ stateDir: who.stateDir });
  capabilityLedger.install("taste-ranking", { scope: "person" });
  const context = {
    stateDir: who.stateDir,
    registry: new NativeMediaRegistry({ stateDir: who.stateDir }),
    acquisitions: new NativeAcquisitionService({ stateDir: who.stateDir }),
    intelligence: {
      capabilityLedger,
      governor: { snapshot: () => ({ pressure: "normal" }) },
      storage: { snapshot: () => ({ reservations: [] }) },
    },
  };
  return { who, context };
}

async function request(who, context, url, method = "GET") {
  const req = createMockRequest({ url, method, headers: { cookie: who.cookie } });
  const res = createMockResponse();
  await handleNativeControlPlaneRoute(req, res, { context });
  await res.waitForEnd();
  return res;
}

test("native control plane exposes safe library and capability projections", async () => {
  const { who, context } = fixture();
  context.registry.register({
    workId: "tmdb-10",
    editionId: "edition-10",
    title: "Visible",
    source: { id: "provider-10", kind: "provider_stream", provider: "torbox", verified: true, binding: { private: true } },
  });
  const library = await request(who, context, "/api/library");
  assert.equal(library.statusCode, 200);
  assert.equal(library.json.titles.length, 0);
  assert.equal(JSON.stringify(library.json).includes("binding"), false);
  const capabilities = await request(who, context, "/api/capabilities");
  assert.equal(capabilities.json.capabilities[0].state, "installed");
});

test("owner capability controls are idempotent and revalidate safely", async () => {
  const { who, context } = fixture();
  let result = await request(who, context, "/api/capabilities/taste-ranking/disable", "POST");
  assert.equal(result.json.capability.state, "disabled");
  result = await request(who, context, "/api/capabilities/taste-ranking/disable", "POST");
  assert.equal(result.json.capability.state, "disabled");
  result = await request(who, context, "/api/capabilities/taste-ranking/revalidate", "POST");
  assert.equal(result.json.capability.state, "validating");
});

test("prototype intelligence routes are explicitly retired", async () => {
  const req = createMockRequest({ url: "/api/neural/status", method: "GET" });
  const res = createMockResponse();
  await handleNativeControlPlaneRoute(req, res);
  await res.waitForEnd();
  assert.equal(res.statusCode, 410);
  assert.equal(res.json.code, "LEGACY_INTELLIGENCE_RETIRED");
});
