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
