/**
 * Library Service
 * Provides library data manipulation, title sanitization (removing scene release tags),
 * and remove/reset payload validation.
 */

export const SCENE_RELEASE_REGEX =
  /[.\s-]*(2160p|1080p|720p|480p|4k|uhd|remux|bluray|blu-ray|bdrip|web-dl|webrip|webdl|hdtv|dvdrip|hdrip|hevc|x264|x265|h264|h265|xvid|divx|dts|aac|ac3|truehd|atmos|hdr|sdr|dv|imax|proper|repack|extended|theatrical|directors|cut|remastered|multi|dubbed|subbed|internal|nfofix|yify|yts|rarbg|eztv|ion10|fgt|cinemageddon|octet|ntb)\b.*/i;

export function sanitizeTitleString(raw) {
  let s = String(raw || "").trim();
  const isDotted = /^[A-Za-z0-9]+(\.[A-Za-z0-9]+){2,}$/.test(s.split(" ")[0] || "");
  if (isDotted) s = s.replace(/\./g, " ");
  const cleaned = s.replace(SCENE_RELEASE_REGEX, "").replace(/[\s._-]+$/, "").trim();
  return cleaned || raw;
}

export function validateRemovePayload(body) {
  const confirm = body?.confirm === true || body?.confirm === "true";
  const titleId = String(body?.titleId || body?.id || "").trim();
  const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id)) : [];
  const jellyfinId = body?.jellyfinId;
  const tmdb = body?.tmdb;
  const tvdb = body?.tvdb;
  const mediaType = body?.mediaType;

  if (!titleId && !ids.length && !jellyfinId) {
    return { ok: false, error: "titleId is required", status: 400 };
  }

  return {
    ok: true,
    status: 200,
    params: {
      titleId,
      jellyfinId,
      tmdb,
      tvdb,
      mediaType,
      ids,
      confirm,
    },
  };
}

export function validateResetPayload(body) {
  const confirm = body?.confirm === true || body?.confirm === "true";
  if (!confirm) {
    return { ok: false, error: "Confirm reset library", status: 400 };
  }
  return { ok: true, status: 200, resync: Boolean(body?.resync === true || body?.resync === "true") };
}

export function buildLibraryPayload({ titles, continueWatching, error }) {
  return {
    titles: titles || [],
    continueWatching: continueWatching || [],
    error: error || null,
  };
}
