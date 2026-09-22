import { pingWizardSource } from "../wizard-honesty.mjs";

/**
 * Debrid & Ingestion Orchestration Service for ReelOS.
 * Manages provider validation (TorBox, Real-Debrid, AllDebrid, Premiumize),
 * compose profile computation, and Decypharr configuration generation.
 */

export function buildComposeProfiles(answers = {}, betaEnabled = false) {
  const p = ["indexers"];
  const intent = answers.intent || {};
  if (intent.movies) p.push("movies");
  if (intent.tv || intent.anime) p.push("tv");
  if (intent.music) p.push("music");
  if (betaEnabled) p.push("books");
  if (intent.movies || intent.tv || intent.anime) p.push("subtitles");

  // ReelOS is the player — no Jellyfin daemon, no Plex daemon (both are graveyard)
  if (answers.source === "local-vpn") {
    p.push("localvpn");
  } else {
    p.push("debrid");
  }
  return p;
}

export function generateDecypharrConfig(source = "torbox", apiKey = "") {
  // Decypharr owns the provider-specific filesystem bridge. ReelOS keeps the
  // rest of the media pipeline provider-neutral.
  const provider =
    source === "torbox"
      ? "torbox"
      : source === "alldebrid"
        ? "alldebrid"
        : source === "premiumize"
          ? "premiumize"
          : "realdebrid";

  return {
    debrids: [
      {
        provider,
        name: provider,
        api_key: String(apiKey || "").trim(),
        folder: "/mnt/debrid",
        use_webdav: false,
      },
    ],
    download_folder: "/mnt/reelos-cache",
    default_download_action: "symlink",
    use_auth: false,
    log_level: "info",
    port: "8282",
  };
}

export function generateEnvConfig(answers = {}, profiles = []) {
  const apiKey = answers.source === "local-vpn" ? "" : String(answers.apiKey || "").trim();
  const profilesStr = Array.isArray(profiles) ? profiles.join(",") : String(profiles || "");
  // Provider-aware API key naming. PLEX_CLAIM removed (Plex is graveyard).
  const apiKeyEnvName = (["realdebrid", "real-debrid"].includes(answers.source)) ? "RD_API_KEY" : "TORBOX_API_KEY";

  return [
    "PUID=1000",
    "PGID=1000",
    "TZ=UTC",
    `${apiKeyEnvName}=${apiKey}`,
    `SOURCE=${answers.source || "torbox"}`,
    `COMPOSE_PROFILES=${profilesStr}`,
    `VPN_SERVICE_PROVIDER=${answers.vpnProvider || "custom"}`,
  ].join("\n") + "\n";
}

export async function pingDebridProvider(source, key) {
  return pingWizardSource(String(source || ""), String(key || "").trim());
}

export function parseRetryAfter(headerValue, defaultSec = 15) {
  if (!headerValue) return defaultSec;
  const str = String(headerValue).trim();
  if (/^\d+$/.test(str)) {
    const val = parseInt(str, 10);
    return isNaN(val) ? defaultSec : Math.max(0, val);
  }
  const dateVal = Date.parse(str);
  if (!isNaN(dateVal)) {
    const diffSec = Math.ceil((dateVal - Date.now()) / 1000);
    return Math.max(0, diffSec);
  }
  return defaultSec;
}

export class TorBoxRateLimiter {
  constructor(options = {}) {
    this.capacity = options.capacity || 5;
    this.refillRate = options.refillRate || 1; // 1 token per second
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.ttlMs = options.ttlMs || 10 * 60 * 1000; // 10 minutes
    this.cache = new Map();
    this.inFlight = new Map();
    this.backoffUntil = 0;

    // Upstream Resilience & Circuit Breaker parameters
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30000;
    this.jitterMs = options.jitterMs ?? 250;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 3;

    this.circuitState = "CLOSED"; // "CLOSED", "OPEN", "HALF_OPEN"
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = 0;
    this.faultInterceptor = options.faultInterceptor || null;
    // Tracks how many upstream calls are currently in-flight.
    // Used to pre-trip-guard: refuse tokens when failures + in-flight >= failureThreshold.
    this.activeUpstream = 0;
  }

  setFaultInterceptor(fn, chaosInstance = null) {
    this.faultInterceptor = fn;
    if (chaosInstance && typeof chaosInstance.registerCircuitBreaker === "function") {
      chaosInstance.registerCircuitBreaker(this);
    }
  }

  getCircuitState() {
    return {
      state: this.circuitState,
      consecutiveFailures: this.consecutiveFailures,
      circuitOpenedAt: this.circuitOpenedAt,
      backoffUntil: this.backoffUntil,
    };
  }

