import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  accessHonestyError,
  frontendHonestyError,
  pingWizardSource,
  provisionHonestyError,
  sourceValidateError,
} from "./wizard-honesty.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("TorBox is the only source Validate may accept", () => {
  assert.equal(sourceValidateError("torbox"), null);
  assert.match(sourceValidateError("real-debrid"), /untested/i);
  assert.match(sourceValidateError("alldebrid"), /untested/i);
  assert.match(sourceValidateError("premiumize"), /untested/i);
  assert.match(sourceValidateError("local-vpn"), /untested/i);
  assert.match(sourceValidateError("local-vpn"), /not a fake OK/i);
});

test("untested sources never hit provider APIs (no fake RD Validate)", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  for (const source of ["real-debrid", "alldebrid", "premiumize", "local-vpn"]) {
    const r = await pingWizardSource(source, "abcdefghijklmnop", fetchImpl);
    assert.equal(r.ok, false);
    assert.match(r.error, /untested/i);
  }
  assert.equal(calls, 0);
});

test("TorBox ping sends User-Agent ReelOS and uses the live URL", async () => {
  let url;
  let headers;
  const fetchImpl = async (u, opts) => {
    url = u;
    headers = opts.headers;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const r = await pingWizardSource("torbox", "abcdefghijklmnop", fetchImpl);
  assert.equal(r.ok, true);
  assert.match(String(url), /api\.torbox\.app\/v1\/api\/user\/me/);
  assert.equal(headers["User-Agent"], "ReelOS");
  assert.match(headers.Authorization, /^Bearer /);
});

test("provision refuses Plex claim and Cloudflare Tunnel as working paths", () => {
  const ok = { source: "torbox", frontend: "jellyfin", access: "lan" };
  assert.equal(provisionHonestyError(ok), null);
  assert.equal(provisionHonestyError({ ...ok, access: "tailscale" }), null);
  assert.match(frontendHonestyError("plex"), /untested/i);
  assert.match(frontendHonestyError("both"), /untested/i);
  assert.equal(frontendHonestyError("jellyfin"), null);
  assert.match(accessHonestyError("cloudflare"), /untested/i);
  assert.equal(accessHonestyError("lan"), null);
  assert.match(provisionHonestyError({ ...ok, frontend: "plex" }), /Plex/i);
  assert.match(provisionHonestyError({ ...ok, access: "cloudflare" }), /Cloudflare/i);
  assert.match(provisionHonestyError({ source: "real-debrid", frontend: "jellyfin", access: "lan" }), /TorBox/);
});

test("7-step wizard stays; Books chip off by default; default source is TorBox", () => {
  const wizard = read("src/components/wizard.tsx");
  const catalog = read("src/lib/catalog.ts");
  const store = read("src/lib/store.ts");
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  const ping = read("src/lib/ping-source.ts");
  const provision = read("src/lib/provision-appliance.ts");
  const adapter = read("src/lib/adapter.ts");
  assert.match(wizard, /const TOTAL = 7/);
  assert.match(wizard, /step === 1 && <StepStorage/);
  assert.match(wizard, /step === 7 && <StepAccess/);
  assert.match(wizard, /key: "books"/);
  assert.match(store, /books: false/);
  assert.doesNotMatch(catalog, /id: "books"/);
  assert.match(store, /source: "torbox"/);
  assert.doesNotMatch(store, /source: "real-debrid"/);
  assert.match(wizard, /Untested/);
  assert.match(plugin, /sourceValidateError/);
  assert.match(plugin, /provisionHonestyError/);
  assert.match(plugin, /pingWizardSource/);
  assert.match(ping, /pingWizardSource/);
  assert.match(provision, /provisionHonestyError/);
  assert.doesNotMatch(plugin, /VPN client ready/);
  assert.doesNotMatch(ping, /VPN client ready/);
  assert.doesNotMatch(adapter, /38 days/);
  assert.doesNotMatch(store, /daysLeft: answers\.source === "local-vpn" \? 0 : 38/);
});
