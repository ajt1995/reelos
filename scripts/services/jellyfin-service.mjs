import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hasVaapiDri } from "../reelos-box-scale.mjs";
import {
  createTokenCache,
  JELLYFIN_ITEMS_TIMEOUT_MS,
  libraryItemsUrl,
  jellyfinResumeUrl,
} from "../reelos-library.mjs";

/**
 * Jellyfin Service for ReelOS.
 * Provides media server authentication, auth header generation,
 * encoding and network XML generation/patching, virtual folder discovery,
 * and library health checks.
 */

// Unique DeviceId: doctor + selfheal used to share "reelos" and revoke the box token (401 / red chip).
export const JF_AUTH =
  'MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos-box", Version="1.2.50.33"';

export function jellyfinAuthedHeaders(token) {
  const auth = token ? `${JF_AUTH}, Token="${token}"` : JF_AUTH;
  const headers = {
    Authorization: auth,
    "X-Emby-Authorization": auth,
  };
  if (token) headers["X-Emby-Token"] = token;
  return headers;
}

export const JF_NETWORK_XML = `<?xml version="1.0" encoding="utf-8"?>
<NetworkConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EnableUPnP>false</EnableUPnP>
  <EnableIPv4>true</EnableIPv4>
  <EnableIPv6>false</EnableIPv6>
  <EnableRemoteAccess>true</EnableRemoteAccess>
  <RequireHttps>false</RequireHttps>
  <AutoDiscovery>true</AutoDiscovery>
  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>
</NetworkConfiguration>
`;

export function xmlSetTag(text, tag, value) {
  const pat = new RegExp(`<${tag}>[^<]*</${tag}>`, "i");
  const repl = `<${tag}>${value}</${tag}>`;
  if (pat.test(text)) return text.replace(pat, repl);
  if (text.includes("</EncodingOptions>")) {
    return text.replace("</EncodingOptions>", `  ${repl}\n</EncodingOptions>`);
  }
  return text;
}

export const JF_ENCODING_XML = `<?xml version="1.0" encoding="utf-8"?>
<EncodingOptions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EncodingThreadCount>1</EncodingThreadCount>
  <EnableThrottling>true</EnableThrottling>
  <EnableSegmentDeletion>true</EnableSegmentDeletion>
  <SegmentKeepSeconds>60</SegmentKeepSeconds>
  <HardwareAccelerationType>none</HardwareAccelerationType>
  <EnableHardwareEncoding>false</EnableHardwareEncoding>
  <EnableSubtitleExtraction>false</EnableSubtitleExtraction>
  <EncoderPreset>veryfast</EncoderPreset>
  <AllowHevcEncoding>false</AllowHevcEncoding>
  <VaapiDevice>/dev/dri/renderD128</VaapiDevice>
</EncodingOptions>
`;

export function seedJellyfinEncodingXml(composeDir) {
  const dest = `${composeDir}/configs/jellyfin/config/encoding.xml`;
  try {
    mkdirSync(`${composeDir}/configs/jellyfin/config`, { recursive: true });
    const hasDri = hasVaapiDri();
    let text = existsSync(dest) ? readFileSync(dest, "utf8") : JF_ENCODING_XML;
    if (!text.includes("</EncodingOptions>")) text = JF_ENCODING_XML;
    text = xmlSetTag(text, "HardwareAccelerationType", hasDri ? "vaapi" : "none");
    text = xmlSetTag(text, "EnableHardwareEncoding", hasDri ? "true" : "false");
    text = xmlSetTag(text, "AllowHevcEncoding", hasDri ? "true" : "false");
    text = xmlSetTag(text, "EnableSubtitleExtraction", "false");
    text = xmlSetTag(text, "EnableThrottling", "true");
    text = xmlSetTag(text, "EnableSegmentDeletion", "true");
    writeFileSync(dest, text);
  } catch {
    /* */
  }
}

export function seedJellyfinNetworkXml(composeDir) {
  const dest = `${composeDir}/configs/jellyfin/config/network.xml`;
  try {
    mkdirSync(`${composeDir}/configs/jellyfin/config`, { recursive: true });
    if (existsSync(dest)) {
      const text = readFileSync(dest, "utf8");
      if (/<EnablePublishedServerUriByRequest>\s*true\s*</i.test(text)) return;
      if (text.includes("<EnablePublishedServerUriByRequest>")) {
        writeFileSync(
          dest,
          text.replace(
            /<EnablePublishedServerUriByRequest>[^<]*<\/EnablePublishedServerUriByRequest>/,
            "<EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>",
          ),
        );
        return;
      }
      if (text.includes("</NetworkConfiguration>")) {
        writeFileSync(
          dest,
          text.replace(
            "</NetworkConfiguration>",
            "  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>\n</NetworkConfiguration>",
          ),
        );
        return;
      }
    }
    writeFileSync(dest, JF_NETWORK_XML);
  } catch {
    /* */
  }
}

export const jellyfinTokens = createTokenCache();

