/** Channel / UPDATE_NOTES helpers. Owner English — not a git log. */

/**
 * @param {string} v
 * @returns {number[]}
 */
export function versionKey(v) {
  return String(v || "0")
    .replace(/-/g, ".")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function cmpVer(a, b) {
  const ka = versionKey(a);
  const kb = versionKey(b);
  const n = Math.max(ka.length, kb.length);
  for (let i = 0; i < n; i++) {
    const d = (ka[i] || 0) - (kb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/**
 * @param {string} line
 * @returns {string}
 */
export function noteVersion(line) {
  const m = String(line || "").match(/^(\d+(?:\.\d+)*(?:-beta\.\d+)?)\s*:/);
  return m ? m[1] : "";
}

/**
 * @param {string} line
 * @returns {string}
 */
export function stripVersionPrefix(line) {
  return String(line || "")
    .replace(/^\d+(?:\.\d+)*(?:-beta\.\d+)?:\s*/, "")
    .trim();
}

/**
 * Drop PR asides and parked-stamp lines so the phone stays plain English.
 * @param {string} line
 * @returns {string}
 */
export function ownerEnglish(line) {
  let s = String(line || "").trim();
  s = s.replace(/\s*Complements\s+#\d+(?:\s*\/\s*#\d+)*\.?/gi, "");
  s = s.replace(/\s*Not 1\.2\.51[^.]*\.?/gi, "");
  s = s.replace(/\s*1\.2\.51 parked[^.]*\.?/gi, "");
  s = s.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
  return s;
}

/**
 * @param {string[]} notes
 * @returns {string[]}
 */
function cleaned(notes) {
  return (notes || []).map(ownerEnglish).filter((n) => stripVersionPrefix(n).length > 0);
}

/**
 * @param {string[]} notes
 * @param {string} version
 * @returns {string[]}
 */
export function notesForVersion(notes, version) {
  const want = String(version || "").trim();
  if (!want) return [];
  return cleaned((notes || []).filter((n) => noteVersion(n) === want));
}

/**
 * Notes the available update will change: versions after local, up to remote.
 * Newest-first (channel.json order). Unknown local ("", "0") → remote stamp only.
 * @param {string[]} notes
 * @param {string} local
 * @param {string} [remote]
 * @param {number} [limit]
 * @returns {string[]}
 */
export function pendingNotes(notes, local, remote, limit = 4) {
  const loc = String(local || "").trim();
  const rem = String(remote || "").trim();
  if (!loc || loc === "0" || !/\d+\.\d+/.test(loc)) {
    return notesForVersion(notes, rem).slice(0, limit);
  }
  const rows = cleaned(
    (notes || []).filter((n) => {
      const v = noteVersion(n);
      if (!v) return false;
      if (cmpVer(v, loc) <= 0) return false;
      if (rem && cmpVer(v, rem) > 0) return false;
      return true;
    }),
  );
  return rows.slice(0, limit);
}

/**
 * @param {string} current
 * @param {string} shipped
 * @returns {string}
 */
export function displayVersion(current, shipped) {
  const v = String(current || "").trim();
  if (/\d+\.\d+/.test(v)) return v;
  return String(shipped || "").trim();
}
