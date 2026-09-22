import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Compile the actual small, dependency-free component in memory for native Node tests.
const componentUrl = new URL("../src/components/curator-status.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(componentUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function("require", "exports", compiled)(createRequire(componentUrl), exports);
const { CuratorStatus } = exports;
const idle = { loading: false, saving: false, error: null, retry() {} };
const render = (props) => renderToStaticMarkup(createElement(CuratorStatus, { ...idle, ...props }));

test("taste status disappears when healthy and announces loading or unacknowledged saving", () => {
  assert.equal(render({}), "");
  const loading = render({ loading: true });
  assert.match(loading, /role="status"/);
  assert.match(loading, /Loading your saved taste/);
  assert.doesNotMatch(loading, /<button/);
  const saving = render({ saving: true });
  assert.match(saving, /Saving your choice/);
  assert.doesNotMatch(saving, /Saved|<button/);
});

test("taste failure renders an accessible 48px retry and invokes only the supplied reload callback", () => {
  let reloads = 0;
  const props = { ...idle, error: "Your taste could not be loaded. Please retry.", retry: () => { reloads += 1; } };
  const html = render(props);
  assert.match(html, /role="alert"/);
  assert.match(html, /type="button"/);
  assert.match(html, /Retry loading taste/);
  assert.match(html, /min-h-\[48px\]/);
  assert.match(html, /min-w-\[48px\]/);
  assert.match(html, /focus-visible:outline/);
  assert.equal(reloads, 0);
  const tree = CuratorStatus(props);
  const button = tree.props.children[1];
  assert.equal(button.type, "button");
  button.props.onClick();
  assert.equal(reloads, 1);
});

test("save errors explain explicit retry and busy retry cannot be double-submitted", () => {
  const html = render({ error: "Your taste was not saved. Please try again." });
  assert.match(html, /To retry a choice that was not saved, select it again/);
  assert.match(html, /Retry loading taste/);
  for (const busy of [{ loading: true }, { saving: true }]) {
    assert.match(render({ error: "Try again", ...busy }), /disabled=""/);
  }
});

test("all four legacy taste consumers expose the same hook-bound recovery surface", () => {
  for (const name of ["discover-view", "discover-browse-view", "library-view", "title-view-live"]) {
    const source = readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), "utf8");
    assert.match(source, /const curator = useCurator\(\)/, name);
    assert.match(source, /<CuratorStatus \{\.\.\.curator\} \/>/, name);
    assert.match(source, /import \{ CuratorStatus \} from "@\/components\/curator-status"/, name);
  }
});

test("taste cards cannot infer cache readiness or 4K HDR from catalog identity", () => {
  const source = readFileSync(new URL("../src/components/title-card.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /titleInCache|showCache|4K HDR/);
});
