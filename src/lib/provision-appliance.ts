import { createServerFn } from "@tanstack/react-start";
import type { WizardAnswers } from "./types";

function composeProfiles(answers: WizardAnswers): string[] {
  const p = ["indexers"];
  if (answers.intent.movies) p.push("movies");
  if (answers.intent.tv || answers.intent.anime) p.push("tv");
  if (answers.intent.music) p.push("music");
  if (answers.intent.movies || answers.intent.tv || answers.intent.anime) p.push("subtitles");
  if (answers.frontend === "jellyfin" || answers.frontend === "both") {
    p.push("jellyfin");
    p.push("seerr");
  }
  if (answers.frontend === "plex" || answers.frontend === "both") p.push("plex");
  if (answers.source === "local-vpn") p.push("localvpn");
  else p.push("debrid");
  return p;
}

export const provisionAppliance = createServerFn({ method: "POST" })
  .validator((data: { answers: WizardAnswers }) => data)
  .handler(async ({ data }) => {
    if (process.env.REELOS_APPLIANCE !== "1") {
      return { ok: true as const, simulated: true as const };
    }
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { spawn } = await import("node:child_process");
    const root = process.env.REELOS_ROOT || "/opt/reelos";
    const stateDir = "/var/lib/reelos";
    const composeDir = path.join(root, "compose");
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(composeDir, "configs", "decypharr"), { recursive: true });
    const answers = data.answers;
    fs.writeFileSync(path.join(stateDir, "answers.json"), JSON.stringify(answers, null, 2), { mode: 0o600 });
    const profiles = composeProfiles(answers).join(",");
    const envLines = [
      `PUID=1000`,
      `PGID=1000`,
      `TZ=UTC`,
      `RD_API_KEY=${answers.source === "local-vpn" ? "" : answers.apiKey.trim()}`,
      `SOURCE=${answers.source}`,
      `COMPOSE_PROFILES=${profiles}`,
      `PLEX_CLAIM=${answers.plexClaim.trim()}`,
      `VPN_SERVICE_PROVIDER=${answers.vpnProvider || "custom"}`,
    ];
    fs.writeFileSync(path.join(composeDir, ".env"), envLines.join("\n") + "\n", { mode: 0o600 });
    if (answers.source !== "local-vpn") {
      const provider =
        answers.source === "torbox"
          ? "torbox"
          : answers.source === "alldebrid"
            ? "alldebrid"
            : answers.source === "premiumize"
              ? "premiumize"
              : "realdebrid";
      const cfg = {
        debrids: [
          {
            provider,
            name: provider,
            api_key: answers.apiKey.trim(),
            folder: "/mnt/debrid",
            use_webdav: false,
          },
        ],
        qbittorrent: {
          download_folder: "/mnt/symlinks",
          categories: ["sonarr", "radarr", "lidarr"],
        },
        default_download_action: "symlink",
        use_auth: false,
        log_level: "info",
        port: "8282",
      };
      fs.writeFileSync(
        path.join(composeDir, "configs", "decypharr", "config.json"),
        JSON.stringify(cfg, null, 2),
        { mode: 0o600 },
      );
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn("docker", ["compose", "up", "-d"], {
        cwd: composeDir,
        env: { ...process.env, COMPOSE_PROFILES: profiles },
        stdio: "ignore",
      });
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`compose ${code}`))));
    });
    const wire = path.join(root, "bin", "wire-engines.py");
    if (fs.existsSync(wire)) {
      spawn("python3", [wire], { stdio: "ignore", detached: true }).unref();
    }
    fs.writeFileSync(path.join(stateDir, "provisioned"), "1\n");
    fs.writeFileSync(path.join(stateDir, "stack-installed"), "1\n");
    return { ok: true as const, simulated: false as const };
  });
