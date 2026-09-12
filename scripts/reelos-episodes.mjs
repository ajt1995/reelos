/** Honest TV episode status from Sonarr/Jellyfin/Seerr for the season accordion. */
import {
  parseTitleId,
  seerrApiKey,
  seerrFetch,
  seerrSeasonStatus,
  resolveParsedTitle,
  seasonIsUnreleased,
  findLibraryTitle,
  UNRELEASED_SEASON_COPY,
  IMPORTING_SEASON_COPY,
} from "./reelos-seerr.mjs";
import { arrApiKey, arrJson, loadPresenceFacts } from "./reelos-request-status.mjs";

/** Austin: in library / on disk importing / downloading / missing / requested — no invented percents. */
export const EPISODE_STATUSES = Object.freeze(["in-library", "importing", "downloading", "requested", "missing"]);

export const EPISODE_STATUS_LABEL = Object.freeze({
  "in-library": "In library",
  importing: "On disk, importing",
  downloading: "Downloading",
  requested: "Requested",
  missing: "Missing",
});

export function classifyEpisodeStatus({
  hasFile = false,
  inJellyfin = false,
  inQueue = false,
  requested = false,
  importing = false,
} = {}) {
  if (hasFile) return "in-library";
  if (importing) return "importing";
  if (inJellyfin) return "in-library";
  if (inQueue) return "downloading";
  if (requested) return "requested";
  return "missing";
}

export function episodeStatusLabel(status) {
  return EPISODE_STATUS_LABEL[status] || EPISODE_STATUS_LABEL.missing;
}

/** Season was asked for (pending/processing/partial), not merely Seerr AVAILABLE. */
export function seasonWasRequested(seasonStatus) {
  const n = Number(seasonStatus || 0);
  return n === 1 || n === 2 || n === 3 || n === 4;
}

/** Dump / scene filenames on a Jellyfin library row → episode numbers for this season. */
export function jellyfinEpisodesFromLibrary(libraryTitles, tmdbId, seasonNumber) {
  const tmdb = String(tmdbId || "").trim();
  const season = Number(seasonNumber);
  if (!tmdb || !Number.isFinite(season) || season <= 0) return [];
  const hit = (libraryTitles || []).find((row) =>
    (row?.ids || []).some((id) => {
      const s = String(id || "");
      return s === `tmdb-tv-${tmdb}` || s === `tmdb-${tmdb}` || s === `jf-${row?.jellyfinId || ""}`;
    }) || String(row?.jellyfinId || "") === tmdb,
  );
  if (!hit) return [];
  const files = Array.isArray(hit.files) ? hit.files : [];
  const out = [];
  const seen = new Set();
  const re = new RegExp(`(?:^|[^a-z0-9])[Ss]0?${season}[Ee](\\d{1,3})(?:[^a-z0-9]|$)`);
  for (const name of files) {
    const m = re.exec(String(name));
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push({ IndexNumber: n });
  }
  return out;
}

