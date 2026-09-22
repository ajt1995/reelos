/**
 * ReelOS Quick Connect Bridge for Jellyfin
 * Authorizes client devices (TVs, iOS Swiftfin, Android Findroid) via 6-digit PIN.
 */

export function sanitizeQuickConnectCode(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw).replace(/[\s-]+/g, "").trim();
}

export async function authorizeQuickConnect({
  code,
  token,
  userId,
  host = "127.0.0.1:8096",
  fetchFn = fetch,
  timeoutMs = 6000,
} = {}) {
  const cleanCode = sanitizeQuickConnectCode(code);
  if (!cleanCode) {
    return { ok: false, error: "A 6-digit Quick Connect code is required" };
  }
  if (!token) {
    return { ok: false, error: "Jellyfin authentication token required" };
  }

  const query = new URLSearchParams({ code: cleanCode });
  if (userId) query.set("userId", String(userId));

  const url = `http://${host}/QuickConnect/Authorize?${query.toString()}`;
  const headers = {
    Accept: "application/json",
    Authorization: `MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos-box", Version="1.2.50.33", Token="${token}"`,
    "X-Emby-Authorization": `MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos-box", Version="1.2.50.33", Token="${token}"`,
    "X-Emby-Token": token,
  };

  try {
    const r = await fetchFn(url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (r.status === 200 || r.status === 204) {
      let data = null;
      try {
        data = await r.json();
      } catch {
        /* some Jellyfin versions return empty body or plain text */
      }
      if (data === false) {
        return { ok: false, error: "Code not recognized or expired. Please check your screen and try again." };
      }
      return { ok: true, message: "Device authorized successfully!" };
    }

    if (r.status === 404 || r.status === 400) {
      return { ok: false, error: "Invalid or expired Quick Connect code." };
    }

    return { ok: false, error: `Jellyfin authorization failed (${r.status})` };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function getQuickConnectStatus({
  host = "127.0.0.1:8096",
  fetchFn = fetch,
  timeoutMs = 4000,
} = {}) {
  try {
    const r = await fetchFn(`http://${host}/QuickConnect/Enabled`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { enabled: false };
    const enabled = await r.json();
    return { enabled: Boolean(enabled) };
  } catch {
    return { enabled: false };
  }
}
