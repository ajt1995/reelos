# ReelOS Architecture Synthesis & System Map

## 1. Architecture & Services

### Native Engines & Core Plugins
- **`reelos-box.mjs`**: The core HTTP server and entry point. Responsible for serving the static Vite/Nitro UI, dispatching API requests, streaming media files, and orchestrating native host operations.
- **`reelos-lookup-plugin.mjs`**: The primary router and API handler. It dynamically intercepts dozens of `/api/*` endpoints (storage, wifi, tailscale, hardware, curator, pulse AI) and manages system state.
- **`reelos-request-progress-plugin.mjs`**: Handles external requests progress (Seerr integration) and coordinates recovery of missing titles.
- **`reelos-episodes-plugin.mjs`**: Micro-plugin to handle specific episode-level lookups separately from the main lookup logic.
- **`reelos-seerr.mjs` / `reelos-library.mjs`**: Sub-engines handling the heavy lifting of API translation for discovery (Seerr) and on-disk library cache generation.

### Services (`scripts/services/`)
- **Intelligence & Curation**: `pulse-ai-service.mjs`, `curation-engine.mjs`, `curator-service.mjs`, `audio-intelligence.mjs`
- **Device & Storage Management**: `battery-service.mjs`, `battery-guardian.mjs`, `hdd-guardian.mjs`, `neuro-cache.mjs`, `storage-service.mjs`
- **Playback & Media**: `playback-session-service.mjs`, `jellyfin-service.mjs`, `jellyfin-shim-service.mjs`, `adaptive-playback.mjs`, `intro-skipper-service.mjs`
- **Network & Gateways**: `network-service.mjs`, `reelos-gate-service.mjs`, `offline-service.mjs`, `diagnostics-heartbeat-service.mjs`
- **Users & Client Services**: `android-client-service.mjs`, `guest-pass-service.mjs`, `profile-service.mjs`, `passport-service.mjs`

### State Directory (`.reelos-state/`)
The single source of truth for runtime persistence:
- **`library-shelf.json`**: Cached library index map.
- **`hardware-profile.json`**: Serialized hardware capabilities.
- **`profiles.json` & `answers.json`**: User profiles and setup configurations.
- **`installed-version` & `gate_secret.key`**: Identifiers and security keys.

## 2. Hardware & Deployment Matrix

- **Windows Native**: Zero-VM integration. Managed via `reelos-windows-launcher.ps1`, `reelos-tray.ps1`, `setup-windows-native.py`, and `start-windows-native.bat`/`stop-windows-native.bat`. Heavily relies on Direct3D, NVENC, and QuickSync (managed via GPU autotune tests and scaling logic).
- **Debian Minimal Appliance**: Uses an ISO/FUSE based architecture. Scripts like `cidata-iso.py`, `remaster-iso.sh`, `pack-appliance.mjs`, and `.soak` testing indicate a bare-metal, highly resilient Linux footprint tailored for devices like the HP laptop (Pentium N3710).
- **Android TV**: Provisioned and served dynamically. Endpoints inside `reelos-lookup-plugin.mjs` specifically serve `reelos-app.apk` and orchestrate wireless ADB deployments to living room devices (e.g. 192.168.1.95:5555).
- **Mobile & PWA**: Served statically via `reelos-box.mjs` fetching from the prebuilt UI output, wrapped seamlessly by `grok-pwa-plugin.mjs`.

## 3. Endpoints & API Topology

Served directly via `reelos-lookup-plugin.mjs` and native plugins:
- **Core Lookup & Discovery**: `/api/lookup`, `/api/discover`, `/api/similar`, `/api/collection`, `/api/person`
- **Curator & Machine Learning**: `/api/curator`, `/api/curator/teach`, `/api/curator/feed`, `/api/curator/reset`
- **Storage & Disks**: `/api/storage`, `/api/disks`, `/api/disks/hotplug`, `/api/storage/hdd-health`, `/api/storage/neuro-cache`, `/api/disks/migrate-internal`
- **Networking & Tunneling**: `/api/wifi/scan`, `/api/wifi/connect`, `/api/wifi/status`, `/api/tailscale/login`, `/api/tailscale/install`, `/api/tailscale/check`, `/api/tailscale/serve`
- **System & Updates**: `/api/update/check`, `/api/update/apply`, `/api/update/status`, `/api/update/progress`, `/api/terminal`, `/api/logs`, `/api/performance`, `/api/hardware`
- **Pulse AI & Telemetry**: `/api/pulse/telemetry`, `/api/pulse/playback-plan`, `/api/pulse/battery`, `/api/pulse/audio`
- **Library & Content**: `/api/library`, `/api/library/reset`, `/api/library/sanitize`, `/api/jf/Items/...`, `/api/episodes` (via plugin), `/api/request` (via plugin), `/api/requests/pending`, `/api/books`

## 4. Tests & Quality Gates

The test bench provides vast coverage of the core mechanics:
- **Core Stability**: `stack-smoke.test.mjs`, `browser-smoke-verdict.test.mjs`, `reelos-box-scale.test.mjs`, `reelos-ready.test.mjs`
- **Appliance & Deployment**: `appliance-superpowers.test.mjs`, `firstboot-install.test.mjs`, `autoinstall-usb.test.mjs`, `setup-vm-mac.test.mjs`
- **Hardware & Peripherals**: `hw-profile-probe.test.mjs`, `gpu-autotune.test.mjs`, `storage-safety.test.mjs`, `intelligent-drive-controller.test.mjs`
- **Library & Data Integrity**: `reelos-library.test.mjs`, `write-atomic.test.mjs`, `jellyfin-seed.test.mjs`, `stuck-downloads.test.mjs`, `sonarr-manual-import.test.mjs`
- **UI & Flow Testing**: `house-home-click.test.mjs`, `rookie-house.test.mjs`, `title-art-layout.test.mjs`, `living-room-social.test.mjs`
- **Updates & OTA**: `reelos-update.test.mjs`, `reelos-ota-progress.test.mjs`, `reelos-ota-status.test.mjs`, `reelos-ota-rollback.test.mjs`
- **Service Specs**: `services.test.mjs`, `media-sources-service.test.mjs`, `reelos-gate-service.test.mjs`, `jellyfin-shim-service.test.mjs`, etc.

## Outstanding Observations & Gaps
- **Orphaned Files Check**: The `test_output.txt`, `tsc_output.txt`, and `scratch_err.txt` files at the root likely need cleanup. 
- **Architectural Cleanup**: `reelos-lookup-plugin.mjs` is massive (nearly 5,000 lines) and currently handles a monolithic routing layer. It might benefit from being split into domain-specific plugins (like how episodes and requests are split).
- **Service Growth**: The `scripts/services/` folder has a fantastic set of separated concerns, but they all funnel back into monolithic HTTP routers rather than registering their own route slices natively.
