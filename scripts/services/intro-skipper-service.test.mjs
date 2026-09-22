import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { queryJellyfinIntro, handleIntroTimestampsRoute } from "./intro-skipper-service.mjs";

describe("Intro Skipper Service", () => {
  let mockServer;
  let serverPort;

  before(async () => {
    mockServer = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");

      if (url.pathname === "/Items/item-with-intro/IntroTimestamps") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ Valid: true, IntroStart: 15.5, IntroEnd: 62.0 }));
      }

      if (url.pathname === "/Items/item-with-chapters") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            Chapters: [
              { Name: "Prologue", StartPositionTicks: 0 },
              { Name: "Intro Opening", StartPositionTicks: 120000000 }, // 12 seconds
              { Name: "Act 1", StartPositionTicks: 850000000 }, // 85 seconds
            ],
          })
        );
      }

      if (url.pathname === "/Items/item-no-intro/IntroTimestamps") {
        res.writeHead(404);
        return res.end();
      }

      if (url.pathname === "/Items/item-no-intro") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ Chapters: [{ Name: "Scene 1", StartPositionTicks: 0 }] }));
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
    serverPort = mockServer.address().port;
  });

  after(async () => {
    if (mockServer) {
      await new Promise((resolve) => mockServer.close(resolve));
    }
  });

  it("extracts intro timestamps from plugin endpoint", async () => {
    const result = await queryJellyfinIntro("item-with-intro", {
      jellyfinUrl: `http://127.0.0.1:${serverPort}`,
    });
    assert.equal(result.hasIntro, true);
    assert.equal(result.introStart, 15.5);
    assert.equal(result.introEnd, 62.0);
    assert.equal(result.itemId, "item-with-intro");
  });

  it("extracts intro timestamps from chapter fallback", async () => {
    const result = await queryJellyfinIntro("item-with-chapters", {
      jellyfinUrl: `http://127.0.0.1:${serverPort}`,
    });
    assert.equal(result.hasIntro, true);
    assert.equal(result.introStart, 12);
    assert.equal(result.introEnd, 85);
  });

  it("returns hasIntro: false when no intro exists", async () => {
    const result = await queryJellyfinIntro("item-no-intro", {
      jellyfinUrl: `http://127.0.0.1:${serverPort}`,
    });
    assert.equal(result.hasIntro, false);
    assert.equal(result.introStart, 0);
    assert.equal(result.introEnd, 0);
  });

  it("handles HTTP /api/media/:id/intro-timestamps route", async () => {
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

    const handled = await handleIntroTimestampsRoute(
      { url: "/api/media/item-with-intro/intro-timestamps" },
      mockRes,
      { jellyfinUrl: `http://127.0.0.1:${serverPort}` }
    );

    assert.equal(handled, true);
    assert.equal(resCode, 200);
    const parsed = JSON.parse(resBody);
    assert.equal(parsed.hasIntro, true);
    assert.equal(parsed.introStart, 15.5);
  });
});
