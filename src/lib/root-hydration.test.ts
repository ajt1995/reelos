import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("child route boundary closes every non-home navigation until the active profile is rechecked", () => {
  const file = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "routes", "__root.tsx"), "utf8");
  assert.match(file, /const pathname = useRouterState/);
  assert.match(file, /const \[authorizedPath, setAuthorizedPath\] = useState\(""\)/);
  assert.match(file, /setAuthorizedPath\(""\)/);
  assert.match(file, /\}, \[pathname\]\)/);
  assert.doesNotMatch(file, /typeof window !== "undefined" && window\.location\.pathname === "\/"/);
  assert.match(file, /pathname !== "\/" && authorizedPath !== pathname/);
});

test("profile menu protects Devices with the same child exit gate as Family and Settings", () => {
  const file = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "experience", "reelos-world.tsx"), "utf8");
  assert.match(file, /onClick=\{\(\) => onProtectedNavigate\("devices"\)\}/);
  assert.doesNotMatch(file, /onClick=\{\(\) => onNavigate\("devices"\)\}[\s\S]{0,160}>\s*Devices/);
});
