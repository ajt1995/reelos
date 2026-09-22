import { createHash } from "node:crypto";
import { torBoxRateLimiter } from "./debrid-service.mjs";
import { checkCachedTorrents, getDebridApiKey } from "../reelflow/cache-checker.mjs";

const API = "https://api.torbox.app/v1/api";
const HASH = /^[a-f0-9]{40}$/i;
const VIDEO = /\.(mkv|mp4|m4v|webm|avi|mov|ts)$/i;
const UNAVAILABLE_STATES = new Set(["expired", "incomplete", "error", "failed"]);
const READY_STATES = new Set(["completed", "cached", "seeding", "uploading"]);

function providerError(message, code, status) {
  return Object.assign(new Error(message), { code, status, publicMessage: message });
}

function dataOf(json) {
  return json?.data ?? json;
}

function torrentRows(json) {
  const data = dataOf(json);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.torrents)) return data.torrents;
  return data && typeof data === "object" ? [data] : [];
}

function candidateHash(candidate) {
  const direct = String(candidate?.hash || candidate?.infohash || "").trim().toLowerCase();
  if (HASH.test(direct)) return direct;
  const match = String(candidate?.magnet || candidate?.url || "").match(/xt=urn:btih:([a-f0-9]{40})/i);
  return match ? match[1].toLowerCase() : "";
}

function selectVideoFile(files, requestedId = null) {
  const usable = (Array.isArray(files) ? files : []).filter((file) => {
    const name = String(file?.name || file?.short_name || file?.path || "");
    return file?.id != null && VIDEO.test(name) && Number(file?.size || 0) > 0;
  });
  if (requestedId != null) {
    const exact = usable.filter((file) => String(file.id) === String(requestedId));
    return exact.length === 1 ? exact[0] : null;
  }
  usable.sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
  return usable.length === 1 || usable[0]?.size !== usable[1]?.size ? usable[0] || null : null;
}

export class TorBoxProviderAdapter {
  constructor({ apiKey = "", fetchImpl = fetch, rateLimiter = torBoxRateLimiter, pollIntervalMs = 5_000, maxWaitMs = 10 * 60_000 } = {}) {
    this.apiKey = String(apiKey || getDebridApiKey()).trim();
    this.fetch = fetchImpl;
    this.rateLimiter = rateLimiter;
    this.pollIntervalMs = pollIntervalMs;
    this.maxWaitMs = maxWaitMs;
    this.scope = this.apiKey ? createHash("sha256").update(this.apiKey).digest("hex").slice(0, 16) : "missing";
  }

  requireKey() {
    if (!this.apiKey) throw providerError("Connect and validate TorBox before requesting this title.", "provider_not_connected", 401);
  }

