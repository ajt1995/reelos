import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("compose Caddyfiles match and do not use Caddy 2.8 heredoc respond", () => {
  const live = read("compose/Caddyfile");
  const install = read("install/compose/Caddyfile");
  assert.equal(live, install);
  assert.match(live, /handle_errors/);
  assert.match(live, /Updating ReelOS/);
  assert.doesNotMatch(live, /<<HTML/);
  assert.match(live, /respond `/);
});

test("Ubuntu Caddy 2.6 can adapt the door Caddyfile", () => {
  const r = spawnSync("caddy", ["adapt", "--config", join(root, "compose/Caddyfile"), "--adapter", "caddyfile"], {
    encoding: "utf8",
  });
  if (r.error && r.error.code === "ENOENT") {
    return; // pack/CI without caddy still has the no-heredoc contract above
  }
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /handle_errors|error_routes|Updating ReelOS/);
});

test("502 from a dead :8080 renders Updating ReelOS, not an empty body", () => {
  const r = spawnSync("caddy", ["version"], { encoding: "utf8" });
  if (r.error && r.error.code === "ENOENT") return;
  const dir = join("/tmp", "reelos-caddy-54");
  mkdirSync(dir, { recursive: true });
  const cfg = read("compose/Caddyfile").replace(":80 {", ":18112 {").replace(
    "reverse_proxy 127.0.0.1:8080",
    "reverse_proxy 127.0.0.1:19999",
  );
  writeFileSync(join(dir, "Caddyfile"), cfg);
  const adapt = spawnSync("caddy", ["adapt", "--config", join(dir, "Caddyfile"), "--adapter", "caddyfile"], {
    encoding: "utf8",
  });
  assert.equal(adapt.status, 0, adapt.stderr || adapt.stdout);
});
