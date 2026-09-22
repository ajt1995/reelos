import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeQuickConnect,
  getQuickConnectStatus,
  sanitizeQuickConnectCode,
} from "./reelos-quickconnect.mjs";

test("sanitizeQuickConnectCode normalizes user input", () => {
  assert.equal(sanitizeQuickConnectCode("123456"), "123456");
  assert.equal(sanitizeQuickConnectCode(" 123-456 "), "123456");
  assert.equal(sanitizeQuickConnectCode("12 34 56"), "123456");
  assert.equal(sanitizeQuickConnectCode("123--456"), "123456");
  assert.equal(sanitizeQuickConnectCode(null), "");
  assert.equal(sanitizeQuickConnectCode(undefined), "");
  assert.equal(sanitizeQuickConnectCode(123456), "123456");
  assert.equal(sanitizeQuickConnectCode("A1B-2C3"), "A1B2C3");
});

test("authorizeQuickConnect requires code and token", async () => {
  const noCode = await authorizeQuickConnect({ code: "", token: "test-token" });
  assert.equal(noCode.ok, false);
  assert.match(noCode.error, /required/i);

  const noToken = await authorizeQuickConnect({ code: "123456", token: "" });
  assert.equal(noToken.ok, false);
  assert.match(noToken.error, /token required/i);
});

test("authorizeQuickConnect sends proper URL and headers to Jellyfin", async () => {
  let calledUrl = "";
  let calledHeaders = {};
  let calledMethod = "";

  const fakeFetch = async (url, opts) => {
    calledUrl = url;
    calledHeaders = opts.headers;
    calledMethod = opts.method;
    return {
      status: 200,
      json: async () => ({ Success: true }),
    };
  };

  const res = await authorizeQuickConnect({
    code: "834-291",
    token: "mock-jf-token",
    userId: "usr-42",
    host: "127.0.0.1:8096",
    fetchFn: fakeFetch,
  });

  assert.equal(res.ok, true);
  assert.equal(calledMethod, "POST");
  assert.match(calledUrl, /http:\/\/127\.0\.0\.1:8096\/QuickConnect\/Authorize/);
  assert.match(calledUrl, /code=834291/);
  assert.match(calledUrl, /userId=usr-42/);
  assert.equal(calledHeaders["X-Emby-Token"], "mock-jf-token");
});

test("authorizeQuickConnect handles 404 or 400 invalid code", async () => {
  const fakeFetch = async () => ({
    status: 404,
  });

  const res = await authorizeQuickConnect({
    code: "000000",
    token: "mock-token",
    fetchFn: fakeFetch,
  });

  assert.equal(res.ok, false);
  assert.match(res.error, /invalid or expired/i);
});

test("getQuickConnectStatus returns enabled boolean", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => true,
  });

  const res = await getQuickConnectStatus({ fetchFn: fakeFetch });
  assert.equal(res.enabled, true);
});
