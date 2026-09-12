import type { Title } from "./types";

export function looksLikeHashTitle(name?: string) {
  return /^[0-9a-f]{32,64}$/i.test(String(name || "").trim());
}

const INDEXER_HOST =
  /(?:uindex|torrenting|torrentcouch|eztvx?|1337x|bitsearch|rarbg|yts|tpb|limetorrents|nyaa)/i;

const TLD = "org|com|net|to|tv|cc|me|info|xyz";

export function stripIndexerPrefix(raw?: string) {
  let s = String(raw || "").trim();
  while (true) {
    const stripped = s.replace(/^\[+[^\]]+\]+\s*/, "").trim();
    if (stripped === s) break;
    s = stripped;
  }
  s = s.replace(/\s*\[+\s*[^\]]+\]+\s*$/g, "").trim();
  if (INDEXER_HOST.test(s)) {
    s = s.replace(new RegExp(`^(?:www\\.)?[a-z0-9.-]+\\.(?:${TLD})\\s*[-–—:.]+\\s*`, "i"), "").trim();
  }
  s = s.replace(/^www\.[a-z0-9.-]+\s*[-–—:]+\s*/i, "").trim();
  s = s.replace(new RegExp(`^www[\\s._-]+[a-z0-9]+[\\s._-]+(?:${TLD})\\b[\\s._:-]*`, "i"), "").trim();
  s = s.replace(new RegExp(`^(?:${TLD})\\s*[-–—:]+\\s+`, "i"), "").trim();
  s = s.replace(/^[-_\s]+/, "").trim();
  return s || String(raw || "").trim();
}

export function looksLikeIndexerDump(name?: string) {
  const s = String(name || "").trim();
  if (!s) return false;
  if (/^www[\s._-]/i.test(s) || /^www\./i.test(s)) return true;
  if (new RegExp(`^(?:${TLD})\\s*[-–—:]+\\s+\\S`, "i").test(s)) return true;
  if (INDEXER_HOST.test(s) && (/[-.]/.test(s) || /^\[[^\]]+\]/.test(s) || /\[[^\]]+\]\s*$/.test(s))) return true;
  const stripped = stripIndexerPrefix(s);
  return Boolean(stripped) && stripped !== s;
}

export function isHashDumpCard(t?: Pick<Title, "id" | "title" | "year" | "poster" | "fromHashDump"> | null) {
  if (!t) return false;
  if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) return true;
  if (t.fromHashDump && !(Number(t.year) > 0 && t.poster)) return true;
  return false;
}

function titleAliasIds(t: Pick<Title, "id" | "ids" | "jellyfinId">): string[] {
  return [t.id, ...(t.ids || []), t.jellyfinId, t.jellyfinId ? `jf-${t.jellyfinId}` : ""]
    .filter(Boolean)
    .map(String);
}

function normName(title?: string) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titleProviderId(t: Pick<Title, "id" | "ids">) {
  const ids = [t.id, ...(t.ids || [])].map(String);
  return ids.find((i) => /^(tmdb-|tvdb-)/.test(i)) || "";
}

function titleWords(name?: string) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function cleanDumpTitle(title?: string) {
  let s = stripIndexerPrefix(title);
  s = s.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  s = stripIndexerPrefix(s);
  s = s.replace(/^(?:[Ss]\d{1,2}\s*[Ee]\d{1,3})\s+/, "").trim();
  s = s.replace(/[\s._:-]+(?:(?:season|series)[\s._:-]*\d{1,2}|s\d{1,2}(?!\d)(?![eE]\d)).*$/i, "").trim() || s;
  s = s.replace(/[\s._:-]+complete(?:[\s._:-]+(?:series|collection|pack|set))?(?:[\s._:-]+\(?\d{4}\)?)?$/i, "").trim() || s;
  s = s.replace(/\s+(?:II|III|IV|VI|VII|VIII|IX)\s+[A-Za-z][A-Za-z0-9]{1,14}$/i, "").trim() || s;
  return s;
}