function episodeNumberOf(row) {
  const n = Number(row?.episodeNumber ?? row?.episode_number ?? row?.IndexNumber);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function queueEpisodeNumbers(queueItems, seasonNumber) {
  const out = new Set();
  const season = Number(seasonNumber);
  const records = Array.isArray(queueItems) ? queueItems : Array.isArray(queueItems?.records) ? queueItems.records : [];
  for (const q of records) {
    const sn = Number(q?.episode?.seasonNumber ?? q?.seasonNumber);
    const n = episodeNumberOf(q?.episode || q);
    if (n && (Number.isNaN(sn) || sn === season)) out.add(n);
  }
  return out;
}

function jellyfinEpisodeNumbers(items) {
  const out = new Set();
  for (const row of items || []) {
    const n = episodeNumberOf(row);
    if (n) out.add(n);
  }
  return out;
}

export function assembleSeasonEpisodes({
  seasonNumber,
  sonarrEpisodes = [],
  seerrEpisodes = [],
  queueItems = [],
  jellyfinEpisodes = [],
  seasonRequested = false,
  seasonImporting = false,
} = {}) {
  const queued = queueEpisodeNumbers(queueItems, seasonNumber);
  const onJf = jellyfinEpisodeNumbers(jellyfinEpisodes);
  const byNum = new Map();
  const put = (n, patch) => {
    if (n == null) return;
    const prev = byNum.get(n) || {
      episodeNumber: n,
      title: "",
      hasFile: false,
      monitored: true,
    };
    byNum.set(n, {
      ...prev,
      ...patch,
      episodeNumber: n,
      title: patch.title || prev.title,
      hasFile: patch.hasFile === true || prev.hasFile === true,
    });
  };
  for (const row of seerrEpisodes || []) {
    const n = episodeNumberOf(row);
    put(n, { title: String(row?.name || row?.title || "").trim() });
  }
  for (const row of sonarrEpisodes || []) {
    const n = episodeNumberOf(row);
    put(n, {
      title: String(row?.title || "").trim(),
      hasFile: row?.hasFile === true,
      monitored: row?.monitored !== false,
      id: row?.id,
    });
  }
  return [...byNum.values()]
    .sort((a, b) => a.episodeNumber - b.episodeNumber)
    .map((row) => {
      const status = classifyEpisodeStatus({
        hasFile: row.hasFile,
        inJellyfin: onJf.has(row.episodeNumber),
        inQueue: queued.has(row.episodeNumber),
        requested: seasonRequested,
        importing: Boolean(seasonImporting) && row.hasFile !== true,
      });
      return {
        episodeNumber: row.episodeNumber,
        title: row.title || `Episode ${row.episodeNumber}`,
        status,
        label: episodeStatusLabel(status),
        hasFile: Boolean(row.hasFile),
        monitored: row.monitored !== false,
      };
    });
}

function seerrSeasonEpisodes(json) {
  if (Array.isArray(json?.episodes)) return json.episodes;
  if (Array.isArray(json?.season?.episodes)) return json.season.episodes;
  return [];
}

export async function loadSeasonEpisodeList({
  titleId,
  season,
  parseId = parseTitleId,
  resolveParsed = resolveParsedTitle,
  seerrKey = seerrApiKey(),
  fetchSeerr = seerrFetch,
  fetchArr = arrJson,
  sonarrKey = arrApiKey("sonarr"),
  factsLoader = loadPresenceFacts,
  fetchJellyfinEpisodes,
} = {}) {
  const seasonNumber = Number(season);
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) {
    return { ok: false, season: seasonNumber, episodes: [], error: "Need a season number" };
  }
  let parsed = parseId(titleId);
  let facts = null;
  try {
    facts = await factsLoader();
  } catch {
    facts = null;
  }
  parsed = resolveParsed(parsed, {
    titles: facts?.libraryTitles || [],
    series: facts?.series || [],
    movies: facts?.movies || [],
  });
  if (!parsed?.tmdb || parsed.mediaType === "movie") {
    return {
      ok: true,
      season: seasonNumber,
      episodes: [],
      source: "none",
      vocab: EPISODE_STATUS_LABEL,
    };
  }
  const tmdb = parsed.tmdb;
  const series = (facts?.series || []).find((s) => String(s?.tmdbId) === String(tmdb));
  let sonarrEpisodes = [];
  let queueItems = [];
  if (sonarrKey && series?.id) {
    const [eps, queue] = await Promise.all([
      fetchArr(
        `http://127.0.0.1:8989/api/v3/episode?seriesId=${encodeURIComponent(series.id)}&seasonNumber=${seasonNumber}`,
        sonarrKey,
        8000,
      ),
      fetchArr("http://127.0.0.1:8989/api/v3/queue?includeUnknownSeriesItems=true", sonarrKey, 4000),
    ]);
    sonarrEpisodes = Array.isArray(eps) ? eps : [];
    queueItems = queue;
  }
  let seerrEpisodes = [];
  let seasonRequested = false;
  if (seerrKey) {
    try {
      const detail = await fetchSeerr(`/api/v1/tv/${tmdb}`, { key: seerrKey, ms: 6000 });
      const media = detail?.json?.mediaInfo || detail?.json?.media || {};
      seasonRequested = seasonWasRequested(seerrSeasonStatus(media, seasonNumber));
      const seasonDetail = await fetchSeerr(`/api/v1/tv/${tmdb}/season/${seasonNumber}`, {
        key: seerrKey,
        ms: 6000,
      }).catch(() => null);
      seerrEpisodes = seerrSeasonEpisodes(seasonDetail?.json);
      if (!seerrEpisodes.length) {
        const listed = (detail?.json?.seasons || []).find((s) => Number(s?.seasonNumber) === seasonNumber);
        seerrEpisodes = seerrSeasonEpisodes(listed);
      }
    } catch {
      /* Sonarr rows still paint */
    }
  }
  let jellyfinEpisodes = [];
  if (typeof fetchJellyfinEpisodes === "function") {
    try {
      jellyfinEpisodes = await fetchJellyfinEpisodes({
        tmdbId: tmdb,
        seasonNumber,
        libraryTitles: facts?.libraryTitles || [],
      });
    } catch {
      jellyfinEpisodes = [];
    }
  } else {
    jellyfinEpisodes = jellyfinEpisodesFromLibrary(facts?.libraryTitles || [], tmdb, seasonNumber);
  }
  const lib = findLibraryTitle(facts?.libraryTitles || [], parsed.titleId || titleId);
  const seasonImporting = Boolean(
    (lib?.importingSeasons || []).map(Number).includes(seasonNumber) ||
      (facts?.libraryTitles || []).some((t) => (t?.importingSeasons || []).map(Number).includes(seasonNumber) && String(t?.title || "").toLowerCase() === String(lib?.title || series?.title || "").toLowerCase()),
  );
  const episodes = assembleSeasonEpisodes({
    seasonNumber,
    sonarrEpisodes,
    seerrEpisodes,
    queueItems,
    jellyfinEpisodes: Array.isArray(jellyfinEpisodes) ? jellyfinEpisodes : [],
    seasonRequested,
    seasonImporting,
  });
  const sonarrSeason = (series?.seasons || []).find((s) => Number(s?.seasonNumber) === seasonNumber);
  const unreleased = Boolean(
    (sonarrSeason &&
      seasonIsUnreleased({
        ...sonarrSeason,
        episodes: sonarrEpisodes.length ? sonarrEpisodes : undefined,
      })) ||
      (seerrEpisodes.length > 0 && seasonIsUnreleased({ seasonNumber, episodes: seerrEpisodes })),
  );
  if (unreleased) {
    return {
      ok: true,
      season: seasonNumber,
      titleId: parsed.titleId || titleId,
      episodes: [],
      unreleased: true,
      copy: UNRELEASED_SEASON_COPY,
      source: sonarrEpisodes.length ? "sonarr" : seerrEpisodes.length ? "seerr" : "none",
      vocab: EPISODE_STATUS_LABEL,
    };
  }
  return {
    ok: true,
    season: seasonNumber,
    titleId: parsed.titleId || titleId,
    episodes,
    source: sonarrEpisodes.length ? "sonarr" : seerrEpisodes.length ? "seerr" : "none",
    vocab: EPISODE_STATUS_LABEL,
  };
}
