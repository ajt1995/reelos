import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("beta: stable Check cannot be offered Arena via channel.json", () => {
  const chan = JSON.parse(read("channel.json"));
  const beta = JSON.parse(read("channel-beta.json"));
  const ver = read("VERSION").trim();
  assert.equal(ver, "1.2.50.57");
  assert.doesNotMatch(ver, /1\.2\.51/);
  assert.match(String(chan.version), /^1\.2\.50\./);
  assert.equal(chan.channel, "stable");
  assert.equal(chan.tarball, "https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz");
  assert.doesNotMatch(JSON.stringify(chan), /beta-arena-books/);
  assert.equal(beta.version, "2.0.0");
  assert.equal(beta.channel, "beta");
  assert.equal(
    beta.tarball,
    "https://github.com/ajt1995/reelos/archive/refs/heads/cursor/beta-arena-books-5ba6.tar.gz",
  );
  assert.match(beta.notes[0], /Arena chrome and Books/);
  assert.match(beta.notes[0], /in place|Not for house Apply|not for house/);
});

test("beta: Arena+Books are gated on betaChannel, default off", () => {
  const shell = read("src/components/shell.tsx");
  const store = read("src/lib/store.ts");
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  const sidecar = read("scripts/reelos-beta-sidecar.mjs");
  assert.match(store, /betaChannel: false/);
  assert.match(shell, /settings\.betaChannel/);
  assert.match(shell, /to: "\/books"/);
  assert.match(shell, /Arena/);
  assert.match(shell, /STABLE_NAV/);
  assert.match(plugin, /dispatchBooksApi/);
  assert.match(plugin, /pathOnly.startsWith\("\/api\/books"\)/);
  assert.match(plugin, /if \(!betaEnabled\(\)\)/);
  assert.match(plugin, /send\(res, 404/);
  assert.match(sidecar, /applyBetaSidecar/);
  assert.match(sidecar, /stopBooks/);
  assert.match(sidecar, /idleOffBooksIfNeeded/);
  assert.match(sidecar, /\/srv\/media\/books/);
  assert.match(sidecar, /name === "\.gitkeep" \|\| name === "\.gitignore"/);
  assert.doesNotMatch(sidecar, /rmSync\(BOOKS_MEDIA/);
  assert.match(sidecar, /Leaves the movie\/TV library/);
  assert.match(read("src/components/wizard.tsx"), /const TOTAL = 7/);
  assert.doesNotMatch(read("src/components/wizard.tsx"), /Books/);
});

test("beta: Kavita is profile books; Caddy is /kavita not /books*", () => {
  for (const rel of ["compose/docker-compose.yml", "install/compose/docker-compose.yml", "daemon/docker-compose.yml"]) {
    const yml = read(rel);
    assert.match(yml, /image: lscr\.io\/linuxserver\/kavita/);
    assert.match(yml, /profiles: \["books"\]/);
    assert.match(yml, /\/srv\/media\/books:\/media/);
    assert.match(yml, /0\.0\.0\.0:5000:5000/);
  }
  for (const rel of ["compose/Caddyfile", "install/compose/Caddyfile"]) {
    const caddy = read(rel);
    assert.match(caddy, /handle \/kavita\*/);
    assert.doesNotMatch(caddy, /handle \/books/);
    assert.match(caddy, /:80 /);
    assert.doesNotMatch(caddy, /:443/);
  }
  assert.doesNotMatch(read("src/components/books-view.tsx"), /Lidarr|lidarr|Tron/i);
  assert.match(read("scripts/books-catalog.mjs"), /gutenberg\.org/);
  assert.match(read("scripts/books-catalog.mjs"), /standardebooks\.org/);
  assert.match(read("scripts/books-catalog.mjs"), /archive\.org/);
  assert.match(read("scripts/reelos-books.mjs"), /id_project_gutenberg|gutenberg/);
  assert.match(read("src/components/books-view.tsx"), /In copyright|Get this legally|Sideload/);
  assert.match(read("scripts/reelos-books.mjs"), /ReelOS-books/);
});

test("beta: composeProfiles only starts books when the toggle is on", () => {
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(plugin, /if \(betaEnabled\(\)\) p\.push\("books"\)/);
  assert.doesNotMatch(plugin.slice(plugin.indexOf("function composeProfiles")), /intent\.books/);
  assert.match(plugin, /"betaChannel" in body/);
  assert.match(plugin, /applyBetaSidecar/);
});

test("beta: phone hydrates Arena from /api/settings so a slow /api/ready cannot keep ReelOS chrome", () => {
  const root = read("src/routes/__root.tsx");
  assert.match(root, /fetch\("\/api\/settings"/);
  assert.match(root, /patchSettings\(\{ betaChannel: ui\.betaChannel \}\)/);
  assert.match(root, /applyReadyPayload/);
});
