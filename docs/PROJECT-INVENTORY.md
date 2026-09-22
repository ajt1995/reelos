# ReelOS Project Inventory & Roadmap

> **Historical audit snapshot.** Status labels in this document record prior claims and are not release evidence. For the current feature and service truth, use [feature-register.json](feature-register.json), [INTERFACE-FEATURE-REGISTER.md](INTERFACE-FEATURE-REGISTER.md), and [GROUND-TRUTH.md](../GROUND-TRUTH.md).

> This inventory serves as the living source of truth for the continual development, testing, and scaling of ReelOS. It is maintained by the AI agents to ensure nothing is dropped, ignored, or hallucinated as completed when it is merely stubbed.

## 1. Core Architecture: End-to-End Neural Engine

| Component | Status | Next Steps for Continual Development |
| :--- | :--- | :--- |
| **Neural Stream Server (DirectPlay)** | `VERIFIED` | Fully wired in `scripts/reelos-box.mjs` (lines 234-238) with zero-copy DirectPlay and local hybrid storage detection. Android TV and Web players point to native endpoints without 8096 fallbacks. |
| **ReelFlow Scraper Engine** | `VERIFIED` | Scraper logic in `search.mjs` actively uses `neuralIndexerRepair.repairIndexer()` for public mirrors and wraps TorBox calls in `TorBoxRateLimiter`. |
| **Offline / Off-Network Access** | `IN PROGRESS` | Headless ephemeral auth keys configured for silent Tailscale MagicDNS mapping (`https://reel-a8f9c2.ts.net`). Eliminates LAN-IP exposure without breaking Invisible Magic. |
| **Storage & Download Architecture** | `VERIFIED` | v1.0 wired into `neural-stream-server.mjs`. v1.1 evolving: user disk allocation (flash drives to server racks) with autonomous AI LRU storage eviction (<10% threshold). |

## 2. Machine Health, Sentinels, and Resource Yielding

| Component | Status | Next Steps for Continual Development |
| :--- | :--- | :--- |
| **Dynamic RAM Allocation (Elastic Ceiling)** | `VERIFIED` | Dedicated appliances take 100% RAM (-256MB / -1GB headroom); shared PCs yield politely to <4MB upon foreign game/creator app detection. |
| **Console Gaming Sentinel** | `VERIFIED` | `consoleSentinel.startPingLoop(5000)` verified in `reelos-box.mjs`. v1.1 QoS smoothing: step down bitrate/chunk pacing during high-latency gaming spikes. |
| **Zero-Interference Stealth** | `VERIFIED` | V8 garbage collection triggers and priority dropping when foreign processes (Steam, Adobe) are detected. |

## 3. Fleet Learning & Swarm Intelligence

| Component | Status | Next Steps for Continual Development |
| :--- | :--- | :--- |
| **Nightly Whispering Compute** | `VERIFIED` | Fleet talks at night (1 AM - 6 AM) with micro-batching (20ms compute, 80ms rest, <15% CPU). |
| **Taste Manifold Distillation** | `VERIFIED` | High-power machines distill 512-dim manifolds into 64-dim anchors for potato/mobile nodes via `/api/fleet/*`. |
| **Fleet Network Telemetry** | `VERIFIED` | Online EWMA dynamically tracks jitter, baseline RTT, and TorBox 429 limits to pace the swarm. |

## 4. UI/UX & Companion Apps

| Component | Status | Next Steps for Continual Development |
| :--- | :--- | :--- |
| **Android APK Dashboard** | `VERIFIED` | Clean dashboard native app hosted at `/downloads/reelos-app.apk`. Real ADB execution in `android-client-service.mjs`. |
| **FlickMatch & Household Consensus** | `VERIFIED` | LinUCB engine blends tastes on TV and preserves sovereignty on mobile. |
| **Zero-AI Jargon Rule** | `ACTIVE` | Continual UX audits ensure terms like "Vector, Manifold, AI, LinUCB" never appear in user-facing components. |
| **Audio Intelligence (Night Mode)** | `VERIFIED` | Physical -10dB 120Hz LFE clamp and +5dB dialogue boost biquad filter nodes verified in `src/lib/audio-booster.ts`. |

## Continual Evolution Protocol
- As ideas evolve (e.g. from `v1.0` to `v1.1` in the Vision Ledger), agents must document the new trajectory here.
- Any uncertainty during development MUST be escalated to the user via the `ask_question` tool.
- Agents are strictly forbidden from mocking tests or faking success. Code is not done until it is wired into `reelos-box.mjs` and verified.
