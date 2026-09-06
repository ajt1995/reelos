import { createServerFn } from "@tanstack/react-start";
import { getTitle, rememberCatalogTitles } from "./catalog";
import { syntheticRelease } from "./adapter";
import type { Title } from "./types";

const APPLIANCE = process.env.REELOS_APPLIANCE === "1";
const CHANNEL_URL =
  process.env.REELOS_CHANNEL_URL ||
  "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json";

function xmlKey(file: string): string | null {
  const fs = require("node:fs") as typeof import("node:fs");
  if (!fs.existsSync(file)) return null;
  const m = /<ApiKey>([^<]+)<\/ApiKey>/.exec(fs.readFileSync(file, "utf8"));
  return m?.[1] ?? null;
}

async function api(
  url: string,
  key: string,
  method: string,
  body?: unknown,
  form?: Record<string, string>,
): Promise<unknown> {
  const headers: Record<string, string> = { "X-Api-Key": key };
  let payload: BodyInit | undefined;
  if (form) {
    const fd = new URLSearchParams(form);
    payload = fd.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  if (!res.ok) throw new Error(`${method} ${url} ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function radarrKey() {
  return xmlKey("/opt/reelos/compose/configs/radarr/config.xml");
}
function sonarrKey() {
  return xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
}
function prowlarrKey() {
  return xmlKey("/opt/reelos/compose/configs/prowlarr/config.xml");
}

export const checkChannel = createServerFn({ method: "GET" }).handler(async () => {
  const fs = await import("node:fs");
  const local = fs.existsSync("/opt/reelos/VERSION")
    ? fs.readFileSync("/opt/reelos/VERSION", "utf8").trim()
    : fs.existsSync("/workspace/VERSION")
      ? fs.readFileSync("/workspace/VERSION", "utf8").trim()
      : "1.2.0";
  try {
    const urls = [
      CHANNEL_URL,
      "https://cdn.jsdelivr.net/gh/ajt1995/reelos@main/channel.json",
    ];
    let ch: { version: string; notes?: string[] } | null = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          ch = (await res.json()) as { version: string; notes?: string[] };
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (!ch) throw new Error("channel unreachable");
    return {
      ok: true as const,
      local,
      remote: ch.version,
      notes: ch.notes ?? [],
      available: ch.version !== local,
    };
  } catch (e) {
    return { ok: false as const, local, remote: local, notes: [], available: false, error: String(e) };
  }
});

export const applyChannel = createServerFn({ method: "POST" }).handler(async () => {
  if (!APPLIANCE) return { ok: false as const, error: "not an appliance" };
  const { spawn } = await import("node:child_process");
  const code: number = await new Promise((resolve) => {
    const child = spawn("bash", ["/opt/reelos/bin/reelos-update.sh", "apply"], { stdio: "ignore" });
    child.on("exit", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
  return { ok: code === 0 };
});

export const pullStackImages = createServerFn({ method: "POST" }).handler(async () => {
  if (!APPLIANCE) return { ok: false as const, error: "not an appliance" };
  const { spawn } = await import("node:child_process");
  const code: number = await new Promise((resolve) => {
    const child = spawn("docker", ["compose", "pull"], {
      cwd: "/opt/reelos/compose",
      stdio: "ignore",
    });
    child.on("exit", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
  return { ok: code === 0 };
});

export const pushRequest = createServerFn({ method: "POST" })
  .validator((data: { titleId: string; season?: number; hash?: string }) => data)
  .handler(async ({ data }) => {
    if (!APPLIANCE) return { ok: true as const, simulated: true as const };
    if (data.titleId.startsWith("tmdb-")) {
      const rk = radarrKey();
      const tmdb = data.titleId.slice(5);
      if (rk) {
        try {
          const hits = (await api(
            `http://127.0.0.1:7878/api/v3/movie/lookup?term=${encodeURIComponent(`tmdb:${tmdb}`)}`,
            rk,
            "GET",
          )) as Array<Record<string, unknown>>;
          const movie = hits?.[0];
          if (movie) {
            await api("http://127.0.0.1:7878/api/v3/movie", rk, "POST", {
              ...movie,
              addOptions: { searchForMovie: true },
              rootFolderPath: "/mnt/symlinks",
              monitored: true,
            });
          }
        } catch {
          /* add may fail if already exists */
        }
      }
      return { ok: true as const, simulated: false as const };
    }
    if (data.titleId.startsWith("tvdb-")) {
      const sk = sonarrKey();
      const tvdb = data.titleId.slice(5);
      if (sk) {
        try {
          const hits = (await api(
            `http://127.0.0.1:8989/api/v3/series/lookup?term=${encodeURIComponent(`tvdb:${tvdb}`)}`,
            sk,
            "GET",
          )) as Array<Record<string, unknown>>;
          const series = hits?.[0];
          if (series) {
            await api("http://127.0.0.1:8989/api/v3/series", sk, "POST", {
              ...series,
              addOptions: { searchForMissingEpisodes: true },
              rootFolderPath: "/mnt/symlinks",
              monitored: true,
              seasonFolder: true,
            });
          }
        } catch {
          /* already exists */
        }
      }
      return { ok: true as const, simulated: false as const };
    }
    const title = getTitle(data.titleId);
    if (!title) return { ok: false as const, error: "unknown title" };
    const hash =
      data.hash ||
      syntheticRelease(title, "hybrid")
        .replace(/[^a-f0-9]/gi, "")
        .slice(0, 40);
    const magnet = hash.length >= 32 ? `magnet:?xt=urn:btih:${hash}` : "";
    try {
      await fetch("http://127.0.0.1:8282/api/v2/torrents/add", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          urls: magnet,
          category: title.kind === "tv" || title.kind === "anime" ? "sonarr" : "radarr",
        }).toString(),
      });
    } catch {
      /* adapter may be down */
    }
    const key = title.kind === "tv" || title.kind === "anime" ? sonarrKey() : radarrKey();
    const port = title.kind === "tv" || title.kind === "anime" ? 8989 : 7878;
    if (key && magnet) {
      try {
        await api(`http://127.0.0.1:${port}/api/v3/release/push`, key, "POST", {
          title: `${title.title} ${title.year}`,
          downloadUrl: magnet,
          protocol: "torrent",
          publishDate: new Date().toISOString(),
        });
      } catch {
        /* engine may not accept a synthetic hash — adapter still got it */
      }
    }
    return { ok: true as const, simulated: false as const };
  });

