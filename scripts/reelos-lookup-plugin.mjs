import { readFileSync, existsSync, appendFileSync, writeFileSync, openSync, mkdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";

function xmlKey(file) {
  if (!existsSync(file)) return null;
  const m = /<ApiKey>([^<]+)<\/ApiKey>/.exec(readFileSync(file, "utf8"));
  return m?.[1] ?? null;
}

function note(msg) {
  try {
    appendFileSync("/var/lib/reelos/lookup.log", `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* */
  }
}
