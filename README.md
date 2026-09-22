# ReelOS

ReelOS is a local-first personal cinema and reading system whose search, taste,
playback preparation, storage, machine health, family experience, and interface
adaptation share one on-device intelligence spine. Deterministic policy remains
authoritative for access, credentials, PINs, destructive actions, updates, and
resource safety.

The product is under active integration. Capability labels and release claims
must come from current code, tests, and acceptance evidence—never from an old
vision document or preview.

## Resume work

1. Read [AGENTS.md](AGENTS.md).
2. Run `npm run context:brief`.
3. Open only the task-specific files named by that brief.
4. Run the smallest relevant validation before a broad suite.

The authoritative scope is [docs/feature-register.json](docs/feature-register.json).
Durable decisions live in
[docs/agent-context/active-decisions.json](docs/agent-context/active-decisions.json).
Historical status and vision documents are provenance, not current instructions.

## Local development

```powershell
npm install
npm run context:check
npm run typecheck
npm run build:dev
npm run dev
```

Use `npm run doctor` for host prerequisites and `npm run scope:changed` to select
targeted checks. A passing inventory is not a release: acceptance remains gated
by `npm run audit:acceptance` and real platform evidence.
