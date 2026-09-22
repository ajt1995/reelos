# Agent context

This directory contains only durable, active context that cannot be derived reliably from source control or the repository. It is deliberately not a journal.

- `active-decisions.json` is the short, human-maintained decision set. Update it only for a durable change; replace obsolete decisions instead of appending history.
- `neural-capabilities.json` annotates the capability IDs owned by the runtime registry with the metadata code cannot safely infer: intent, lifecycle, inputs, outputs, fallback, privacy, resource budget, owner, tests, and evidence. `npm run architecture:report` merges it with actual runtime and coordinator registrations.
- `legacy-retirement.json` is the concise current boundary for retired, migration-only, and deliberately retained compatibility architecture. It is not a deletion checklist.
- `npm run context:brief` generates current repository state directly from Git, `package.json`, the feature register, and local audit reports. Its output is not committed.

`npm run context:check` validates all of these inputs and the neural architecture contract. Missing capability metadata, false coordinator claims, stale evidence paths, or an unclassified runtime capability fail closed.

For source precedence, resumption steps, and validation commands, see the repository-root [`AGENTS.md`](../../AGENTS.md).