  resetCircuit() {
    this.circuitState = "CLOSED";
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = 0;
    this.backoffUntil = 0;
  }

  reset() {
    this.resetCircuit();
    this.clearCache();
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  getStatus() {
    const rawKey = process.env.TORBOX_API_KEY || "";
    const masked = rawKey
      ? rawKey.length > 6
        ? `${rawKey.slice(0, 3)}****${rawKey.slice(-4)}`
        : "configured"
      : null;
    return {
      tokens: this.tokens,
      capacity: this.capacity,
      circuitState: this.circuitState,
      airGap: true,
      activeTokenMasked: masked,
      configured: Boolean(rawKey),
    };
  }

  calculateBackoff(failures = 1, retryAfterSec = null) {
    const jitter = Math.floor(Math.random() * (this.jitterMs !== undefined ? this.jitterMs : 250));
    if (retryAfterSec !== null && retryAfterSec !== undefined && retryAfterSec > 0) {
      return retryAfterSec * 1000 + jitter;
    }
    const exp = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, Math.max(0, failures - 1)));
    return exp + jitter;
  }

  refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRate);
    this.lastRefill = now;
  }

  async acquireToken() {
    while (true) {
      // Circuit breaker fast-fail: OPEN circuit must not allow sleeping threads to drain through.
      if (this.circuitState === "OPEN") {
        const timeSinceOpen = Date.now() - this.circuitOpenedAt;
        if (timeSinceOpen < this.resetTimeoutMs) {
          throw new Error("TorBox circuit breaker is OPEN - failing fast (service unavailable)");
        }
        // Timeout elapsed — transition to HALF_OPEN for probe
        this.circuitState = "HALF_OPEN";
      }

      const now = Date.now();
      if (now < this.backoffUntil) {
        const waitMs = this.backoffUntil - now;
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 500)));
        continue;
      }

      this.refill();
      if (this.tokens >= 1) {
        // Pre-trip guard: if current failures + in-flight upstream calls would trip the circuit,
        // refuse the token now rather than after those responses come back.
        if (
          this.circuitState === "CLOSED" &&
          this.consecutiveFailures + this.activeUpstream >= this.failureThreshold
        ) {
          // Spin-wait for in-flight calls to resolve and circuit to trip
          await new Promise((resolve) => setTimeout(resolve, 10));
          continue;
        }
        this.tokens -= 1;
        // Final guard at token-grant moment: circuit may have tripped concurrently.
        if (this.circuitState === "OPEN") {
          const timeSinceOpen = Date.now() - this.circuitOpenedAt;
          if (timeSinceOpen < this.resetTimeoutMs) {
            this.tokens += 1; // return the token
            throw new Error("TorBox circuit breaker is OPEN - failing fast (service unavailable)");
          }
          this.circuitState = "HALF_OPEN";
        }
        return true;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillRate) * 1000);
      await new Promise((resolve) => setTimeout(resolve, Math.max(50, Math.min(waitMs, 1000))));
    }
  }

  getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  setCached(key, data, customTtlMs) {
    const ttl = customTtlMs || this.ttlMs;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  clearCache() {
    this.cache.clear();
  }

  async executeRequest(cacheKey, requestFn, options = {}) {
    if (!options.bypassCache) {
      const cached = this.getCached(cacheKey);
      if (cached !== null) return { fromCache: true, data: cached };
    }

    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey);
    }

    const promise = (async () => {
      const maxRetries = options.maxRetries !== undefined ? options.maxRetries : this.maxRetries;
      let attempt = 0;

      try {
        while (true) {
          // 1. Check circuit breaker state
          if (this.circuitState === "OPEN") {
            const timeSinceOpen = Date.now() - this.circuitOpenedAt;
            if (timeSinceOpen >= this.resetTimeoutMs) {
              this.circuitState = "HALF_OPEN";
            } else {
              throw new Error("TorBox circuit breaker is OPEN - failing fast (service unavailable)");
            }
          }

          await this.acquireToken();

          // Double-check: a concurrent request may have tripped the circuit while we waited for a token.
          if (this.circuitState === "OPEN") {
            throw new Error("TorBox circuit breaker is OPEN - failing fast (service unavailable)");
          }

          let resp = null;
          let threwError = null;

          this.activeUpstream++;
          try {
            if (typeof this.faultInterceptor === "function") {
              const fault = await this.faultInterceptor(cacheKey);
              if (fault) {
                resp = fault;
              } else {
                resp = await requestFn();
              }
            } else {
              resp = await requestFn();
            }
          } catch (err) {
            threwError = err;
          } finally {
            this.activeUpstream--;
          }

          // Handle thrown network or execution error
          if (threwError) {
            this.consecutiveFailures++;
            if (this.circuitState === "HALF_OPEN" || this.consecutiveFailures >= this.failureThreshold) {
              this.circuitState = "OPEN";
              this.circuitOpenedAt = Date.now();
            }

            if (this.circuitState !== "OPEN" && attempt < maxRetries) {
              attempt++;
              const backoffMs = this.calculateBackoff(this.consecutiveFailures);
              this.backoffUntil = Date.now() + backoffMs;
              await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 10000)));
              continue;
            }
            throw threwError;
          }

          // Handle HTTP 429
          if (resp && resp.status === 429) {
            this.consecutiveFailures++;
            if (this.circuitState === "HALF_OPEN" || this.consecutiveFailures >= this.failureThreshold) {
              this.circuitState = "OPEN";
              this.circuitOpenedAt = Date.now();
            }

            const retryHeader = resp.headers && typeof resp.headers.get === "function" ? resp.headers.get("retry-after") : null;
            const retryAfterSec = retryHeader ? parseRetryAfter(retryHeader, null) : null;
            const backoffMs = this.calculateBackoff(this.consecutiveFailures, retryAfterSec);
            this.backoffUntil = Date.now() + backoffMs;

            if (this.circuitState !== "OPEN" && attempt < maxRetries) {
              attempt++;
              await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 10000)));
              continue;
            }
            throw new Error(`TorBox rate limit (429), backoff until ${new Date(this.backoffUntil).toISOString()}`);
          }

          // Handle HTTP 503 (Cloudflare or maintenance outage)
          if (resp && resp.status === 503) {
            this.consecutiveFailures++;
            if (this.circuitState === "HALF_OPEN" || this.consecutiveFailures >= this.failureThreshold) {
              this.circuitState = "OPEN";
              this.circuitOpenedAt = Date.now();
            }

            const retryHeader = resp.headers && typeof resp.headers.get === "function" ? resp.headers.get("retry-after") : null;
            const retryAfterSec = retryHeader ? parseRetryAfter(retryHeader, null) : null;
            const backoffMs = this.calculateBackoff(this.consecutiveFailures, retryAfterSec);
            this.backoffUntil = Date.now() + backoffMs;

            if (this.circuitState !== "OPEN" && attempt < maxRetries) {
              attempt++;
              await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 10000)));
              continue;
            }
            throw new Error(`TorBox service unavailable (503) after ${attempt + 1} attempts`);
          }

          // Handle HTTP 5xx other server errors
          if (resp && typeof resp.status === "number" && resp.status >= 500) {
            this.consecutiveFailures++;
            if (this.circuitState === "HALF_OPEN" || this.consecutiveFailures >= this.failureThreshold) {
              this.circuitState = "OPEN";
              this.circuitOpenedAt = Date.now();
            }

            if (this.circuitState !== "OPEN" && attempt < maxRetries) {
              attempt++;
              const backoffMs = this.calculateBackoff(this.consecutiveFailures);
              this.backoffUntil = Date.now() + backoffMs;
              await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 10000)));
              continue;
            }
            throw new Error(`TorBox upstream error (${resp.status})`);
          }

          // Extract response data safely without unhandled JSON syntax crashes
          let data = resp;
          if (resp && typeof resp.json === "function") {
            try {
              data = await resp.json();
            } catch (jsonErr) {
              this.consecutiveFailures++;
              if (this.circuitState === "HALF_OPEN" || this.consecutiveFailures >= this.failureThreshold) {
                this.circuitState = "OPEN";
                this.circuitOpenedAt = Date.now();
              }
              throw new Error(`Failed to parse TorBox upstream JSON: ${jsonErr.message}`);
            }
          }

          // Success: reset failures and restore circuit to CLOSED if in HALF_OPEN
          this.consecutiveFailures = 0;
          if (this.circuitState === "HALF_OPEN") {
            this.circuitState = "CLOSED";
          }

          this.setCached(cacheKey, data, options.ttlMs);
          return { fromCache: false, data };
        }
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, promise);
    return promise;
  }
}

export const torBoxRateLimiter = new TorBoxRateLimiter();

// Wire ChaosMonkeyService to torBoxRateLimiter for simulated faults & circuit breaker resets
try {
  import("./chaos-monkey-service.mjs").then((m) => {
    if (m?.chaosMonkeyService) {
      torBoxRateLimiter.setFaultInterceptor(() => m.chaosMonkeyService.generateDebridFault());
      if (typeof m.chaosMonkeyService.registerCircuitBreaker === "function") {
        m.chaosMonkeyService.registerCircuitBreaker(torBoxRateLimiter);
      }
    }
  }).catch(() => {});
} catch {}
