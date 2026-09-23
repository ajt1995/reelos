# ReelOS tool adapter

This file is deliberately small. It exists only for tools that automatically
read `GEMINI.md`.

1. Read [`AGENTS.md`](AGENTS.md) completely.
2. Run `npm run context:brief` and inspect
   [`docs/agent-context/workstreams.json`](docs/agent-context/workstreams.json).
3. Use code/tests as evidence of what exists. The owner's latest explicit
   decisions govern intended behavior; reconcile conflicts against
   `docs/feature-register.json` and `docs/agent-context/active-decisions.json`.
   Read `docs/agent-context/branch-reconciliation.md` before integrating branches.
4. Work only on the assigned branch/workstream. Do not edit `main` directly or
   overwrite another tool's uncommitted changes.
5. Return a commit plus the smallest relevant validation evidence. Never claim
   preview, simulated, skipped, or environment-blocked behavior as verified.

ReelOS is one end-to-end local neural system. Deterministic policy remains
authoritative for access, credentials, PINs, destructive actions, updates, and
resource safety. It is one canonical codebase with device-native Windows,
Linux, Android phone/tablet, and Android TV applications. Those targets must
not ship a browser, localhost web UI, embedded WebView, Electron, or another
browser-rendered consumer shell. Only iOS may use the temporary browser/PWA
fallback until a native iOS target exists. Jellyfin is only an optional
client-protocol shim.
