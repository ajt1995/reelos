import assert from "node:assert/strict";
import { test } from "node:test";
import { jellyfinWatchHref, jellyfinWatchOrigin } from "./jellyfin-watch.ts";

test("Watch uses LAN or Tailscale IP, never hostname:8096", () => {
  assert.equal(
    jellyfinWatchOrigin({
      ipv4: "192.168.1.234",
      tailscaleIp: "100.100.154.16",
      hostname: "reelos.tail977fee.ts.net",
    }),
    "http://100.100.154.16:8096",
  );
  assert.equal(
    jellyfinWatchOrigin({ ipv4: "192.168.1.234", hostname: "reelos.local" }),
    "http://192.168.1.234:8096",
  );
  assert.equal(jellyfinWatchOrigin({ hostname: "reelos.tail977fee.ts.net" }), "");
  assert.equal(jellyfinWatchOrigin({ hostname: "192.168.1.234" }), "http://192.168.1.234:8096");
  assert.equal(
    jellyfinWatchHref({ ipv4: "192.168.1.234", jellyfinId: "abc" }),
    "http://192.168.1.234:8096/web/#/details?id=abc",
  );
  assert.equal(
    jellyfinWatchOrigin({
      watch: "http://192.168.1.234:8096",
      hostname: "house",
    }),
    "http://192.168.1.234:8096",
  );
});

test("Watch does not treat loopback as the box Jellyfin door", () => {
  assert.equal(jellyfinWatchOrigin({ hostname: "127.0.0.1" }), "");
  assert.equal(jellyfinWatchOrigin({ hostname: "localhost" }), "");
  assert.equal(jellyfinWatchOrigin({ ipv4: "127.0.0.1", hostname: "reelos.local" }), "");
  assert.equal(jellyfinWatchOrigin({ watch: "http://127.0.0.1:8096", hostname: "house" }), "");
  assert.equal(
    jellyfinWatchOrigin({ ipv4: "192.168.1.234", hostname: "127.0.0.1" }),
    "http://192.168.1.234:8096",
  );
});