  async request(path, { method = "GET", body, signal, cacheKey, bypassCache = false } = {}) {
    this.requireKey();
    const call = async () => {
      const response = await this.fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
          "User-Agent": "ReelOS/2.5 native-provider",
        },
        body: body?.toString(),
        signal: signal || AbortSignal.timeout(10_000),
      });
      if (response.status === 401 || response.status === 403) throw providerError("TorBox rejected this connection.", "provider_unauthorized", response.status);
      if (response.status === 429) throw providerError("TorBox asked ReelOS to slow down. This request will remain recoverable.", "provider_rate_limited", 429);
      if (!response.ok) throw providerError(`TorBox is temporarily unavailable (${response.status}).`, "provider_unavailable", response.status);
      return response.json();
    };
    if (!this.rateLimiter?.executeRequest) return call();
    const result = await this.rateLimiter.executeRequest(cacheKey || `${method}:${path}`, call, { bypassCache });
    return result?.data ?? result;
  }

  async validate({ signal } = {}) {
    const json = await this.request("/user/me", { signal, cacheKey: `native:${this.scope}:me` });
    return { ok: Boolean(dataOf(json)), provider: "torbox" };
  }

  async checkAvailability(candidate, { signal } = {}) {
    const hash = candidateHash(candidate);
    if (!hash) return { available: false, cached: false, reason: "missing_infohash" };
    const checked = await checkCachedTorrents([hash], this.apiKey, { provider: "torbox", fetchImpl: this.fetch, signal });
    return { available: true, hash, ...(checked[hash] || { cached: false }) };
  }

  async acquire(candidate, { signal, onProgress } = {}) {
    const hash = candidateHash(candidate);
    const magnet = String(candidate?.magnet || candidate?.url || "").trim();
    if (!hash || !magnet.startsWith("magnet:?")) throw providerError("This release does not contain a usable provider identity.", "candidate_unresolvable", 400);
    onProgress?.(5);
    const form = new URLSearchParams({ magnet });
    const json = await this.request("/torrents/createtorrent", {
      method: "POST", body: form, signal, cacheKey: `native:${this.scope}:create:${hash}`, bypassCache: true,
    });
    const data = dataOf(json) || {};
    const torrentId = data.torrent_id ?? data.id ?? null;
    onProgress?.(20);
    return {
      hash,
      torrentId,
      requestedFileId: candidate.fileId ?? null,
      receipt: { provider: "torbox", hash, torrentId, acceptedAt: Date.now() },
    };
  }

  async poll(acquired, { signal } = {}) {
    const id = acquired?.torrentId ?? acquired?.hash;
    if (id == null) throw providerError("TorBox did not return a job identity.", "provider_job_unmapped", 502);
    const json = await this.request(`/torrents/mylist?id=${encodeURIComponent(String(id))}`, {
      signal, cacheKey: `native:${this.scope}:list:${id}`, bypassCache: true,
    });
    const rows = torrentRows(json).filter((row) => String(row?.id ?? row?.hash ?? "") === String(id) || String(row?.hash || "").toLowerCase() === acquired.hash);
    if (rows.length !== 1) throw providerError("TorBox could not uniquely resolve the requested item.", "provider_job_ambiguous", 409);
    return rows[0];
  }

  async verify(acquired, { signal } = {}) {
    const torrent = await this.poll(acquired, { signal });
    const state = String(torrent.download_state || torrent.state || "").toLowerCase();
    if (UNAVAILABLE_STATES.has(state)) throw providerError("The TorBox item is not currently playable.", "provider_item_unavailable", 409);
    if (!READY_STATES.has(state)) throw providerError("TorBox is still preparing this title.", "provider_item_pending", 202);
    const file = selectVideoFile(torrent.files, acquired.requestedFileId);
    if (!file) throw providerError("ReelOS could not select one exact playable video file.", "provider_file_ambiguous", 409);
    const hash = String(torrent.hash || acquired.hash || "").toLowerCase();
    if (!HASH.test(hash)) throw providerError("TorBox returned an invalid media identity.", "provider_identity_invalid", 502);
    const duration = Number(torrent.duration || file.duration || 0);
    const editionId = `torbox-${hash}-${file.id}${duration > 0 ? `-${Math.round(duration)}` : ""}`;
    return {
      editionId,
      aliases: [],
      source: {
        id: `torbox-${hash}-${file.id}`,
        kind: "provider_stream",
        provider: "torbox",
        verified: true,
        verifiedAt: Date.now(),
        binding: { infohash: hash, torrentId: torrent.id ?? acquired.torrentId, fileId: file.id, sizeBytes: Number(file.size || 0) },
      },
    };
  }

  async waitUntilReady(acquired, { signal, onProgress } = {}) {
    const startedAt = Date.now();
    let attempts = 0;
    while (Date.now() - startedAt <= this.maxWaitMs) {
      if (signal?.aborted) throw providerError("Preparation was cancelled.", "cancelled", 499);
      try {
        return await this.verify(acquired, { signal });
      } catch (error) {
        if (error?.code !== "provider_item_pending") throw error;
      }
      attempts += 1;
      onProgress?.(Math.min(95, 20 + attempts));
      await new Promise((resolve, reject) => {
        const done = () => { signal?.removeEventListener("abort", cancel); resolve(); };
        const timer = setTimeout(done, this.pollIntervalMs);
        const cancel = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(providerError("Preparation was cancelled.", "cancelled", 499)); };
        signal?.addEventListener("abort", cancel, { once: true });
      });
    }
    throw providerError("TorBox is still preparing this title. Try again shortly.", "provider_wait_timeout", 408);
  }

  async cancel(acquired, { signal } = {}) {
    if (acquired?.torrentId == null) return { ok: false, reason: "provider_job_unmapped" };
    const body = new URLSearchParams({ torrent_id: String(acquired.torrentId), operation: "delete" });
    await this.request("/torrents/controltorrent", {
      method: "POST", body, signal, cacheKey: `native:${this.scope}:cancel:${acquired.torrentId}`, bypassCache: true,
    });
    return { ok: true };
  }
}

export const torBoxFileSelector = selectVideoFile;
