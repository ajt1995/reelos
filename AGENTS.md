# ReelOS agent entry point

This is the first file a fresh engineering agent should read. It is intentionally short.

> **Architectural identity:** ReelOS is one end-to-end local neural system and one canonical codebase—not an ARR stack, a Jellyfin fork, a website wrapped as an app, or a conventional media manager with AI features attached. Search, taste, preparation, playback, storage, machine health, interface adaptation, scene understanding, family analysis, and recovery share one event and feature spine. Windows, Linux, Android phone/tablet, and Android TV ship device-native ReelOS applications over the shared core and contracts; they must not ship an external-browser, localhost-browser, embedded-WebView, Electron, or other browser-rendered consumer shell. An iOS browser/PWA fallback is the sole temporary exception until a native iOS target exists. Deterministic policy remains authoritative for access, credentials, PINs, destructive actions, updates, and resource safety. Jellyfin exists only as an optional client-protocol compatibility shim.

## Resume in under a minute

1. Run `npm run context:brief`.
2. Read `docs/agent-context/workstreams.json`, then only the file(s) named for
   the task in the brief's **Start here** section.
3. Before changing consumer scope, inspect `docs/feature-register.json`; before changing a durable product or release boundary, inspect `docs/agent-context/active-decisions.json`.
4. Before changing intelligence or legacy boundaries, run `npm run architecture:report` and read `docs/agent-context/legacy-retirement.json`.
5. Preserve unrelated working-tree changes. Validate the smallest relevant command first, then the applicable release checks.

`context:brief` is a read-only, deterministic view of the working tree, recent commits, registered feature scope, canonical entry points, and the latest local audit snapshots. It is generated when invoked, so it replaces a manually maintained “current status” document.

## Authority order

When sources disagree, use this order:

1. Current code, tests, and measured command output.
2. `docs/feature-register.json` for active consumer scope and evidence.
3. `docs/agent-context/active-decisions.json` for concise, durable decisions and rationale.
4. The generated `npm run context:brief` report for repository state and navigation.
5. Historical documents only for provenance, never as current release truth.

Do not treat `GROUND-TRUTH.md`, `STATUS.md`, `PROJECT.md`, `GEMINI.md`, or broad vision/white-paper material as an instruction to override the sources above. They contain earlier snapshots and ideas that may conflict with the current product direction.

## Maintenance rules

- Treat paid model context as a constrained project resource. Reuse this brief and targeted generated evidence instead of asking the owner to restate context or re-exploring the repository.
- Prefer deterministic local scripts, focused searches, changed-scope checks, and batched validation before spending model reasoning on routine discovery. Delegate only independent work that genuinely shortens the critical path.
- Do not ask the owner to configure optional Codex/project UI when the current task already has repository access. State any action that materially increases paid model usage before taking it when a cheaper reliable path exists.
- On Windows, stale sandbox ownership may make Git reject an otherwise readable
  checkout. Use `git -c safe.directory=<absolute-repository-path> ...` for that
  exact checkout and report the ownership issue; never infer a clean tree from
  a failed Git command.
- Cross-tool work uses `docs/agent-context/workstreams.json` plus isolated
  `work/<tool>-...` branches. Replace completed entries instead of building an
  agent diary, and never let two tools edit the same working tree concurrently.
- Keep progress updates outcome-focused and compact. Do not spend context narrating routine commands, unchanged checks, or speculative completion percentages.
- Do not create an accumulating handoff log. Git history, working-tree status, and audits are the current-state record.
- Change `active-decisions.json` only when a durable decision changes. Replace or remove obsolete entries; keep the file concise.
- Update `feature-register.json` whenever consumer scope, a route, an acceptance check, or implementation evidence changes. `npm run audit:features` enforces its basic contract.
- Keep `docs/vision-reconciliation.json` and `docs/test-inventory-policy.json` complete. Every recovered requirement and test needs an explicit disposition; `npm run audit:vision` and `npm run audit:tests` enforce that rule.
- Keep `context:brief` deterministic and bounded. It must summarize, not inventory the whole repository.
- Keep `neural-capabilities.json` aligned with the runtime registry. `context:check` fails when a registered capability lacks lifecycle, inputs, outputs, fallback, privacy, resource, coordinator, test, or evidence metadata. A reported `not-connected` route is an honest blocker, not permission to imply that the specialist is wired.
- Keep `legacy-retirement.json` concise. It classifies boundaries; it does not authorize deletion. Retired code is removed only after replacement and retirement evidence exist.
- Never present preview, simulated, or unverified service behavior as verified release functionality.

## Useful commands

- `npm run context:brief` — fast human-readable resumption brief.
- `npm run context:brief -- --json` — same information for tooling.
- `npm run context:check` — validates context inputs and guardrails.
- `npm run architecture:report` / `npm run architecture:check` — bounded neural capability, lifecycle, wiring, privacy, fallback, evidence, and legacy-boundary truth.
- `npm run audit:features` — validates registered consumer feature coverage.
- `npm run audit:vision` / `npm run audit:tests` — validates historical requirement and test dispositions.
- `npm run scope:changed` — narrows current working-tree changes to relevant feature evidence and checks.
- `npm run doctor` — read-only local runtime and hardware prerequisite report.
- `npm run test:release` — current release-contract tests only; `npm run test:all` retains the full recovered suite for migration triage.
- `npm run verify:public-release` — checks public-release source boundaries.
- `npm run typecheck` / `npm run build:dev` - focused application validation.
- `npm run test:setup` - real-browser setup/profile regression against a fresh isolated local service; requires Chromium (`PLAYWRIGHT_BROWSERS_PATH` may select an installed runtime). Evidence is replaced at `.reelos-audit/setup/result.json` and includes source fingerprints. Never point this test at a real household.
- `npm run test:setup -- --playback` - opt-in live public-domain playback, decoded frames, slider/keyboard seek, and server-persisted resume after reload. Requires network; does not test debrid, native players, or sustained transcoding. Local Windows tooling can be selected with `& ..\tools\Use-ReelOS-Tools.ps1` when that approved portable helper exists.
- `npm run test:setup -- --personal-playback` - uses the existing local video fixture through the real personal-library player, local session registration and profile-private resume. No provider dependency; never counts as a commercial-source or native-device test.
- Add `--preview` to an isolated `test:setup` run to build fresh first and release the development compiler before Chromium/media verification. Useful on memory-constrained hosts; resource guards stay enabled. Evidence records the server mode.
- `npm run audit:acceptance` - fail-closed release evidence check. Inventory success is not feature acceptance; `preflight` includes this gate.