export const pushIndexer = createServerFn({ method: "POST" })
  .validator((data: { name: string; url: string; key: string }) => data)
  .handler(async ({ data }) => {
    if (!APPLIANCE) return { ok: true as const, simulated: true as const };
    const key = prowlarrKey();
    if (!key) return { ok: false as const, error: "prowlarr not ready" };
    try {
      await api("http://127.0.0.1:9696/api/v1/indexer", key, "POST", {
        name: data.name,
        enable: true,
        appProfileId: 1,
        protocol: "torrent",
        implementation: "Torznab",
        implementationName: "Torznab",
        configContract: "TorznabSettings",
        fields: [
          { name: "baseUrl", value: data.url },
          { name: "apiPath", value: "/api" },
          { name: "apiKey", value: data.key },
        ],
      });
      return { ok: true as const, simulated: false as const };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });

export const lookupMedia = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }) => {
    type Hit = Title;
    const q = data.q.trim();
    if (q.length < 2) return { titles: [] as Hit[] };
    const titles: Hit[] = [];
    const rk = radarrKey();
    if (rk) {
      try {
        const hits = (await api(
          `http://127.0.0.1:7878/api/v3/movie/lookup?term=${encodeURIComponent(q)}`,
          rk,
          "GET",
        )) as Array<Record<string, unknown>>;
        for (const h of (hits || []).slice(0, 6)) {
          const tmdb = h.tmdbId;
          if (!tmdb) continue;
          const genres = Array.isArray(h.genres)
            ? (h.genres as Array<string | { name?: string }>).map((g) => (typeof g === "string" ? g : g.name || "")).filter(Boolean)
            : [];
          titles.push({
            id: `tmdb-${tmdb}`,
            kind: "movie",
            title: String(h.title || "Untitled"),
            year: Number(h.year) || 0,
            overview: String(h.overview || ""),
            poster: String(h.remotePoster || ""),
            rating: Number((h.ratings as { tmdb?: { value?: number } } | undefined)?.tmdb?.value || 0),
            genres,
            maxQuality: "4k",
            popularity: 50,
          });
        }
      } catch {
        /* radarr down */
      }
    }
    const sk = sonarrKey();
    if (sk) {
      try {
        const hits = (await api(
          `http://127.0.0.1:8989/api/v3/series/lookup?term=${encodeURIComponent(q)}`,
          sk,
          "GET",
        )) as Array<Record<string, unknown>>;
        for (const h of (hits || []).slice(0, 6)) {
          const tvdb = h.tvdbId;
          if (!tvdb) continue;
          titles.push({
            id: `tvdb-${tvdb}`,
            kind: "tv",
            title: String(h.title || "Untitled"),
            year: Number(h.year) || 0,
            overview: String(h.overview || ""),
            poster: String(h.remotePoster || ""),
            rating: Number((h.ratings as { tmdb?: { value?: number } } | undefined)?.tmdb?.value || 0),
            genres: [],
            maxQuality: "4k",
            popularity: 50,
            seasons: Array.isArray(h.seasons) ? (h.seasons as unknown[]).length : undefined,
          } as Hit);
        }
      } catch {
        /* sonarr down */
      }
    }
    rememberCatalogTitles(titles);
    return { titles };
  });

