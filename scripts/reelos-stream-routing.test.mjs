import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createPlaybackFixture } from "./test-harness/playback-fixtures.mjs";
import { createMockRequest, createMockResponse } from "./test-harness/harness-utils.mjs";
import { saveProfile } from "./services/profile-service.mjs";

test("development stream and media routes preserve authorization, privacy, byte ranges and legacy prefetch routes", async () => {
  const household = createPlaybackFixture();
  const previousState = process.env.REELOS_STATE;
  const previousProfiles = process.env.REELOS_PROFILES_DIR;
  process.env.REELOS_STATE = household.stateDir;
  process.env.REELOS_PROFILES_DIR = household.profilesDir;
  try {
    const { dispatchReelOsApi, readProvisioningMarkers } = await import("./reelos-lookup-plugin.mjs");
    const unrelatedCwd = path.join(household.stateDir, "unrelated-workspace");
    const unrelatedState = path.join(unrelatedCwd, ".reelos-state");
    const isolatedState = path.join(household.stateDir, "isolated-markers");
    fs.mkdirSync(unrelatedState, { recursive: true });
    fs.mkdirSync(isolatedState);
    for (const marker of ["provisioned", "provisioning", "provision.error"]) {
      fs.writeFileSync(path.join(unrelatedState, marker), "Unrelated installation");
    }
    assert.deepEqual(readProvisioningMarkers({ stateDir: isolatedState, cwd: unrelatedCwd }), {
      provisioned: false, provisioning: false, provisionError: "",
    }, "Explicit state must not inherit working-directory markers");
    fs.writeFileSync(path.join(isolatedState, "provisioned"), "1\n");
    fs.writeFileSync(path.join(isolatedState, "provisioning"), "1\n");
    fs.writeFileSync(path.join(isolatedState, "provision.error"), "Isolated test error\n");
    assert.deepEqual(readProvisioningMarkers({ stateDir: isolatedState, cwd: unrelatedCwd }), {
      provisioned: true, provisioning: true, provisionError: "Isolated test error",
    });
    assert.equal(readProvisioningMarkers({ stateDir: "", cwd: unrelatedCwd }).provisioned, true,
      "An unset state directory retains the legacy working-directory fallback");
    const request = async (url, { cookie, method = "GET", range } = {}) => {
      const req = createMockRequest({ url, method, headers: {
        host: "127.0.0.1", ...(cookie ? { cookie } : {}), ...(range ? { range } : {}),
      } });
      const res = createMockResponse();
      assert.equal(await dispatchReelOsApi(req, res), true, `${url} must not fall through to the app`);
      await res.waitForEnd();
      return res;
    };
    for (const target of ["", "/sample", "/public/night-of-the-living-dead-1968", "/item/local-title"]) {
      for (const method of ["GET", "HEAD"]) {
        const res = await request(`/api/stream${target}`, { method, range: "bytes=0-3" });
        assert.equal(res.statusCode, 401);
        assert.equal(res.getHeader("content-range"), undefined);
      }
    }
    const deviceOnly = household.cookie.split(";")[0];
    const noProfile = await request("/api/stream/public/night-of-the-living-dead-1968", { cookie: deviceOnly });
    assert.equal(noProfile.statusCode, 401);
    assert.equal(noProfile.json.code, "profile_auth_required");

    const file = path.join(household.stateDir, "public-domain-fixture.mp4");
    fs.writeFileSync(file, Buffer.from("isolated-public-domain-byte-fixture"));
    household.writeLibrary([{ id: "local-title", path: file, sourceKind: "public_domain", OfficialRating: "G" }]);
    const bytes = await request("/api/stream/item/local-title", { cookie: household.cookie, range: "bytes=9-14" });
    assert.equal(bytes.statusCode, 206);
    assert.equal(bytes.body.toString(), "public");
    assert.equal(bytes.getHeader("cache-control"), "private, no-store");
    const head = await request("/api/stream/item/local-title", { cookie: household.cookie, method: "HEAD", range: "bytes=9-14" });
    assert.equal(head.statusCode, 206);
    assert.equal(head.body.length, 0);

    household.writeLibrary([]);
    assert.equal((await request("/api/stream/item/local-title", { cookie: household.cookie })).statusCode, 404);
    for (const legacy of ["prefetch-status", "prefetch-purge"]) {
      const res = await request(`/api/stream/${legacy}`, { cookie: household.cookie });
      assert.equal(res.statusCode, 200, `${legacy} retains its existing handler`);
    }

    const personal = { id: "personal-title", ids: ["personal-alias"], path: file,
      sourceKind: "personal_import", OfficialRating: "R",
      sourceUri: "https://private.invalid/movie?token=secret-source-token" };
    household.writeLibrary([personal]);
    saveProfile({ id: "adult", name: "Adult", progress: { "personal-title": 0.25 } }, household.profilesDir);
    saveProfile({ id: "other", name: "Private Other", progress: { "personal-title": 0.8 } }, household.profilesDir);
    for (const suffix of ["sources", "intro-timestamps"]) {
      assert.equal((await request(`/api/media/personal-title/${suffix}`)).statusCode, 401);
      const noProfileMetadata = await request(`/api/media/personal-title/${suffix}`, { cookie: deviceOnly });
      assert.equal(noProfileMetadata.statusCode, 401);
      assert.equal(noProfileMetadata.json.code, "profile_auth_required");
      assert.equal(noProfileMetadata.getHeader("cache-control"), "private, no-store");
      assert.equal((await request(`/api/media/personal-title/${suffix}`, { cookie: household.cookie, method: "POST" })).statusCode, 405);
      assert.equal((await request(`/api/media/not-registered/${suffix}`, { cookie: household.cookie })).statusCode, 404);
    }
    const metadata = await request("/api/media/personal-alias/sources", { cookie: household.cookie });
    assert.equal(metadata.statusCode, 200);
    assert.equal(metadata.getHeader("cache-control"), "private, no-store");
    assert.equal(metadata.json.available, true);
    assert.equal(metadata.json.directPlayReady, false);
    assert.equal(metadata.json.resumeProgress, 0.25);
    assert.equal(metadata.json.activeProfileId, "adult");
    assert.equal(metadata.json.progressTitleId, "personal-title");
    assert.equal(metadata.json.sources[0].streamUrl, "/api/stream/item/personal-title");
    assert.equal(metadata.json.sources[0].compatibility, "unverified");
    assert.equal(metadata.json.sources[0].path, undefined);
    assert.equal(metadata.json.recommendedForBrowser?.streamUrl, "/api/stream/item/personal-title");
    assert.equal(metadata.json.recommendedForBrowser?.compatibility, "unverified");
    assert.equal(metadata.json.recommendedForBrowser?.directPlayReady, false);
    assert(!metadata.body.toString().includes(file));
    assert(!metadata.body.toString().includes("secret-source-token"));
    assert(!metadata.body.toString().includes("Private Other"));
    assert.equal((await request(metadata.json.sources[0].streamUrl, { cookie: household.cookie, range: "bytes=0-3" })).statusCode, 206);
    const intro = await request("/api/media/personal-title/intro-timestamps", { cookie: household.cookie });
    assert.equal(intro.statusCode, 200);
    assert.equal(intro.json.hasIntro, false);
    assert.equal(intro.json.status, "unavailable");
    assert.equal(intro.getHeader("cache-control"), "private, no-store");
    saveProfile({ id: "adult", name: "Adult", progress: { "personal-title": 7 } }, household.profilesDir);
    assert.equal((await request("/api/media/personal-title/sources", { cookie: household.cookie })).json.resumeProgress, 1);
    saveProfile({ id: "adult", name: "Child", isKids: true, maturity: "little", pin: "2468" }, household.profilesDir);
    for (const suffix of ["sources", "intro-timestamps"]) {
      const deniedChild = await request(`/api/media/personal-title/${suffix}`, { cookie: household.cookie });
      assert.equal(deniedChild.statusCode, 403);
      assert.equal(deniedChild.json.code, "family_title_denied");
    }
    saveProfile({ id: "adult", name: "Adult", isKids: false }, household.profilesDir);
    household.writeLibrary([{ ...personal, sourceKind: "debrid" }]);
    assert.equal((await request("/api/media/personal-title/sources", { cookie: household.cookie })).statusCode, 403);
    household.writeLibrary([{ ...personal, path: `${file}.missing.mp4` }]);
    const missing = await request("/api/media/personal-title/sources", { cookie: household.cookie });
    assert.equal(missing.json.available, false);
    assert.deepEqual(missing.json.sources, []);
    household.writeLibrary([personal, { ...personal, id: "different-title", ids: ["personal-alias"] }]);
    assert.equal((await request("/api/media/personal-alias/sources", { cookie: household.cookie })).statusCode, 404);
  } finally {
    if (previousState === undefined) delete process.env.REELOS_STATE;
    else process.env.REELOS_STATE = previousState;
    if (previousProfiles === undefined) delete process.env.REELOS_PROFILES_DIR;
    else process.env.REELOS_PROFILES_DIR = previousProfiles;
  }
});
