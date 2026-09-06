import { createServerFn } from "@tanstack/react-start";
import type { SourceId } from "./types";

export type PingResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export const pingSource = createServerFn({ method: "POST" })
  .validator((data: { source: SourceId; key: string }) => data)
  .handler(async ({ data }): Promise<PingResult> => {
    const key = data.key.trim();
    if (data.source === "local-vpn") {
      return { ok: true, message: "VPN client ready. Killswitch on." };
    }
    if (key.length < 10) {
      return { ok: false, error: "Provider rejected this key." };
    }
    try {
      if (data.source === "real-debrid") {
        const r = await fetch("https://api.real-debrid.com/rest/1.0/user", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        if (r.status === 401) return { ok: false, error: "Real-Debrid rejected this key." };
        if (!r.ok) return { ok: false, error: `Real-Debrid returned ${r.status}.` };
        const j = (await r.json()) as {
          username?: string;
          type?: string;
          premium?: number;
        };
        const days = typeof j.premium === "number" ? Math.max(0, Math.round(j.premium / 86400)) : 0;
        const grade = days > 0 || j.type === "premium" ? "Premium" : "Account";
        return {
          ok: true,
          message: `${grade} · ${days} days · ${j.username ?? "RD"}. Decypharr will be the download client.`,
        };
      }
      if (data.source === "alldebrid") {
        const url = new URL("https://api.alldebrid.com/v4/user");
        url.searchParams.set("agent", "ReelOS");
        url.searchParams.set("apikey", key);
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const j = (await r.json()) as { status?: string; data?: { user?: { username?: string; premiumUntil?: number } } };
        if (j.status !== "success") return { ok: false, error: "AllDebrid rejected this key." };
        return {
          ok: true,
          message: `AllDebrid live · ${j.data?.user?.username ?? "AD"}. Decypharr will be the download client.`,
        };
      }
      if (data.source === "premiumize") {
        const url = new URL("https://www.premiumize.me/api/account/info");
        url.searchParams.set("apikey", key);
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const j = (await r.json()) as { status?: string; premium_until?: number };
        if (j.status !== "success") return { ok: false, error: "Premiumize rejected this key." };
        return { ok: true, message: "Premiumize live. Decypharr will be the download client." };
      }
      if (data.source === "torbox") {
        const r = await fetch("https://api.torbox.app/v1/api/user/me", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return { ok: false, error: "TorBox rejected this key." };
        return { ok: true, message: "TorBox live. Official mount plus a shim so the engines can send work." };
      }
      return { ok: false, error: "Unknown source." };
    } catch {
      return { ok: false, error: "Could not reach the provider. Check the network and try again." };
    }
  });