export const runDoctor = createServerFn({ method: "GET" }).handler(async () => {
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs");
  const script = "/opt/reelos/bin/reelos-doctor.py";
  if (!APPLIANCE || !fs.existsSync(script)) {
    return { ok: true as const, live: false as const, version: "1.2.1.1", checks: [] as { ok: boolean; label: string; detail: string }[] };
  }
  const raw: string = await new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn("python3", [script]);
    child.stdout.on("data", (c) => chunks.push(c as Buffer));
    child.on("exit", () => resolve(Buffer.concat(chunks).toString("utf8")));
    child.on("error", () => resolve(""));
  });
  try {
    const parsed = JSON.parse(raw) as {
      version: string;
      checks: { ok: boolean; label: string; detail: string }[];
    };
    return { ok: true as const, live: true as const, ...parsed };
  } catch {
    return { ok: false as const, live: true as const, version: "1.2.1.1", checks: [] };
  }
});

const TERM_DIR = APPLIANCE ? "/var/lib/reelos" : "/tmp/reelos-term";
const TERM_LOG = `${TERM_DIR}/term.log`;
const TERM_PID = `${TERM_DIR}/term.pid`;
const TERM_CWD = APPLIANCE ? "/home/reelos" : "/workspace";

function termAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export const runTerminal = createServerFn({ method: "POST" })
  .validator((data: { command?: string; kill?: boolean }) => data)
  .handler(async ({ data }) => {
    const fs = await import("node:fs");
    const { spawn } = await import("node:child_process");
    fs.mkdirSync(TERM_DIR, { recursive: true });

    const pidRaw = fs.existsSync(TERM_PID) ? fs.readFileSync(TERM_PID, "utf8").trim() : "";
    const pid = Number(pidRaw) || 0;
    let running = pid > 0 && termAlive(pid);

    if (data.kill && running) {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          /* gone */
        }
      }
      running = false;
      fs.appendFileSync(TERM_LOG, "\n^C\n");
    }

    if (data.command && data.command.trim()) {
      if (running) {
        const output = fs.existsSync(TERM_LOG) ? fs.readFileSync(TERM_LOG, "utf8") : "";
        return { ok: false as const, running: true, output, cwd: TERM_CWD, error: "already running" };
      }
      const command = data.command.replace(/\r\n/g, "\n").slice(0, 32_000);
      const stamp = new Date().toISOString().slice(11, 19);
      fs.writeFileSync(
        TERM_LOG,
        `reelos# ${command.split("\n").join("\n> ")}\n`,
      );
      const out = fs.openSync(TERM_LOG, "a");
      const child = spawn("bash", ["-lc", command], {
        cwd: fs.existsSync(TERM_CWD) ? TERM_CWD : "/",
        env: { ...process.env, HOME: APPLIANCE ? "/home/reelos" : process.env.HOME, TERM: "xterm-256color" },
        detached: true,
        stdio: ["ignore", out, out],
      });
      fs.closeSync(out);
      if (child.pid) {
        fs.writeFileSync(TERM_PID, String(child.pid));
        child.on("exit", (code, signal) => {
          try {
            fs.appendFileSync(
              TERM_LOG,
              `\n[${stamp} exit ${code ?? signal ?? "?"}] \n`,
            );
            if (fs.existsSync(TERM_PID) && fs.readFileSync(TERM_PID, "utf8").trim() === String(child.pid)) {
              fs.unlinkSync(TERM_PID);
            }
          } catch {
            /* log gone */
          }
        });
        child.unref();
        running = true;
      } else {
        fs.appendFileSync(TERM_LOG, "failed to spawn\n");
        running = false;
      }
    }

    const livePid = Number(fs.existsSync(TERM_PID) ? fs.readFileSync(TERM_PID, "utf8").trim() : "") || 0;
    running = livePid > 0 && termAlive(livePid);
    let output = fs.existsSync(TERM_LOG) ? fs.readFileSync(TERM_LOG, "utf8") : "";
    if (output.length > 200_000) output = output.slice(-200_000);
    return { ok: true as const, running, output, cwd: TERM_CWD };
  });