export async function revealJellyfinAdmin(token, user, baseUrl = "http://127.0.0.1:8096") {
  try {
    let me = user;
    if (!me?.Id || !me.Policy) {
      const r = await fetch(`${baseUrl}/Users/Me`, {
        headers: jellyfinAuthedHeaders(token),
      });
      me = r.ok ? await r.json() : null;
    }
    if (!me?.Id || !me.Policy || typeof me.Policy !== "object") return;
    if (me.Policy.IsHidden === false) return;
    await fetch(`${baseUrl}/Users/${me.Id}/Policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jellyfinAuthedHeaders(token) },
      body: JSON.stringify({ ...me.Policy, IsHidden: false }),
    });
  } catch {
    /* */
  }
}

export async function jellyfinToken(user, password, baseUrl = "http://127.0.0.1:8096") {
  const cached = jellyfinTokens.get(user, password);
  if (cached) return cached;
  try {
    const r = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: JF_AUTH,
        "X-Emby-Authorization": JF_AUTH,
      },
      body: JSON.stringify({ Username: user, Pw: password }),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const auth = { token: j.AccessToken, id: j.User?.Id };
    if (auth.token) void revealJellyfinAdmin(auth.token, j.User, baseUrl);
    jellyfinTokens.set(user, password, auth);
    return auth;
  } catch {
    return null;
  }
}

export async function readJellyfinVirtualFolders(token, baseUrl = "http://127.0.0.1:8096") {
  const urls = [
    `${baseUrl}/Library/VirtualFolders`,
    `${baseUrl}/Library/VirtualFolders?api_key=${encodeURIComponent(token)}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: jellyfinAuthedHeaders(token),
        signal: AbortSignal.timeout(4000),
      });
      if (r.status === 401 || r.status === 403) continue;
      if (!r.ok) continue;
      const folders = await r.json();
      if (Array.isArray(folders)) return folders;
    } catch {
      /* timeout / 401 — try api_key next, like doctor */
    }
  }
  return null;
}

export async function probeJson(url, ms = 3000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: null };
  } finally {
    clearTimeout(t);
  }
}

export async function jellyfinFetchItems(
  auth,
  { limit, timeout = JELLYFIN_ITEMS_TIMEOUT_MS } = {},
  { baseUrl = "http://127.0.0.1:8096", getAnswers = null } = {},
) {
  const pull = (token) =>
    fetch(libraryItemsUrl({ limit }), {
      headers: jellyfinAuthedHeaders(token),
      signal: AbortSignal.timeout(timeout),
    });
  let token = auth?.token;
  if (!token) return { ok: false, status: 0, json: null };
  let r = await pull(token);
  if (r.status === 401 || r.status === 403) {
    jellyfinTokens.clear();
    const a = typeof getAnswers === "function" ? getAnswers() : {};
    const next = await jellyfinToken(a.adminName || "reelos", a.adminPassword || "reelos", baseUrl);
    if (!next?.token) return { ok: false, status: r.status, json: null };
    token = next.token;
    r = await pull(token);
  }
  if (!r.ok) return { ok: false, status: r.status, json: null };
  return { ok: true, status: r.status, json: await r.json() };
}

export async function jellyfinFetchResume(
  auth,
  { limit = 24, timeout = JELLYFIN_ITEMS_TIMEOUT_MS } = {},
  { baseUrl = "http://127.0.0.1:8096", getAnswers = null } = {},
) {
  const url = jellyfinResumeUrl(auth?.id, { limit });
  if (!url || !auth?.token) return { ok: false, status: 0, json: null };
  const pull = (token) =>
    fetch(url, {
      headers: jellyfinAuthedHeaders(token),
      signal: AbortSignal.timeout(timeout),
    });
  let token = auth.token;
  let r = await pull(token);
  if (r.status === 401 || r.status === 403) {
    jellyfinTokens.clear();
    const a = typeof getAnswers === "function" ? getAnswers() : {};
    const next = await jellyfinToken(a.adminName || "reelos", a.adminPassword || "reelos", baseUrl);
    if (!next?.token) return { ok: false, status: r.status, json: null };
    token = next.token;
    r = await pull(token);
  }
  if (!r.ok) return { ok: false, status: r.status, json: null };
  return { ok: true, status: r.status, json: await r.json() };
}

export async function libraryResumePayload(auth, options = {}, context = {}) {
  const pulled = await jellyfinFetchResume(auth, options, context);
  return pulled.ok ? pulled.json : null;
}

export async function getJellyfinState({
  ip = null,
  answers = {},
  baseUrl = "http://127.0.0.1:8096",
} = {}) {
  const intent = answers.intent || {};
  const lanUrl = ip ? `http://${ip}:8096/System/Info/Public` : null;
  const lan = lanUrl ? await probeJson(lanUrl) : { ok: false, json: null };
  if (!lan.ok) {
    const loop = await probeJson(`${baseUrl}/System/Info/Public`);
    if (!loop.ok) {
      return { state: "red", detail: "Jellyfin not on :8096", libraries: [] };
    }
  }
  let auth = await jellyfinToken(answers.adminName || "reelos", answers.adminPassword || "reelos", baseUrl);
  if (!auth?.token) {
    return { state: "red", detail: "Jellyfin has no matching user/PIN", libraries: [] };
  }
  let folders = await readJellyfinVirtualFolders(auth.token, baseUrl);
  if (!folders) {
    jellyfinTokens.clear();
    auth = await jellyfinToken(answers.adminName || "reelos", answers.adminPassword || "reelos", baseUrl);
    folders = auth?.token ? await readJellyfinVirtualFolders(auth.token, baseUrl) : null;
  }
  if (!folders) {
    return { state: "red", detail: "Cannot read virtual folders", libraries: [] };
  }
  const names = folders.map((x) => String(x.Name || "")).filter(Boolean);
  const need = [];
  if (intent.movies !== false) need.push("Movies");
  if (intent.tv !== false || intent.anime) need.push("Shows");
  const missing = need.filter((n) => !names.includes(n));
  if (missing.length) {
    return { state: "red", detail: `Missing library ${missing.join(", ")}`, libraries: names };
  }
  const detail = ip && lan.ok ? `Jellyfin on http://${ip}:8096` : "Jellyfin on loopback :8096";
  return { state: "green", detail, libraries: names };
}