export function isDumpTwinCard(
  t?: Pick<Title, "id" | "ids" | "title" | "year" | "poster" | "path" | "fromHashDump" | "fromDump"> | null,
) {
  if (!t) return false;
  const namedCatalog =
    Boolean(titleProviderId(t)) &&
    Boolean(t.title) &&
    !looksLikeHashTitle(t.title) &&
    !looksLikeIndexerDump(t.title);
  // Named Rookie with tvdb/tmdb is the show even when Path is a UIndex dump folder.
  if (namedCatalog) return false;
  if (t.fromDump) return true;
  if (isHashDumpCard(t)) return true;
  if (looksLikeIndexerDump(t.title) || looksLikeIndexerDump(t.path)) return true;
  if (titleProviderId(t)) return false;
  if (!(Number(t.year) > 0) || !t.poster) return true;
  if (/\b[Ss]\d{1,2}\s*[Ee]\d{1,3}\b/.test(String(t.title || ""))) return true;
  return false;
}

export function dumpMatchesNamed(
  dump: Pick<Title, "title">,
  named: Pick<Title, "title">,
) {
  const dumpClean = cleanDumpTitle(dump?.title);
  const namedClean = cleanDumpTitle(named?.title);
  const dn = normName(dumpClean);
  const nn = normName(namedClean);
  if (!dn || !nn || dn === "unknownonthisbox") return false;
  if (dn === nn) return true;
  const dumpWords = titleWords(dumpClean);
  const namedWords = titleWords(namedClean);
  if (!namedWords.length || dumpWords.length < namedWords.length) return false;
  const namedCore = nn.replace(/^(the|a|an)/, "");
  const namedSig = namedWords.filter((w) => w !== "the" && w !== "a" && w !== "an");
  if (namedCore.length < 4 && namedSig.length < 2) return false;
  for (let i = 0; i <= dumpWords.length - namedWords.length; i++) {
    if (namedWords.every((w, j) => dumpWords[i + j] === w)) return true;
  }
  return false;
}

/** Drop hash-named / UIndex / year-0 empty posters when the same files are a named show. */
export function homeShelfRows(titles: Title[]): Title[] {
  const list = (titles || []).filter(Boolean);
  const named = list.filter(
    (t) => !isDumpTwinCard(t) && t.title && t.title !== "Unknown on this box" && !looksLikeHashTitle(t.title),
  );
  const namedIds = new Set(named.flatMap(titleAliasIds));
  const namedNames = new Set(named.map((t) => normName(t.title)).filter(Boolean));
  return list
    .filter((t) => {
      if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) {
        return false;
      }
      if (isDumpTwinCard(t)) {
        if (titleAliasIds(t).some((id) => namedIds.has(id))) return false;
        const name = normName(cleanDumpTitle(t.title));
        if (name && namedNames.has(name)) return false;
        if (named.some((n) => dumpMatchesNamed(t, n))) return false;
        if (isHashDumpCard(t) && !(Number(t.year) > 0) && !t.poster) return false;
      }
      return true;
    })
    .map((t) => {
      if (!isDumpTwinCard(t) && !looksLikeIndexerDump(t.title)) return t;
      const cleaned = cleanDumpTitle(t.title);
      if (!cleaned || cleaned === t.title) return t;
      return { ...t, title: cleaned };
    });
}

/** Limited Home fetches must not shrink a larger Library shelf — or resurrect a hash leftover. */
export function mergeShelf(prev: Title[], next: Title[], limited: boolean): Title[] {
  const incoming = homeShelfRows(next);
  if (!limited) return incoming;
  if (!prev.length) return incoming;
  const have = new Set(incoming.flatMap(titleAliasIds));
  const extra = homeShelfRows(prev).filter((t) => !titleAliasIds(t).some((k) => have.has(k)));
  return homeShelfRows([...incoming, ...extra]);
}
