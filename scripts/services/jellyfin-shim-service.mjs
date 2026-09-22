import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { streamLocalFile } from "./neural-stream-server.mjs";
import { authorizePlaybackItem, playbackItemId, resolvePlaybackItem, sendPlaybackFailure, verifiedPlaybackFile } from "./playback-access-service.mjs";
import { enrichTitleSync } from "./metadata-enricher.mjs";

const DEFAULT_STATE_DIR =
  process.env.REELOS_STATE ||
  (process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state")
    : "/var/lib/reelos");

const SERVER_ID = "reelos-appliance-001";
const DEFAULT_USER_ID = "reelos-resident-001";
const DEFAULT_USER_NAME = "Primary";

/**
 * Creates the lightweight Jellyfin Shim request dispatcher.
 * Handles the 14 core REST endpoints needed by Swiftfin, Infuse, Android TV,
 * and web players to browse and DirectPlay without a .NET server.
 */
export function createJellyfinShimHandler(opts = {}) {
  const stateDir = opts.stateDir || DEFAULT_STATE_DIR;
  // Only structured server records bind identity, provenance, and maturity.
  // Legacy path-only verifiedMediaById injections cannot authorize bytes.
  const playbackOptions = { ...opts, stateDir, libraryItems: opts.libraryItems || opts.fallbackTitles };
  const progressFile = path.join(stateDir, "playback-progress.json");

  let cachedProgressMap = null;
  let cachedProgressAt = 0;

  function getProgressMap() {
    const now = Date.now();
    if (cachedProgressMap && now - cachedProgressAt < 1500) {
      return cachedProgressMap;
    }
    try {
      if (fs.existsSync(progressFile)) {
        cachedProgressMap = JSON.parse(fs.readFileSync(progressFile, "utf8"));
        cachedProgressAt = now;
        return cachedProgressMap;
      }
    } catch {}
    cachedProgressMap = cachedProgressMap || {};
    return cachedProgressMap;
  }

  function saveProgress(itemId, ticks, isStopped = false) {
    try {
      const map = getProgressMap();
      map[itemId] = {
        positionTicks: Number(ticks) || 0,
        updatedAt: Date.now(),
        completed: isStopped && ticks > 0,
      };
      cachedProgressMap = map;
      cachedProgressAt = Date.now();
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(progressFile, JSON.stringify(map, null, 2), "utf8");
    } catch {}
  }

  let cachedShelfTitles = null;
  let cachedShelfAt = 0;

  function loadShelfTitles() {
    const now = Date.now();
    if (cachedShelfTitles && now - cachedShelfAt < 60000) {
      return cachedShelfTitles;
    }
    const shelfPath = path.join(stateDir, "library-shelf.json");
    const bakPath = path.join(stateDir, "library-shelf.json.bak");
    const cachePath = path.join(stateDir, "metadata-cache.json");

    let raw = null;
    for (const p of [shelfPath, bakPath]) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, "utf8");
          if (content && content.trim().length > 0) {
            raw = JSON.parse(content);
            if (Array.isArray(raw?.titles) && raw.titles.length > 0) break;
          }
        }
      } catch {}
    }

    if (raw && Array.isArray(raw.titles) && raw.titles.length > 0) {
      cachedShelfTitles = raw.titles;
      cachedShelfAt = now;
      return cachedShelfTitles;
    }

    // Auto-heal from pre-warmed Day-0 cache
    try {
      if (fs.existsSync(cachePath)) {
        const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
        const cachedList = Object.values(cache);
        if (cachedList.length > 0) {
          cachedShelfTitles = cachedList;
          cachedShelfAt = now;
          return cachedShelfTitles;
        }
      }
    } catch {}

    return opts.fallbackTitles || [];
  }

  let cachedResidents = null;
  let cachedResidentsAt = 0;

  function resolveResidents() {
    const now = Date.now();
    if (cachedResidents && now - cachedResidentsAt < 60000) {
      return cachedResidents;
    }
    const profilesPath = path.join(stateDir, "profiles.json");
    const bakPath = path.join(stateDir, "profiles.json.bak");

    let p = null;
    for (const file of [profilesPath, bakPath]) {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, "utf8");
          if (content && content.trim().length > 0) {
            p = JSON.parse(content);
            if (Array.isArray(p?.residents) && p.residents.length > 0) break;
          }
        }
      } catch {}
    }

    if (p && Array.isArray(p.residents) && p.residents.length > 0) {
      cachedResidents = p.residents.map((r) => ({
        Name: r.name || "Resident",
        Id: r.id || DEFAULT_USER_ID,
        HasPassword: false,
        EnableAutoLogin: true,
        Policy: {
          IsAdministrator: !r.isGuest && !r.isKids,
          EnableMediaPlayback: true,
          EnableContentDownloading: true,
          EnableAllFolders: true,
        },
      }));
      cachedResidentsAt = now;
      return cachedResidents;
    }
    return [
      {
        Name: DEFAULT_USER_NAME,
        Id: DEFAULT_USER_ID,
        HasPassword: false,
        EnableAutoLogin: true,
        Policy: {
          IsAdministrator: true,
          EnableMediaPlayback: true,
          EnableContentDownloading: true,
          EnableAllFolders: true,
        },
      },
    ];
  }

  function resolveUserName() {
    try {
      const profilesPath = path.join(stateDir, "profiles.json");
      if (fs.existsSync(profilesPath)) {
        const p = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
        if (Array.isArray(p.residents) && p.residents.length > 0) {
          const active = p.residents.find((r) => r.id === p.activeResidentId) || p.residents[0];
          if (active?.name) return active.name;
        }
      }
      const answersPath = path.join(stateDir, "answers.json");
      if (fs.existsSync(answersPath)) {
        const a = JSON.parse(fs.readFileSync(answersPath, "utf8"));
        if (a.adminName) return a.adminName;
      }
    } catch {}
    return DEFAULT_USER_NAME;
  }

  function titleToJellyfinItem(rawT, progressMap = null) {
    const t = enrichTitleSync(rawT);
    const jfId = playbackItemId(t);
    const isTv = t.kind === "tv" || Boolean(t.isTv);
    const progress = (progressMap || getProgressMap())[jfId] || {};
    const posTicks = progress.positionTicks || 0;
    const durationMins = Number(t.durationMinutes) || 120;
    const totalTicks = durationMins * 60 * 1000 * 10000;

    return {
      Name: t.title || "Untitled",
      ServerId: SERVER_ID,
      Id: jfId,
      Type: isTv ? "Series" : "Movie",
      RunTimeTicks: totalTicks,
      ProductionYear: t.year || null,
      Overview: t.overview || "",
      Genres: Array.isArray(t.genres) ? t.genres : [],
      CommunityRating: Number.isFinite(Number(t.rating)) ? Number(t.rating) : null,
      IsFolder: isTv,
      ImageTags: { Primary: "1" },
      PrimaryImageAspectRatio: 0.6666666666666666,
      Container: "mkv",
      MediaType: "Video",
      UserData: {
        PlaybackPositionTicks: posTicks,
        PlayCount: posTicks > 0 ? 1 : 0,
        IsFavorite: false,
        Played: Boolean(progress.completed),
        Key: jfId,
      },
      MediaSources: typeof t.path === "string" && t.path && fs.existsSync(t.path) ? [
        {
          Id: `ms-${jfId}`,
          Name: t.title || "DirectPlay",
          Path: t.path || "",
          Protocol: "Http",
          Container: "mkv",
          SupportsDirectPlay: true,
          SupportsDirectStream: true,
          SupportsTranscoding: false,
          DirectStreamUrl: `/api/stream/item/${encodeURIComponent(jfId)}`,
          TranscodingUrl: `/api/stream/item/${encodeURIComponent(jfId)}`,
          MediaStreams: [
            {
              Type: "Video",
              Codec: t.videoCodec || "hevc",
              Width: t.is4k ? 3840 : 1920,
              Height: t.is4k ? 2160 : 1080,
              IsDefault: true,
            },
            {
              Type: "Audio",
              Codec: t.audioCodec || "aac",
              Channels: 6,
              IsDefault: true,
            },
          ],
        },
      ] : [],
    };
  }

  return async function handleJellyfinRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    const pathname = parsedUrl.pathname;

    // Helper: JSON response with standard headers
    function sendJson(status, data) {
      const payload = JSON.stringify(data);
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      });
      res.end(payload);
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      });
      res.end();
      return true;
    }

    // 1. System Info
    if (pathname === "/System/Info/Public" || pathname === "/System/Info") {
      sendJson(200, {
        LocalAddress: `http://${req.headers.host || "127.0.0.1:8080"}`,
        ServerName: "ReelOS",
        Version: "10.10.3",
        ProductName: "Jellyfin Server",
        OperatingSystem: process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux",
        Id: SERVER_ID,
        StartupWizardCompleted: true,
      });
      return true;
    }

    // 1.5. User Profile Discovery
    if (pathname === "/Users/Public" || pathname === "/Users") {
      sendJson(200, resolveResidents());
      return true;
    }

    // 2. Authentication
    if (pathname === "/Users/AuthenticateByName") {
      const activeName = resolveUserName();
      sendJson(200, {
        User: {
          Name: activeName,
          Id: DEFAULT_USER_ID,
          HasPassword: true,
          HasConfiguredPassword: true,
          HasConfiguredEasyPassword: false,
          EnableAutoLogin: false,
          Configuration: {
            PlayDefaultAudioTrack: true,
            SubtitleMode: "Default",
            SubtitleLanguagePreference: "eng",
            RememberAudioSelections: true,
            RememberSubtitleSelections: true,
            EnableNextEpisodeAutoPlay: true,
          },
          Policy: {
            IsAdministrator: true,
            IsHidden: false,
            EnableContentDownloading: true,
            EnableMediaPlayback: true,
            EnableAudioPlaybackTranscoding: true,
            EnableVideoPlaybackTranscoding: true,
            EnablePlaybackRemuxing: true,
            ForceRemoteSourceTranscoding: false,
            EnableAllDevices: true,
            EnableAllFolders: true,
          },
        },
        SessionInfo: {
          Id: "reelos-session-001",
          UserId: DEFAULT_USER_ID,
          UserName: activeName,
          Client: "Swiftfin",
          DeviceId: "reelos-box",
        },
        AccessToken: "reelos-shim-token",
        ServerId: SERVER_ID,
      });
      return true;
    }

    // 3. User Views (Library Root Folders)
    if (pathname === `/Users/${DEFAULT_USER_ID}/Views` || pathname.endsWith("/Views")) {
      sendJson(200, {
        Items: [
          {
            Name: "Movies",
            ServerId: SERVER_ID,
            Id: "view-movies",
            CollectionType: "movies",
            Type: "CollectionFolder",
          },
          {
            Name: "TV Shows",
            ServerId: SERVER_ID,
            Id: "view-tv",
            CollectionType: "tvshows",
            Type: "CollectionFolder",
          },
        ],
        TotalRecordCount: 2,
      });
      return true;
    }

    // 4. Users / Public Users
    if (pathname === "/Users/Public" || pathname === "/Users" || pathname === `/Users/${DEFAULT_USER_ID}`) {
      const activeName = resolveUserName();
      sendJson(200, [
        {
          Name: activeName,
          Id: DEFAULT_USER_ID,
          HasPassword: true,
          PrimaryImageTag: "1",
        },
      ]);
      return true;
    }

    // 5. Items Query (/Items)
    if (pathname === "/Items") {
      const titles = loadShelfTitles();
      const parentId = parsedUrl.searchParams.get("ParentId");
      let filtered = titles;
      if (parentId === "view-movies") {
        filtered = titles.filter((t) => t.kind !== "tv");
      } else if (parentId === "view-tv") {
        filtered = titles.filter((t) => t.kind === "tv");
      }

      const progressMap = getProgressMap();
      const items = filtered.map((t) => titleToJellyfinItem(t, progressMap));
      sendJson(200, {
        Items: items,
        TotalRecordCount: items.length,
        StartIndex: 0,
      });
      return true;
    }

    // 6. Item by ID (/Items/{id})
    const itemMatch = pathname.match(/^\/Items\/([a-zA-Z0-9_-]+)$/);
    if (itemMatch) {
      const itemId = itemMatch[1];
      const titles = loadShelfTitles();
      const match = titles.find((t) => {
        const id = String(t.jellyfinId || t.id || "").replace(/^(tmdb-tv-|tmdb-|jf-)/, "");
        return id === itemId;
      }) || { id: itemId, title: "Media Item", year: 2024 };

      sendJson(200, titleToJellyfinItem(match));
      return true;
    }

    // 7. Seasons Query (/Shows/{id}/Seasons)
    const seasonsMatch = pathname.match(/^\/Shows\/([a-zA-Z0-9_-]+)\/Seasons$/);
    if (seasonsMatch) {
      const seriesId = seasonsMatch[1];
      sendJson(200, {
        Items: [
          {
            Name: "Season 1",
            Id: `season-${seriesId}-1`,
            SeriesId: seriesId,
            IndexNumber: 1,
            Type: "Season",
            ServerId: SERVER_ID,
          },
        ],
        TotalRecordCount: 1,
      });
      return true;
    }

    // 8. Episodes Query (/Shows/{id}/Episodes)
    const episodesMatch = pathname.match(/^\/Shows\/([a-zA-Z0-9_-]+)\/Episodes$/);
    if (episodesMatch) {
      const seriesId = episodesMatch[1];
      sendJson(200, {
        Items: [],
        TotalRecordCount: 0,
        UnavailableReason: "No verified episode inventory is connected for this series.",
      });
      return true;
    }

    // 9. PlaybackInfo (/Items/{id}/PlaybackInfo)
    const playInfoMatch = pathname.match(/^\/Items\/([a-zA-Z0-9_-]+)\/PlaybackInfo$/);
    if (playInfoMatch) {
      const itemId = playInfoMatch[1];
      const match = resolvePlaybackItem({ kind: "item", value: itemId }, playbackOptions);
      const access = authorizePlaybackItem(req, match, playbackOptions);
      if (!access.ok) return sendPlaybackFailure(res, access);

      const jfItem = titleToJellyfinItem(match);
      if (!jfItem.MediaSources.length) {
        sendJson(409, {
          MediaSources: [],
          PlaySessionId: null,
          ErrorCode: "MediaUnavailable",
          Message: "No verified playable source is available for this title.",
        });
        return true;
      }
      sendJson(200, {
        MediaSources: jfItem.MediaSources,
        PlaySessionId: `ps-${Date.now()}`,
      });
      return true;
    }

    // Actual bytes resolve one current server-owned library record, then enforce
    // the same identity, source, and family policy as native streaming.
    const streamMatch = pathname.match(/^\/Videos\/([a-zA-Z0-9_-]+)\/(stream|stream\.mp4)$/);
    if (streamMatch) {
      if (!["GET", "HEAD"].includes(req.method || "GET")) {
        res.setHeader("Allow", "GET, HEAD");
        return sendPlaybackFailure(res, { ok: false, status: 405, error: "Use GET or HEAD for playback." });
      }
      const item = resolvePlaybackItem({ kind: "item", value: streamMatch[1] }, playbackOptions);
      const access = authorizePlaybackItem(req, item, playbackOptions);
      if (!access.ok) return sendPlaybackFailure(res, access);
      const file = verifiedPlaybackFile(item);
      if (!file) return sendPlaybackFailure(res, { ok: false, status: 404, available: false, error: "No verified local or remote media stream is available for this title." });
      globalThis.__reelosLastPlaybackAt = Date.now();
      streamLocalFile(req, res, file);
      return true;
    }

    // 11. Sessions & Progress Tracking
    if (pathname === "/Sessions/Playing" || pathname === "/Sessions/Playing/Progress") {
      globalThis.__reelosActiveStreams = (globalThis.__reelosActiveStreams || 0) + 1;
      globalThis.__reelosLastPlaybackAt = Date.now();
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const data = JSON.parse(body || "{}");
          if (data.ItemId) {
            saveProgress(data.ItemId, data.PositionTicks || 0, false);
          }
        } catch {}
      });
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      res.end();
      return true;
    }

    if (pathname === "/Sessions/Playing/Stopped") {
      if (globalThis.__reelosActiveStreams > 0) globalThis.__reelosActiveStreams--;
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const data = JSON.parse(body || "{}");
          if (data.ItemId) {
            saveProgress(data.ItemId, data.PositionTicks || 0, true);
          }
        } catch {}
      });
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      res.end();
      return true;
    }

    // 12. Images (/Items/{id}/Images/Primary)
    const imgMatch = pathname.match(/^\/Items\/([a-zA-Z0-9_-]+)\/Images\/([a-zA-Z0-9_-]+)/);
    if (imgMatch) {
      const itemId = imgMatch[1];
      const titles = loadShelfTitles();
      const match = titles.find((t) => {
        const id = String(t.jellyfinId || t.id || "").replace(/^(tmdb-tv-|tmdb-|jf-)/, "");
        return id === itemId;
      });

      if (match && match.poster && match.poster.startsWith("http")) {
        res.writeHead(302, { Location: match.poster });
        res.end();
        return true;
      }

      if (match) {
        const targetId = match.jellyfinId || itemId;
        const imgType = imgMatch[2] === "Backdrop" ? "Backdrop" : "Primary";
        res.writeHead(302, { Location: `http://127.0.0.1:8080/api/jf/Items/${encodeURIComponent(targetId)}/Images/${imgType}` });
        res.end();
        return true;
      }

      // Transparent 1x1 PNG fallback
      const transparentPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64"
      );
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": transparentPng.length,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(transparentPng);
      return true;
    }

    // 13. Bitrate Test (Used by Swiftfin/Infuse)
    if (pathname === "/Playback/BitrateTest") {
      const size = 1048576; // 1 MB
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": size,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(Buffer.alloc(size));
      return true;
    }

    // 14. ActiveEncodings
    if (pathname === "/Videos/ActiveEncodings") {
      sendJson(200, []);
      return true;
    }

    // 15. Live TV Stubs (Prepared for m3u / HDHomeRun streams)
    if (pathname === "/LiveTv/Channels") {
      sendJson(200, { Items: [], TotalRecordCount: 0 });
      return true;
    }
    if (pathname === "/LiveTv/Programs") {
      sendJson(200, { Items: [], TotalRecordCount: 0 });
      return true;
    }
    if (pathname === "/LiveTv/TunerHosts") {
      sendJson(200, []);
      return true;
    }
    if (pathname === "/LiveTv/Manage/Status") {
      sendJson(200, { Tuners: [] });
      return true;
    }

    // Unhandled route
    return false;
  };
}

/**
 * Starts a standalone HTTP server for the Jellyfin Shim on port 8096.
 */
export function startJellyfinShimServer({ port = 8096, host = "0.0.0.0", ...opts } = {}) {
  const handler = createJellyfinShimHandler(opts);
  const server = http.createServer(async (req, res) => {
    try {
      const handled = await handler(req, res);
      if (!handled) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e) }));
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      console.log(`[reelosd-shim] Jellyfin shim listening on http://${host}:${port}/`);
      resolve(server);
    });
  });
}
