import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_STATE_DIR = "/var/lib/reelos";

export const DEFAULT_SHADOW_SETTINGS = {
  annasArchiveEnabled: false,
  directSshEnabled: false,
  customTrackersEnabled: false,
};

export function getShadowLabSettings(stateDir = DEFAULT_STATE_DIR) {
  const filePath = path.join(stateDir, "shadow-lab.json");
  if (!existsSync(filePath)) {
    return { ok: true, settings: { ...DEFAULT_SHADOW_SETTINGS } };
  }
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    return {
      ok: true,
      settings: {
        annasArchiveEnabled: Boolean(data.annasArchiveEnabled),
        directSshEnabled: Boolean(data.directSshEnabled),
        customTrackersEnabled: Boolean(data.customTrackersEnabled),
      },
    };
  } catch {
    return { ok: true, settings: { ...DEFAULT_SHADOW_SETTINGS } };
  }
}

export function saveShadowLabSettings(patch = {}, stateDir = DEFAULT_STATE_DIR) {
  mkdirSync(stateDir, { recursive: true });
  const current = getShadowLabSettings(stateDir).settings;
  const updated = {
    ...current,
    ...(typeof patch.annasArchiveEnabled === "boolean" ? { annasArchiveEnabled: patch.annasArchiveEnabled } : {}),
    ...(typeof patch.directSshEnabled === "boolean" ? { directSshEnabled: patch.directSshEnabled } : {}),
    ...(typeof patch.customTrackersEnabled === "boolean" ? { customTrackersEnabled: patch.customTrackersEnabled } : {}),
  };
  const filePath = path.join(stateDir, "shadow-lab.json");
  writeFileSync(filePath, JSON.stringify(updated, null, 2));
  return { ok: true, settings: updated };
}

export async function resolveShadowArchiveBook({ isbn = "", title = "", author = "" } = {}, stateDir = DEFAULT_STATE_DIR) {
  const { settings } = getShadowLabSettings(stateDir);
  if (!settings.annasArchiveEnabled) {
    return {
      ok: false,
      enabled: false,
      error: "Legacy archive integration is disabled.",
      hits: [],
    };
  }

  const query = (isbn || `${title} ${author}`).trim();
  if (!query) {
    return { ok: false, enabled: true, available: false, query: "", hits: [], error: "A book query is required." };
  }
  return {
    ok: false,
    enabled: true,
    available: false,
    query,
    hits: [],
    error: "No archive resolver is connected. ReelOS will not fabricate or broker a download result.",
  };
}

export async function handleShadowLabRoute(req, res, { stateDir = DEFAULT_STATE_DIR } = {}) {
  const url = new URL(req.url, "http://127.0.0.1");
  const method = (req.method || "GET").toUpperCase();

  const send = (code, body) => {
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/api/settings/shadow-lab") {
    if (method === "GET") {
      const data = getShadowLabSettings(stateDir);
      send(200, data);
      return true;
    }
    if (method === "POST") {
      try {
        let bodyRaw = "";
        for await (const chunk of req) {
          bodyRaw += chunk;
        }
        const patch = bodyRaw ? JSON.parse(bodyRaw) : {};
        const saved = saveShadowLabSettings(patch, stateDir);
        send(200, saved);
        return true;
      } catch (err) {
        send(400, { ok: false, error: String(err) });
        return true;
      }
    }
  }

  if (url.pathname === "/api/shadow-lab/search" && method === "GET") {
    const isbn = url.searchParams.get("isbn") || "";
    const title = url.searchParams.get("title") || "";
    const author = url.searchParams.get("author") || "";
    const result = await resolveShadowArchiveBook({ isbn, title, author }, stateDir);
    send(result.ok ? 200 : result.enabled ? 501 : 403, result);
    return true;
  }

  return false;
}
