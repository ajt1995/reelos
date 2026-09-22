import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  DEFAULT_SHADOW_SETTINGS,
  getShadowLabSettings,
  saveShadowLabSettings,
  resolveShadowArchiveBook,
  handleShadowLabRoute,
} from "./shadow-archive-service.mjs";

describe("Shadow Lab Service", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-shadow-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("defaults all shadow lab features to strictly disabled", () => {
    const res = getShadowLabSettings(tmpDir);
    assert.equal(res.ok, true);
    assert.deepEqual(res.settings, DEFAULT_SHADOW_SETTINGS);
    assert.equal(res.settings.annasArchiveEnabled, false);
    assert.equal(res.settings.directSshEnabled, false);
    assert.equal(res.settings.customTrackersEnabled, false);
  });

  it("persists toggled settings accurately", () => {
    const saved = saveShadowLabSettings({ annasArchiveEnabled: true }, tmpDir);
    assert.equal(saved.ok, true);
    assert.equal(saved.settings.annasArchiveEnabled, true);

    const reloaded = getShadowLabSettings(tmpDir);
    assert.equal(reloaded.settings.annasArchiveEnabled, true);
    assert.equal(reloaded.settings.directSshEnabled, false);
  });

  it("refuses book resolution when shadow archive is disabled", async () => {
    const res = await resolveShadowArchiveBook({ title: "Neuromancer" }, tmpDir);
    assert.equal(res.ok, false);
    assert.equal(res.enabled, false);
    assert.match(res.error, /disabled/i);
    assert.equal(res.hits.length, 0);
  });

  it("never fabricates books when the legacy archive resolver is not connected", async () => {
    saveShadowLabSettings({ annasArchiveEnabled: true }, tmpDir);
    const res = await resolveShadowArchiveBook(
      { title: "Neuromancer", author: "William Gibson" },
      tmpDir
    );
    assert.equal(res.ok, false);
    assert.equal(res.enabled, true);
    assert.equal(res.available, false);
    assert.equal(res.hits.length, 0);
    assert.match(res.error, /resolver is connected/i);
  });

  it("handles HTTP GET and POST /api/settings/shadow-lab", async () => {
    let resHeaders = {};
    let resCode = 0;
    let resBody = "";
    const mockRes = {
      writeHead(code, headers) {
        resCode = code;
        resHeaders = headers;
      },
      end(body) {
        resBody = body;
      },
    };

    // 1. GET
    const handledGet = await handleShadowLabRoute(
      { url: "/api/settings/shadow-lab", method: "GET" },
      mockRes,
      { stateDir: tmpDir }
    );
    assert.equal(handledGet, true);
    assert.equal(resCode, 200);
    const getPayload = JSON.parse(resBody);
    assert.equal(getPayload.settings.annasArchiveEnabled, false);

    // 2. POST
    async function* makeAsyncIterable(str) {
      yield Buffer.from(str);
    }
    const mockReqPost = Object.assign(makeAsyncIterable(JSON.stringify({ annasArchiveEnabled: true })), {
      url: "/api/settings/shadow-lab",
      method: "POST",
    });

    const handledPost = await handleShadowLabRoute(mockReqPost, mockRes, { stateDir: tmpDir });
    assert.equal(handledPost, true);
    assert.equal(resCode, 200);
    const postPayload = JSON.parse(resBody);
    assert.equal(postPayload.settings.annasArchiveEnabled, true);
  });
});
