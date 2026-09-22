import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  JF_AUTH,
  jellyfinAuthedHeaders,
  xmlSetTag,
  seedJellyfinEncodingXml,
  seedJellyfinNetworkXml,
  jellyfinTokens,
} from "./jellyfin-service.mjs";

test("Jellyfin Service: generates compliant auth headers", () => {
  const headersWithoutToken = jellyfinAuthedHeaders();
  assert.equal(headersWithoutToken.Authorization, JF_AUTH);
  assert.equal(headersWithoutToken["X-Emby-Authorization"], JF_AUTH);
  assert.equal(headersWithoutToken["X-Emby-Token"], undefined);

  const testToken = "test-token-12345";
  const headersWithToken = jellyfinAuthedHeaders(testToken);
  assert.equal(headersWithToken.Authorization, `${JF_AUTH}, Token="${testToken}"`);
  assert.equal(headersWithToken["X-Emby-Authorization"], `${JF_AUTH}, Token="${testToken}"`);
  assert.equal(headersWithToken["X-Emby-Token"], testToken);
});

test("Jellyfin Service: xmlSetTag modifies existing XML tags and adds missing tags", () => {
  const xml = "<EncodingOptions><HardwareAccelerationType>none</HardwareAccelerationType></EncodingOptions>";
  const updated = xmlSetTag(xml, "HardwareAccelerationType", "vaapi");
  assert.match(updated, /<HardwareAccelerationType>vaapi<\/HardwareAccelerationType>/);

  const appended = xmlSetTag(updated, "EnableHardwareEncoding", "true");
  assert.match(appended, /<EnableHardwareEncoding>true<\/EnableHardwareEncoding>/);
});

test("Jellyfin Service: seeds valid network.xml and encoding.xml into target directory", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "reelos-jf-test-"));
  try {
    seedJellyfinNetworkXml(tmpDir);
    const netXmlPath = join(tmpDir, "configs", "jellyfin", "config", "network.xml");
    const netXml = readFileSync(netXmlPath, "utf8");
    assert.match(netXml, /<EnablePublishedServerUriByRequest>true<\/EnablePublishedServerUriByRequest>/);
    assert.match(netXml, /<NetworkConfiguration/);

    seedJellyfinEncodingXml(tmpDir);
    const encXmlPath = join(tmpDir, "configs", "jellyfin", "config", "encoding.xml");
    const encXml = readFileSync(encXmlPath, "utf8");
    assert.match(encXml, /<EncodingOptions/);
    assert.match(encXml, /<EncodingThreadCount>1<\/EncodingThreadCount>/);
    assert.match(encXml, /<EnableSubtitleExtraction>false<\/EnableSubtitleExtraction>/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Jellyfin Service: token cache supports get, set, and clear", () => {
  jellyfinTokens.clear();
  assert.equal(jellyfinTokens.get("testUser", "testPin"), null);

  const mockAuth = { token: "secret-token", id: "user-guid-001" };
  jellyfinTokens.set("testUser", "testPin", mockAuth);

  assert.deepEqual(jellyfinTokens.get("testUser", "testPin"), mockAuth);
  assert.equal(jellyfinTokens.get("wrongUser", "testPin"), null);

  jellyfinTokens.clear();
  assert.equal(jellyfinTokens.get("testUser", "testPin"), null);
});
