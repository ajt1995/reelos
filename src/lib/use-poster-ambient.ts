import { useEffect, useState } from "react";

const colorCache = new Map<string, string>();

/**
 * Extracts dominant vibrant RGB colors from a poster URL for highly transparent
 * cinematic backdrop glow on movie and TV pages.
 */
export function usePosterAmbient(posterUrl?: string | null, alpha = 0.28): string | null {
  const [color, setColor] = useState<string | null>(() => {
    if (!posterUrl) return null;
    return colorCache.get(posterUrl) || null;
  });

  useEffect(() => {
    if (!posterUrl || typeof window === "undefined") {
      setColor(null);
      return;
    }

    if (colorCache.has(posterUrl)) {
      setColor(colorCache.get(posterUrl)!);
      return;
    }

    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = posterUrl;

    img.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          const red = data[i];
          const green = data[i + 1];
          const blue = data[i + 2];

          // Skip transparent or near-black pixels
          if (a > 128 && (red > 20 || green > 20 || blue > 20)) {
            // Boost saturation of dominant channels
            r += red;
            g += green;
            b += blue;
            count++;
          }
        }

        if (count > 0) {
          const avgR = Math.round(r / count);
          const avgG = Math.round(g / count);
          const avgB = Math.round(b / count);
          const val = `rgba(${avgR}, ${avgG}, ${avgB}, ${alpha})`;
          colorCache.set(posterUrl, val);
          setColor(val);
        } else {
          setColor(null);
        }
      } catch {
        /* CORS fallback - use neutral ambient */
        setColor(null);
      }
    };

    img.onerror = () => {
      if (active) setColor(null);
    };

    return () => {
      active = false;
    };
  }, [posterUrl, alpha]);

  return color;
}
