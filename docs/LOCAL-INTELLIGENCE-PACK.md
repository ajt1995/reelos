# Optional local intelligence pack

ReelOS can install a small, local concierge runtime and a Qwen2.5-1.5B Q4_K_M model pack for later evaluation. It is optional: all household journeys retain their deterministic, offline behavior without it.

## Install

On a supported Windows x64 machine, run:

```powershell
npm run intelligence:install-pack
```

The pack is placed outside the repository by default:

`%LOCALAPPDATA%\ReelOS\model-packs`

Set `REELOS_MODEL_PACK_DIR` to an **absolute** private state path to choose another location. The installer never writes model binaries into the repository or an application release artifact.

It downloads only these pinned upstream artifacts:

| Artifact | Pin | Integrity check | License |
| --- | --- | --- | --- |
| llama.cpp Windows CPU x64 | `b11065` | 18,466,663 bytes; SHA-256 `33f941a74b8db38e92690f5f151a770ef5a66481c07dabfe2e505b57e3546807` | MIT |
| Qwen2.5-1.5B-Instruct GGUF Q4_K_M | `91cad51170dc346986eccefdc2dd33a9da36ead9` | 1,117,320,736 bytes; SHA-256 `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e` | Apache-2.0 |

Each download is written to a same-volume temporary file, checked for its exact byte size and SHA-256, and only then renamed into place. A valid prior download is reused; an invalid existing file is never overwritten automatically. `LICENSE-NOTICES.json` and `install-receipt.json` remain with the private pack as audit receipts.

## What installation does not do

Installation does **not** start a process, create a network service, register an artifact, evaluate a model, activate a capability, or change access, safety, PIN, playback, storage, source, or update decisions. Those remain deterministic. A separate signed-manifest verification and evaluation gate must pass before an installed model can be active.

The runtime archive itself is hash-verified before extraction. Upstream does not publish separate hashes for every extracted executable in this pack, so ReelOS records the archive identity and refuses to treat installation as capability verification. If the installation directory is damaged, remove that private pack directory yourself and reinstall; the installer will not silently overwrite it.

This default pack is pinned for Windows x64. macOS and Linux installs intentionally fail rather than substitute an unreviewed runtime.
