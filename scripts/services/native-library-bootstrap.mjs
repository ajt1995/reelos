import { SAMPLE_MOVIES } from "../sample-library-seed.mjs";

const SAFE_PUBLIC_MEDIA = /^https:\/\/archive\.org\//i;

export function ensureBuiltinPublicCinema(registry) {
  let added = 0;
  for (const movie of SAMPLE_MOVIES) {
    if (!movie.isPublicDomain || !SAFE_PUBLIC_MEDIA.test(String(movie.streamUrl || ""))) continue;
    if (registry.get(movie.id)) continue;
    registry.register({
      itemId: movie.id,
      workId: movie.id,
      editionId: `public-archive-${movie.id}`,
      title: movie.title,
      year: movie.year,
      mediaType: "movie",
      source: {
        id: `public-source-${movie.id}`,
        kind: "public_domain",
        verified: true,
        uri: movie.streamUrl,
        catalog: "reelos-public-cinema",
        rightsBasis: "curated-public-domain",
      },
    });
    added += 1;
  }
  return added;
}
