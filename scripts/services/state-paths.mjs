import { join } from "node:path";

// An explicit installation/test state directory must never fall back to another home's credentials.
export function resolveAnswersPath({ stateDir = process.env.REELOS_STATE, platform = process.platform, cwd = process.cwd(), home = process.env.HOME } = {}) {
  if (stateDir) return join(stateDir, "answers.json");
  if (platform === "win32") return join(cwd, ".reelos-state", "answers.json");
  if (platform === "darwin" && home) return join(home, "Library", "Application Support", "reelos", "answers.json");
  return "/var/lib/reelos/answers.json";
}
