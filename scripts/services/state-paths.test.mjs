import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { resolveAnswersPath } from "./state-paths.mjs";

test("explicit state always wins, including when its credential file does not yet exist", () => {
  for (const platform of ["win32", "linux", "darwin"]) {
    assert.equal(resolveAnswersPath({ stateDir: "isolated-home", platform, cwd: "other-home" }), join("isolated-home", "answers.json"));
  }
});
test("platform defaults stay within the selected home", () => {
  assert.equal(resolveAnswersPath({ stateDir: "", platform: "win32", cwd: "project" }), join("project", ".reelos-state", "answers.json"));
  assert.equal(resolveAnswersPath({ stateDir: "", platform: "darwin", home: "person" }), join("person", "Library", "Application Support", "reelos", "answers.json"));
});
