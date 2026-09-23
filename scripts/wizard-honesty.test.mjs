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

test("TorBox and Real-Debrid may validate; unimplemented providers stay blocked", () => {
  assert.equal(sourceValidateError("torbox"), null);
  assert.equal(sourceValidateError("real-debrid"), null);
  assert.match(sourceValidateError("alldebrid"), /untested/i);
  assert.match(sourceValidateError("premiumize"), /untested/i);
  assert.match(sourceValidateError("local-vpn"), /untested/i);
  assert.match(sourceValidateError("local-vpn"), /not a fake OK/i);
});

test("untested sources never hit provider APIs", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  for (const source of ["alldebrid", "premiumize", "local-vpn"]) {
    const r = await pingWizardSource(source, "abcdefghijklmnop", fetchImpl);
    assert.equal(r.ok, false);
    assert.match(r.error, /untested/i);
  }
  assert.equal(calls, 0);
});

test("Real-Debrid validation uses its live user endpoint", async () => {
  let url;
  let headers;
  const fetchImpl = async (u, opts) => {
    url = u;
    headers = opts.headers;
    return { ok: true, status: 200, json: async () => ({ username: "owner" }) };
  };
  const result = await pingWizardSource("real-debrid", "abcdefghijklmnop", fetchImpl);
  assert.equal(result.ok, true);
  assert.match(String(url), /api\.real-debrid\.com\/rest\/1\.0\/user/);
  assert.match(headers.Authorization, /^Bearer /);
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

test("private validation requires exact provider account and distinguishes failures", async () => {
  const key = "synthetic-key-for-testing";
  const torbox = await pingWizardSource("torbox", key, async () => ({
    ok: true, status: 200, json: async () => ({ success: true, data: { id: 42 } }),
  }), { requireAccount: true });
  assert.equal(torbox.accountId, "42");
  const publicPing = await pingWizardSource("torbox", key, async () => ({
    ok: true, status: 200, json: async () => ({ success: true, data: { id: 42 } }),
  }));
  assert.equal("accountId" in publicPing, false);
  assert.equal((await pingWizardSource("torbox", key, async () => ({
    ok: true, status: 200, json: async () => ({ data: {} }),
  }), { requireAccount: true })).code, "provider_identity_missing");
  assert.equal((await pingWizardSource("torbox", key, async () => ({ ok: false, status: 401 }),
    { requireAccount: true })).code, "provider_rejected");
  assert.equal((await pingWizardSource("torbox", key, async () => { throw Object.assign(new Error("fixture"), { name: "TimeoutError" }); },
    { requireAccount: true })).code, "provider_timeout");
  assert.equal((await pingWizardSource("torbox", key, async () => { throw new Error("fixture"); },
    { requireAccount: true })).code, "provider_connectivity");
  const rd = await pingWizardSource("real-debrid", key, async () => ({
    ok: true, status: 200, json: async () => ({ id: 84, username: "owner" }),
  }), { requireAccount: true });
  assert.equal(rd.accountId, "84");
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
  assert.equal(provisionHonestyError({ source: "real-debrid", frontend: "jellyfin", access: "lan" }), null);
});

test("7-step wizard stays; Books chip stays out; default source is TorBox", () => {
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
  assert.doesNotMatch(wizard, /Books/);
  assert.doesNotMatch(catalog, /id: "books"/);
  assert.match(store, /source: "torbox"/);
  assert.match(read("scripts/wizard-honesty.mjs"), /real-debrid/);
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
