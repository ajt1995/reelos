import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const DEFAULT_JELLYFIN_URL = "http://127.0.0.1:8096";

export async function queryJellyfinIntro(itemId, { jellyfinUrl = DEFAULT_JELLYFIN_URL, token = "" } = {}) {
  if (!itemId) {
    return { itemId: "", hasIntro: false, introStart: 0, introEnd: 0 };
  }

  // First try the IntroSkipper plugin endpoint: /Items/{id}/IntroTimestamps
  const endpoints = [
    `${jellyfinUrl}/Items/${encodeURIComponent(itemId)}/IntroTimestamps`,
    `${jellyfinUrl}/Episodes/${encodeURIComponent(itemId)}/IntroTimestamps`,
  ];

  for (const urlStr of endpoints) {
    try {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === "https:";
      const transport = isHttps ? https : http;

      const data = await new Promise((resolve, reject) => {
        const req = transport.request(
          parsedUrl,
          {
            method: "GET",
            headers: {
              ...(token ? { "X-Emby-Token": token } : {}),
              Accept: "application/json",
            },
            timeout: 3000,
          },
          (res) => {
            if (res.statusCode !== 200) {
              res.resume();
              return resolve(null);
            }
            let raw = "";
            res.on("data", (chunk) => (raw += chunk));
            res.on("end", () => {
              try {
                resolve(JSON.parse(raw));
              } catch {
                resolve(null);
              }
            });
          }
        );
        req.on("error", () => resolve(null));
        req.on("timeout", () => {
          req.destroy();
          resolve(null);
        });
        req.end();
      });

      if (data && typeof data === "object") {
        // Handle common shapes: { Valid: true, IntroStart: 12.5, IntroEnd: 45.2 } or { start, end }
        const start = Number(data.IntroStart ?? data.introStart ?? data.Start ?? data.start ?? 0);
        const end = Number(data.IntroEnd ?? data.introEnd ?? data.End ?? data.end ?? 0);
        const valid = data.Valid ?? data.valid ?? (end > start);

        if (valid && end > start) {
          return {
            itemId,
            hasIntro: true,
            introStart: Math.round(start * 100) / 100,
            introEnd: Math.round(end * 100) / 100,
          };
        }
      }
    } catch {
      // Continue to next probe
    }
  }

  // Fallback: query Jellyfin item details to check chapter markers named "Intro"
  try {
    const itemUrl = new URL(`${jellyfinUrl}/Items/${encodeURIComponent(itemId)}`);
    const isHttps = itemUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const itemData = await new Promise((resolve) => {
      const req = transport.request(
        itemUrl,
        {
          method: "GET",
          headers: {
            ...(token ? { "X-Emby-Token": token } : {}),
            Accept: "application/json",
          },
          timeout: 3000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            return resolve(null);
          }
          let raw = "";
          res.on("data", (chunk) => (raw += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(raw));
            } catch {
              resolve(null);
            }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });

    if (itemData?.Chapters && Array.isArray(itemData.Chapters)) {
      const chapters = itemData.Chapters;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const name = String(ch.Name || "").toLowerCase();
        if (name.includes("intro") || name.includes("opening") || name.includes("theme")) {
          // Chapter start position in ticks (1 second = 10,000,000 ticks)
          const startSec = (ch.StartPositionTicks || 0) / 10000000;
          const nextCh = chapters[i + 1];
          const endSec = nextCh ? (nextCh.StartPositionTicks || 0) / 10000000 : startSec + 90;
          if (endSec > startSec) {
            return {
              itemId,
              hasIntro: true,
              introStart: Math.round(startSec * 100) / 100,
              introEnd: Math.round(endSec * 100) / 100,
            };
          }
        }
      }
    }
  } catch {
    /* ignore fallback errors */
  }

  return {
    itemId,
    hasIntro: false,
    introStart: 0,
    introEnd: 0,
  };
}

export async function handleIntroTimestampsRoute(req, res, { jellyfinUrl, token } = {}) {
  const url = new URL(req.url, "http://127.0.0.1");
  const match = url.pathname.match(/^\/api\/media\/([^/]+)\/intro-timestamps$/);
  if (!match) return false;

  const itemId = decodeURIComponent(match[1]);
  const result = await queryJellyfinIntro(itemId, { jellyfinUrl, token });

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
  });
  res.end(JSON.stringify(result));
  return true;
}
