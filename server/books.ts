import { createServerFn } from "@tanstack/react-start";

export const searchBooks = createServerFn({ method: "GET" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (!q) return { results: [] };

    const results: any[] = [];
    
    // Search Gutendex (Project Gutenberg OPDS wrapper)
    try {
      const res = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        for (const book of data.results.slice(0, 10)) {
          const epubUrl = book.formats["application/epub+zip"];
          if (epubUrl) {
            results.push({
              id: `gutenberg-${book.id}`,
              title: book.title,
              author: book.authors.map((a: any) => a.name).join(", "),
              source: "Project Gutenberg",
              downloadUrl: epubUrl,
            });
          }
        }
      }
    } catch (e) {
      console.error("Gutendex search failed:", e);
    }

    // Search Standard Ebooks (via OPDS)
    try {
      const res = await fetch(`https://standardebooks.org/opds/all?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const xml = await res.text();
        // Simple regex parsing for OPDS XML
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;
        let count = 0;
        while ((match = entryRegex.exec(xml)) !== null && count < 10) {
          const entry = match[1];
          const titleMatch = /<title>([^<]+)<\/title>/.exec(entry);
          const authorMatch = /<author>\s*<name>([^<]+)<\/name>/.exec(entry);
          const linkMatch = /<link href="([^"]+\.epub)"[^>]*rel="http:\/\/opds-spec\.org\/acquisition"/.exec(entry);
          const idMatch = /<id>([^<]+)<\/id>/.exec(entry);
          
          if (titleMatch && linkMatch) {
            results.push({
              id: `se-${idMatch ? idMatch[1].replace(/[^a-zA-Z0-9]/g, "") : count}`,
              title: titleMatch[1],
              author: authorMatch ? authorMatch[1] : "Unknown",
              source: "Standard Ebooks",
              downloadUrl: `https://standardebooks.org${linkMatch[1]}`,
            });
            count++;
          }
        }
      }
    } catch (e) {
      console.error("Standard Ebooks search failed:", e);
    }

    return { results };
  });

export const downloadBook = createServerFn({ method: "POST" })
  .validator((data: { book: any }) => data)
  .handler(async ({ data }) => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { pipeline } = await import("node:stream/promises");
    
    // Target directory: /srv/media/books (mapped to /media in Kavita container)
    const booksDir = "/srv/media/books";
    
    try {
      if (!fs.existsSync(booksDir)) {
        fs.mkdirSync(booksDir, { recursive: true });
      }
      
      const safeTitle = data.book.title.replace(/[^a-zA-Z0-9 -]/g, "").trim();
      const safeAuthor = data.book.author.replace(/[^a-zA-Z0-9 -]/g, "").trim();
      
      // Kavita prefers Author/Series/Book structure, but Author/Book is fine
      const authorDir = path.join(booksDir, safeAuthor || "Unknown Author");
      if (!fs.existsSync(authorDir)) {
        fs.mkdirSync(authorDir, { recursive: true });
      }
      
      const fileName = `${safeTitle}.epub`;
      const filePath = path.join(authorDir, fileName);
      
      const res = await fetch(data.book.downloadUrl);
      if (!res.ok) throw new Error(`Failed to fetch book: ${res.statusText}`);
      
      const fileStream = fs.createWriteStream(filePath);
      if (res.body) {
        // @ts-ignore
        await pipeline(res.body, fileStream);
      }
      
      // Try to trigger Kavita scan
      // We don't have the API key easily accessible, so we just download it.
      // Kavita will pick it up on its next scheduled scan or manual scan.
      
      return { ok: true };
    } catch (e) {
      console.error("Book download failed:", e);
      return { ok: false, error: String(e) };
    }
  });
