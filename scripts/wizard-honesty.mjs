/**
 * Wizard / provision honesty.
 *
 * Provider validation must always hit the selected provider. Never convert a
 * stored key into a connected state without a successful live response.
 */

export const TESTED_SOURCES = new Set(["torbox", "real-debrid"]);
export const TESTED_SOURCE = "torbox";
export const TESTED_FRONTEND = "jellyfin";
export const TESTED_ACCESS = new Set(["lan", "tailscale"]);

/** @type {Record<string, string>} */
export const UNTESTED_SOURCE_REASON = {
  alldebrid: "AllDebrid is untested on this house. Use TorBox.",
  premiumize: "Premiumize is untested on this house. Use TorBox.",
  "local-vpn":
    "Local + VPN is untested (no VPN credentials; Validate is not a fake OK). Use TorBox.",
};

/**
 * @param {string} source
 * @returns {string | null}
 */
export function sourceValidateError(source) {
  if (TESTED_SOURCES.has(source)) return null;
  return UNTESTED_SOURCE_REASON[source] || "Unknown debrid provider.";
}

/**
 * @param {string} frontend
 * @returns {string | null}
 */
export function frontendHonestyError(frontend) {
  if (!frontend || frontend === TESTED_FRONTEND) return null;
  return "Plex claim is untested on this house. Use Jellyfin.";
}

/**
 * @param {string} access
 * @returns {string | null}
 */
export function accessHonestyError(access) {
  if (!access || TESTED_ACCESS.has(access)) return null;
  return "Cloudflare Tunnel is untested on this house. Use this network or Tailscale.";
}

/**
 * @param {{ source?: string, frontend?: string, access?: string }} [answers]
 * @returns {string | null}
 */
export function provisionHonestyError(answers = {}) {
  return (
    sourceValidateError(answers.source || "") ||
    frontendHonestyError(answers.frontend || "") ||
    accessHonestyError(answers.access || "") ||
    null
  );
}

/**
 * @typedef {{ ok: true, message: string, accountId?: string } | { ok: false, code: string, error: string }} PingResult
 */

function providerFailure(provider, status) {
  if (status === 401 || status === 403) return { ok: false, code: "provider_rejected", error: `${provider} rejected this key.` };
  if (status === 408 || status === 504) return { ok: false, code: "provider_timeout", error: `${provider} did not respond in time.` };
  if (status === 429) return { ok: false, code: "provider_rate_limited", error: `${provider} asked ReelOS to slow down.` };
  return { ok: false, code: "provider_unavailable", error: `${provider} is temporarily unavailable.` };
}

function providerNetworkFailure(provider, error) {
  const timedOut = error?.name === "AbortError" || error?.name === "TimeoutError" || error?.code === "ETIMEDOUT";
  return timedOut
    ? { ok: false, code: "provider_timeout", error: `${provider} did not respond in time.` }
    : { ok: false, code: "provider_connectivity", error: `${provider} could not be reached.` };
}

async function verifiedAccount(response, provider) {
  try {
    const json = await response.json();
    if (json?.success === false || json?.error) return null;
    const data = json?.data || json;
    const identity = provider === "TorBox"
      ? data?.id ?? data?.user?.id ?? data?.user_id ?? data?.username
      : data?.id ?? data?.username;
    const accountId = String(identity ?? "").trim();
    return accountId && accountId.length <= 256 ? accountId : null;
  } catch { return null; }
}

/**
 * @param {string} key
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<PingResult>}
 */
export async function pingTorboxKey(key, fetchImpl = fetch, { requireAccount = false } = {}) {
  const k = String(key || "").trim();
  if (k.length < 10) return { ok: false, code: "provider_rejected", error: "Provider rejected this key." };
  try {
    const r = await fetchImpl("https://api.torbox.app/v1/api/user/me", {
      headers: {
        Authorization: `Bearer ${k}`,
        Accept: "application/json",
        "User-Agent": "ReelOS",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return providerFailure("TorBox", r.status);
    if (!requireAccount) return { ok: true, message: "TorBox key accepted" };
    const accountId = await verifiedAccount(r, "TorBox");
    return accountId ? { ok: true, message: "TorBox key accepted", accountId }
      : { ok: false, code: "provider_identity_missing", error: "TorBox did not return a verifiable account." };
  } catch (e) {
    return providerNetworkFailure("TorBox", e);
  }
}

/**
 * @param {string} key
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<PingResult>}
 */
export async function pingRealDebridKey(key, fetchImpl = fetch, { requireAccount = false } = {}) {
  const k = String(key || "").trim();
  if (k.length < 10) return { ok: false, code: "provider_rejected", error: "Provider rejected this key." };
  try {
    const r = await fetchImpl("https://api.real-debrid.com/rest/1.0/user", {
      headers: {
        Authorization: `Bearer ${k}`,
        Accept: "application/json",
        "User-Agent": "ReelOS",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return providerFailure("Real-Debrid", r.status);
    if (!requireAccount) return { ok: true, message: "Real-Debrid key accepted" };
    const accountId = await verifiedAccount(r, "Real-Debrid");
    return accountId ? { ok: true, message: "Real-Debrid key accepted", accountId }
      : { ok: false, code: "provider_identity_missing", error: "Real-Debrid did not return a verifiable account." };
  } catch (e) {
    return providerNetworkFailure("Real-Debrid", e);
  }
}

/**
 * @param {string} source
 * @param {string} key
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<PingResult>}
 */
export async function pingWizardSource(source, key, fetchImpl = fetch, options = {}) {
  const blocked = sourceValidateError(source);
  if (blocked) return { ok: false, code: "provider_unsupported", error: blocked };
  if (source === "torbox") return pingTorboxKey(key, fetchImpl, options);
  if (source === "real-debrid") return pingRealDebridKey(key, fetchImpl, options);
  return { ok: false, code: "provider_unsupported", error: "Unknown debrid provider." };
}
