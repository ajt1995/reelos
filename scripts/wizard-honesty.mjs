/**
 * Wizard / provision honesty.
 *
 * This house only has a TorBox key to test with. Do not present Real-Debrid,
 * AllDebrid, Premiumize, Local+VPN, Plex claim, or Cloudflare Tunnel as working.
 * Do not invent a fake always-ok Validate. TorBox Validate hits api.torbox.app.
 */

export const TESTED_SOURCE = "torbox";
export const TESTED_FRONTEND = "jellyfin";
export const TESTED_ACCESS = new Set(["lan", "tailscale"]);

export const UNTESTED_SOURCE_REASON = {
  "real-debrid": "Real-Debrid is untested on this house. Use TorBox.",
  alldebrid: "AllDebrid is untested on this house. Use TorBox.",
  premiumize: "Premiumize is untested on this house. Use TorBox.",
  "local-vpn":
    "Local + VPN is untested (no VPN credentials; Validate is not a fake OK). Use TorBox.",
};

export function sourceValidateError(source) {
  if (source === TESTED_SOURCE) return null;
  return UNTESTED_SOURCE_REASON[source] || "Unknown source. Use TorBox.";
}

export function frontendHonestyError(frontend) {
  if (!frontend || frontend === TESTED_FRONTEND) return null;
  return "Plex claim is untested on this house. Use Jellyfin.";
}

export function accessHonestyError(access) {
  if (!access || TESTED_ACCESS.has(access)) return null;
  return "Cloudflare Tunnel is untested on this house. Use this network or Tailscale.";
}

export function provisionHonestyError(answers = {}) {
  return (
    sourceValidateError(answers.source) ||
    frontendHonestyError(answers.frontend) ||
    accessHonestyError(answers.access) ||
    null
  );
}

export async function pingTorboxKey(key, fetchImpl = fetch) {
  const k = String(key || "").trim();
  if (k.length < 10) return { ok: false, error: "Provider rejected this key." };
  try {
    const r = await fetchImpl("https://api.torbox.app/v1/api/user/me", {
      headers: {
        Authorization: `Bearer ${k}`,
        Accept: "application/json",
        "User-Agent": "ReelOS",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, error: `TorBox ${r.status}` };
    return { ok: true, message: "TorBox key accepted" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function pingWizardSource(source, key, fetchImpl = fetch) {
  const blocked = sourceValidateError(source);
  if (blocked) return { ok: false, error: blocked };
  if (source === TESTED_SOURCE) return pingTorboxKey(key, fetchImpl);
  return { ok: false, error: "Unknown source. Use TorBox." };
}
