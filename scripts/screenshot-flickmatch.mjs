import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const PORT = 8093;
const artifactDir = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\c11dd108-741c-4598-b4fc-b1a6178acc01";

// Ensure state is provisioned so app routes load
try {
  if (!existsSync(".reelos-state")) mkdirSync(".reelos-state", { recursive: true });
  writeFileSync(".reelos-state/provisioned", "1\n");
} catch {}

const server = spawn("node", ["scripts/reelos-box.mjs"], {
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1" },
  stdio: "pipe",
});

let serverReady = false;
server.stdout.on("data", (d) => {
  const str = d.toString();
  if (str.includes(String(PORT)) || str.includes("serving built UI") || str.includes("preview")) {
    serverReady = true;
  }
});
server.stderr.on("data", (d) => console.error(d.toString()));

for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/ready`);
    if (res.ok) {
      serverReady = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

if (!serverReady) {
  console.error("Server did not start in time on port " + PORT);
  server.kill();
  process.exit(1);
}

const chromePath = existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem(
      "reelos-v4",
      JSON.stringify({
        state: {
          provisioned: true,
          phase: "app",
          theme: "gold-hashed",
          houseName: "Living Room Cinema Lounge",
          residents: [
            { id: "res-primary", name: "Primary", avatar: "clapperboard", color: "gold" },
            { id: "sarah", name: "Sarah", avatar: "sparkles", color: "emerald" },
          ],
          activeResidentId: "res-primary",
        },
        version: 0,
      })
    );
  });

  // 1. Navigate to FlickMatch Lobby
  await page.goto(`http://127.0.0.1:${PORT}/flickmatch`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const shotLobby = join(artifactDir, "flickmatch_lobby_qr.png");
  await page.screenshot({ path: shotLobby, fullPage: false });
  console.log("Captured FlickMatch Lobby -> " + shotLobby);

  // 2. Type room code to see dynamic QR code update
  const codeInput = page.locator("input[placeholder*='4-LETTER']");
  if (await codeInput.count() > 0) {
    await codeInput.fill("TR8K");
    await page.waitForTimeout(500);
    const shotRoomQr = join(artifactDir, "flickmatch_lobby_room_qr.png");
    await page.screenshot({ path: shotRoomQr, fullPage: false });
    console.log("Captured FlickMatch Lobby with Room TR8K -> " + shotRoomQr);
  }

  // Route /api/flickmatch/session with sample cards
  await page.route("**/api/flickmatch/session", async (route) => {
    const postData = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        roomCode: postData.roomCode || "CINE",
        players: [
          { name: "Host", avatar: "clapperboard", joinedAt: Date.now(), votedCount: 0 },
          { name: "Sarah", avatar: "sparkles", joinedAt: Date.now(), votedCount: 0 },
        ],
        deck: [
          {
            id: "dune-2",
            title: "Dune: Part Two",
            year: 2024,
            genres: ["Sci-Fi", "Adventure", "Action"],
            overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
            poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
          },
          {
            id: "interstellar",
            title: "Interstellar",
            year: 2014,
            genres: ["Sci-Fi", "Drama"],
            overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
          },
        ],
        match: null,
      }),
    });
  });

  // 3. Create room and show in-room invite modal
  if (await codeInput.count() > 0) {
    await codeInput.fill("");
  }
  const createBtn = page.getByRole("button", { name: /create new room/i });
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(1200);

    const shotDeck = join(artifactDir, "flickmatch_swiping_deck.png");
    await page.screenshot({ path: shotDeck, fullPage: false });
    console.log("Captured FlickMatch Swiping Deck -> " + shotDeck);

    const roomBtn = page.getByRole("button", { name: /ROOM /i });
    const count = await roomBtn.count();
    console.log("Found room buttons:", count);
    if (count > 0) {
      await roomBtn.click();
      await page.waitForTimeout(600);
      const shotModal = join(artifactDir, "flickmatch_swiping_invite_modal.png");
      await page.screenshot({ path: shotModal, fullPage: false });
      console.log("Captured FlickMatch Swiping Invite Modal -> " + shotModal);
    }
  }

} catch (e) {
  console.error("Screenshot error:", e);
} finally {
  await browser.close();
  server.kill();
  console.log("Screenshot run finished.");
}
