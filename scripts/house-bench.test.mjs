import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/house-bench.sh");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function run(env = {}, args = []) {
  return spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("house-bench.sh is a read-only SSH probe, not a stamp", () => {
  const st = statSync(script);
  assert.ok((st.mode & 0o111) !== 0, "executable");
  const sh = read("scripts/house-bench.sh");
  const rule = read(".cursor/rules/house-bench.mdc");
  const dev = read("DEV.md");

  assert.match(sh, /HOUSE_BENCH_WRITE:-0/);
  assert.match(sh, /HP Laptop 15-bs0xx/);
  assert.match(sh, /100\.100\.154\.16/);
  assert.match(sh, /reelos\.tail977fee\.ts.net/);
  assert.match(sh, /login\.tailscale\.com/);
  assert.match(sh, /fuse\.decypharr/);
  assert.match(sh, /ffprobe_D/);
  assert.match(sh, /orphan_start_box/);
  assert.match(sh, /library-progress/);
  assert.match(sh, /will not Apply/);
  assert.match(sh, /not a Pi/);
  assert.match(sh, /Never print adminPassword/);
  assert.doesNotMatch(sh, /Raspberry/);
  assert.doesNotMatch(sh, /answers\.json/);
  assert.doesNotMatch(sh, /docker restart/);
  assert.doesNotMatch(sh, /rm .*ota\.lock/);
  assert.doesNotMatch(sh, /rm -rf \/media/);
  assert.doesNotMatch(sh, /npm ci/);
  assert.doesNotMatch(sh, /vite --/);
  assert.doesNotMatch(sh, /git clone/);

  assert.match(rule, /scripts\/house-bench\.sh/);
  assert.match(rule, /15-bs0xx/);
  assert.match(rule, /take-environment-snapshot/);
  assert.match(rule, /[Nn]ot a Pi/);
  assert.match(dev, /scripts\/house-bench\.sh/);
  assert.doesNotMatch(dev, /Agents cannot SSH/);
});

test("HOUSE_BENCH_WRITE and non-reelos user are refused without SSH", () => {
  const write = run({ HOUSE_BENCH_WRITE: "1" });
  assert.equal(write.status, 2);
  assert.match(write.stderr, /read-only/);

  const user = run({ HOUSE_USER: "root" });
  assert.equal(user.status, 2);
  assert.match(user.stderr, /must be reelos/);

  const apply = run({}, ["apply"]);
  assert.equal(apply.status, 2);
  assert.match(apply.stderr, /will not Apply/);
});
