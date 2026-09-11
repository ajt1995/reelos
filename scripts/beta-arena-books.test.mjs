import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { cmpVer } from "./update-notes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function mailmanNewer(remote, local) {
  const r = spawnSync(
    "python3",
    [
      "-c",
      `import sys
def key(v):
    out=[]
    for x in v.replace("-", ".").split("."):
        n=""
        for c in x:
            if c.isdigit(): n+=c
            else: break
        out.append(int(n) if n else 0)
    return out
a=key(sys.argv[1]); b=key(sys.argv[2])
n=max(len(a),len(b)); a+=[0]*(n-len(a)); b+=[0]*(n-len(b))
sys.exit(0 if a>b else 1)`,
      remote,
      local,
    ],
    { encoding: "utf8" },
  );
  return r.status === 0;
}

test("beta: stable Check cannot be offered Arena via channel.json", () => {
  const chan = JSON.parse(read("channel.json"));
  const beta = JSON.parse(read("channel-beta.json"));
  const ver = read("VERSION").trim();
  assert.equal(ver, "1.2.50.38-beta.1");
  assert.doesNotMatch(ver, /1\.2\.51/);
  assert.equal(chan.version, "1.2.50.38");
  assert.equal(chan.channel, "stable");
  assert.equal(chan.tarball, "https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz");
  assert.doesNotMatch(JSON.stringify(chan), /beta-arena-books/);
  assert.equal(beta.version, "1.2.50.38-beta.1");
  assert.equal(beta.channel, "beta");
  assert.equal(
    beta.tarball,
    "https://github.com/ajt1995/reelos/archive/refs/heads/cursor/beta-arena-books-5ba6.tar.gz",
  );
  assert.match(beta.notes[0], /Arena chrome and Books/);
});

test("beta: 1.2.50.38-beta.1 is newer than 38 in JS and mailman", () => {
  assert.ok(cmpVer("1.2.50.38-beta.1", "1.2.50.38") > 0);
  assert.equal(mailmanNewer("1.2.50.38-beta.1", "1.2.50.38"), true);
  assert.equal(mailmanNewer("1.2.50.38", "1.2.50.38-beta.1"), false);
  assert.equal(mailmanNewer("1.2.50.39", "1.2.50.38-beta.1"), true);
});

test("beta: mailman and Check skip main SHA-drift when beta is on", () => {
  const updater = read("daemon/reelos-update.sh");
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  assert.equal(updater, read("install/bin/reelos-update.sh"));
  assert.match(updater, /ui_wants_beta/);
  assert.match(updater, /beta channel from ui-settings.json/);
  assert.match(updater, /channel-beta\.json/);
  assert.match(updater, /cursor\/beta-arena-books-5ba6/);
  assert.match(updater, /sha_drift = newer is False and bool\(head\) and not same_tree and beta != "1"/);
  assert.match(plugin, /shaDrift = !beta && Boolean\(head\) && head !== applied/);
  assert.match(plugin, /ui apply using local mailman/);
  assert.match(plugin, /cursor\/beta-arena-books-5ba6\/daemon\/reelos-update\.sh/);
  assert.match(plugin, /dispatchBooksApi/);
});

test("beta: gold verbs are Watch / Download / Begin", () => {
  const splash = read("src/components/splash.tsx");
  assert.match(splash, /variant="gold"/);
  assert.match(splash, />\s*Begin\s*</);
  assert.doesNotMatch(splash, /Begin setup/);
  const shell = read("src/components/shell.tsx");
  assert.match(shell, /bg-gold[\s\S]{0,180}Watch/);
  const books = read("src/components/books-view.tsx");
  assert.match(books, /variant="gold"/);
  assert.match(books, /Download/);
  const settings = read("src/components/settings-updates.tsx");
  assert.match(settings, /variant="circuit"/);
  assert.doesNotMatch(settings, /variant="gold"/);
  assert.match(settings, /\bCheck\b/);
  assert.match(settings, /Apply \{update\.target\}/);
  const wizard = read("src/components/wizard.tsx");
  assert.doesNotMatch(wizard, /variant="gold"/);
  assert.doesNotMatch(wizard, /text-gold/);
  const title = read("src/components/title-view-live.tsx");
  assert.match(title, /variant="gold"/);
  assert.match(title, />\s*Watch\s*</);
  assert.doesNotMatch(title, /Play in Jellyfin/);
  const applying = read("src/components/applying-bar.tsx");
  assert.match(applying, /text-circuit/);
  assert.doesNotMatch(applying, /gold/);
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
  }
  assert.match(read("src/lib/store.ts"), /books: false/);
  assert.match(read("src/components/wizard.tsx"), /key: "books"/);
  assert.match(read("src/components/wizard.tsx"), /Music and Books never appear unless you ask/);
  assert.doesNotMatch(read("src/components/books-view.tsx"), /Lidarr|lidarr|Tron/i);
  assert.match(read("scripts/books-catalog.mjs"), /gutenberg\.org/);
  assert.match(read("scripts/books-catalog.mjs"), /standardebooks\.org/);
  assert.match(read("scripts/books-catalog.mjs"), /archive\.org/);
  assert.match(read("scripts/reelos-books.mjs"), /ReelOS-books/);
  assert.match(read("src/lib/provision-appliance.ts"), /intent\.books/);
});
