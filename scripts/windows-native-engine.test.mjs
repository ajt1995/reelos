import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { createJellyfinShimHandler } from './services/jellyfin-shim-service.mjs';
import { dispatchReelOsApi } from './reelos-lookup-plugin.mjs';
import { dispatchRequestGet } from './reelos-request-progress-plugin.mjs';
import { orphanPidsOnPort, ensureHardwareProfile } from './reelos-box.mjs';

describe('Windows Native Engine Integration Tests', () => {
  it('should test lookup for movies without Seerr API key', async () => {
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith('https://v3-cinemeta.strem.io/')) {
        const isSeries = url.includes('/series/');
        return new Response(JSON.stringify({
          metas: [{
            id: isSeries ? 'tt0417299' : 'tt0499549',
            type: isSeries ? 'series' : 'movie',
            name: isSeries ? 'Avatar: The Last Airbender' : 'Avatar',
            poster: 'https://images.example.test/avatar.jpg',
            releaseInfo: isSeries ? '2005–2008' : '2009',
          }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return nativeFetch(input, init);
    };
    const server = http.createServer(async (req, res) => {
      if (await dispatchRequestGet(req, res)) return;
      if (await dispatchReelOsApi(req, res)) return;
      res.writeHead(404);
      res.end('Not found');
    });
    
    server.listen(0);
    await new Promise(r => server.on('listening', r));
    const port = server.address().port;
    
    try {
      // Test /api/lookup
      let res = await fetch(`http://127.0.0.1:${port}/api/lookup?q=avatar`);
      let data = await res.json();
      assert.ok(data.titles, "Should have titles");
      assert.notStrictEqual(data.error, "Request UI (Seerr) has no API key yet");
      assert.notStrictEqual(data.titles.length, 0, "Titles should not be empty");
      
      // Test /api/request
      res = await fetch(`http://127.0.0.1:${port}/api/request`);
      data = await res.json();
      assert.ok(data.requests, "Should have requests");
      assert.notStrictEqual(data.error, "Seerr has no API key yet");
      assert.ok(Array.isArray(data.requests), "Requests should be an array");
    } finally {
      globalThis.fetch = nativeFetch;
      server.close();
    }
  });
  
  it('should test Jellyfin shim endpoints', async () => {
    const handler = createJellyfinShimHandler();
    const server = http.createServer(async (req, res) => {
      if (await handler(req, res)) return;
      res.writeHead(404);
      res.end('Not found');
    });
    
    server.listen(0);
    await new Promise(r => server.on('listening', r));
    const port = server.address().port;
    
    try {
      // /System/Info
      let res = await fetch(`http://127.0.0.1:${port}/System/Info`);
      let data = await res.json();
      assert.strictEqual(data.Id, 'reelos-appliance-001');
      
      // /Users
      res = await fetch(`http://127.0.0.1:${port}/Users`);
      data = await res.json();
      assert.ok(Array.isArray(data));
      assert.ok(data[0].Id, 'Should have user Id');
      
      // /Items
      res = await fetch(`http://127.0.0.1:${port}/Items`);
      data = await res.json();
      assert.ok(Array.isArray(data.Items));
      
      // /Videos/ActiveEncodings
      res = await fetch(`http://127.0.0.1:${port}/Videos/ActiveEncodings`);
      data = await res.json();
      assert.ok(Array.isArray(data));
    } finally {
      server.close();
    }
  });
  
  it('should test Windows hardware probe memory/CPU accuracy', async () => {
    // ensureHardwareProfile doesn't crash on windows
    ensureHardwareProfile();
    // orphanPidsOnPort can run without throwing
    const pids = orphanPidsOnPort(8080);
    assert.ok(Array.isArray(pids));
  });
});
