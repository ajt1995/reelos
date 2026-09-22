import fs from "node:fs";
import path from "node:path";
import { resolveTitleMetadata, enrichTitleSync } from "./services/metadata-enricher.mjs";

const stateDir = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
const shelfFile = path.join(stateDir, "library-shelf.json");

async function main() {
  if (!fs.existsSync(shelfFile)) {
    console.log(`[enrich-shelf] No shelf file found at ${shelfFile}`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(shelfFile, "utf8"));
  const titles = Array.isArray(raw.titles) ? raw.titles : [];
  console.log(`[enrich-shelf] Loaded ${titles.length} titles from ${shelfFile}`);

  let enrichedCount = 0;
  for (let i = 0; i < titles.length; i++) {
    const t = titles[i];
    const isSynthetic = !t.overview || t.overview.startsWith("jf-") || t.overview.includes("presents an evocative");
    const needsGenres = !t.genres || t.genres.length === 0;

    if (isSynthetic || needsGenres) {
      const query = (t.title && !t.title.startsWith("jf-")) ? t.title : t.id;
      const meta = await resolveTitleMetadata(query, { kind: t.kind, year: t.year });
      if (meta) {
        if (meta.overview && !meta.overview.startsWith("jf-")) t.overview = meta.overview;
        if (meta.genres?.length) t.genres = meta.genres;
        if (meta.director) t.director = meta.director;
        if (meta.rating) t.rating = meta.rating;
        enrichedCount++;
      }
      titles[i] = enrichTitleSync(t);
    }
  }

  raw.titles = titles;
  fs.writeFileSync(shelfFile, JSON.stringify(raw, null, 2), "utf8");
  console.log(`[enrich-shelf] Successfully enriched ${enrichedCount} titles in ${shelfFile}`);
}

main().catch((err) => {
  console.error("[enrich-shelf] Error:", err);
  process.exit(1);
});
