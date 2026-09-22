import assert from "node:assert/strict";
import { test } from "node:test";
import { jellyfinStreamUrl, jellyfinWatchHref, jellyfinWatchOrigin, jellyfinWebPlayerUrl } from "./jellyfin-watch.ts";

test("Watch uses LAN or Tailscale IP on native port 8080, never hostname:8080", () => {
  assert.equal(
    jellyfinWatchOrigin({
      ipv4: "192.168.1.234",
      tailscaleIp: "100.100.154.16",
      hostname: "reelos.tail977fee.ts.net",
    }),
    "http://100.100.154.16:8080",
  );
  assert.equal(
    jellyfinWatchOrigin({ ipv4: "192.168.1.234", hostname: "reelos.local" }),
    "http://192.168.1.234:8080",
  );
  assert.equal(jellyfinWatchOrigin({ hostname: "reelos.tail977fee.ts.net" }), "");
  assert.equal(jellyfinWatchOrigin({ hostname: "192.168.1.234" }), "http://192.168.1.234:8080");
  assert.equal(
    jellyfinWatchHref({ ipv4: "192.168.1.234", jellyfinId: "abc" }),
    "http://192.168.1.234:8080/web/#/details?id=abc",
  );
  assert.equal(
    jellyfinWatchOrigin({
      watch: "http://192.168.1.234:8080",
      hostname: "house",
    }),
    "http://192.168.1.234:8080",
  );
});

test("Watch does not treat loopback as the box Jellyfin door", () => {
  assert.equal(jellyfinWatchOrigin({ hostname: "127.0.0.1" }), "");
  assert.equal(jellyfinWatchOrigin({ hostname: "localhost" }), "");
  assert.equal(jellyfinWatchOrigin({ ipv4: "127.0.0.1", hostname: "reelos.local" }), "");
  assert.equal(jellyfinWatchOrigin({ watch: "http://127.0.0.1:8080", hostname: "house" }), "");
  assert.equal(
    jellyfinWatchOrigin({ ipv4: "192.168.1.234", hostname: "127.0.0.1" }),
    "http://192.168.1.234:8080",
  );
});

test("In-app web player keeps its compatibility link while byte playback uses the authenticated item route", () => {
  assert.equal(
    jellyfinWebPlayerUrl({ ipv4: "192.168.1.234", jellyfinId: "jf-xyz" }),
    "http://192.168.1.234:8080/web/index.html#!/video?id=jf-xyz",
  );
  assert.equal(
    jellyfinStreamUrl({ ipv4: "192.168.1.234", jellyfinId: "jf-xyz" }),
    "http://192.168.1.234:8080/api/stream/item/jf-xyz",
  );
  assert.equal(
    jellyfinStreamUrl({ ipv4: "192.168.1.234", jellyfinId: "jf-xyz", mediaSourceId: "src-1080" }),
    "http://192.168.1.234:8080/api/stream/item/jf-xyz",
  );
  assert.equal(
    jellyfinStreamUrl({ ipv4: "192.168.1.234", jellyfinId: "jf-xyz", mediaSourceId: "src-1080", directStream: true }),
    "http://192.168.1.234:8080/api/stream/item/jf-xyz",
  );
  assert.equal(
    jellyfinStreamUrl({ ipv4: "192.168.1.234", jellyfinId: "jf-xyz", mediaSourceId: "src-1080", directStream: true, playSessionId: "sess-abc" }),
    "http://192.168.1.234:8080/api/stream/item/jf-xyz",
  );
});
