import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Exercise the component's real request/deduplication owner without a browser or network.
const source = readFileSync(new URL("../src/components/discover-browse-view.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function("require", "exports", compiled)(() => ({}), exports);
const { createDiscoverBrowseQuery } = exports;

test("repeated first-page results replace with a fresh deduplicated page instead of emptying titles", () => {
  const query = createDiscoverBrowseQuery("movie:popular:");
  const rows = [{ id: "a" }, { id: "b" }, { id: "a" }];
  assert.deepEqual(query.accept(query.begin(1), rows), [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(query.accept(query.begin(1), rows), [{ id: "a" }, { id: "b" }]);
});

test("append pages dedupe across the current results and within each new page", () => {
  const query = createDiscoverBrowseQuery("movie:popular:");
  const first = query.accept(query.begin(1), [{ id: "a" }, { id: "b" }]);
  const next = query.accept(query.begin(2), [{ id: "b" }, { id: "c" }, { id: "c" }, { id: "" }]);
  assert.deepEqual([...first, ...next], [{ id: "a" }, { id: "b" }, { id: "c" }]);
});

test("the latest duplicate page request wins even if the earlier fetch ignores cancellation", () => {
  const query = createDiscoverBrowseQuery("movie:popular:");
  const old = query.begin(1);
  const current = query.begin(1);
  assert.equal(old.controller.signal.aborted, true);
  assert.deepEqual(query.accept(current, [{ id: "new" }]), [{ id: "new" }]);
  assert.equal(query.accept(old, [{ id: "stale" }]), null);
  assert.equal(query.isCurrent(old), false);
});

test("category or genre cleanup rejects late data and errors and frees request ownership", () => {
  const oldQuery = createDiscoverBrowseQuery("movie:popular:1");
  const pending = oldQuery.begin(1);
  oldQuery.dispose();
  const nextQuery = createDiscoverBrowseQuery("movie:popular:2");
  assert.equal(pending.controller.signal.aborted, true);
  assert.equal(oldQuery.accept(pending, [{ id: "wrong-genre" }]), null);
  assert.equal(oldQuery.isCurrent(pending), false);
  assert.deepEqual(nextQuery.accept(nextQuery.begin(1), [{ id: "right-genre" }]), [{ id: "right-genre" }]);
  assert.equal(oldQuery.begin(2).controller.signal.aborted, true);
});

test("refreshing page one invalidates pending appends and resets the deduplication baseline", () => {
  const query = createDiscoverBrowseQuery("movie:popular:");
  query.accept(query.begin(1), [{ id: "a" }]);
  const pendingAppend = query.begin(2);
  const refreshed = query.begin(1);
  assert.equal(pendingAppend.controller.signal.aborted, true);
  assert.equal(query.accept(pendingAppend, [{ id: "old-append" }]), null);
  assert.deepEqual(query.accept(refreshed, [{ id: "b" }]), [{ id: "b" }]);
  assert.deepEqual(query.accept(query.begin(2), [{ id: "a" }]), [{ id: "a" }]);
});
