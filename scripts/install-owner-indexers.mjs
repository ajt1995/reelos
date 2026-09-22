import {
  chmodSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadOwnerIndexerPresets,
  ownerIndexerPresetPath,
} from "./services/neural-indexer-repair.mjs";

const source = process.argv[2] ? resolve(process.argv[2]) : "";
const target = process.argv[3]
  ? resolve(process.argv[3])
  : ownerIndexerPresetPath();

if (!source) {
  console.error(
    "Usage: npm run owner:indexers -- <private-preset.json> [target-path]",
  );
  process.exit(2);
}

const presets = loadOwnerIndexerPresets({ path: source });
if (presets.length === 0) {
  console.error("Owner preset refused: no valid connections were found.");
  process.exit(1);
}

const document = {
  schemaVersion: 1,
  notice:
    "Private owner configuration. The owner is responsible for authorization and provider terms.",
  presets,
};
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(document, null, 2) + "\n", {
  mode: 0o600,
});
try {
  chmodSync(target, 0o600);
} catch {
  // Windows permissions are inherited; the file is still outside the release.
}
console.log(`Installed ${presets.length} private owner connection(s) at ${target}`);
