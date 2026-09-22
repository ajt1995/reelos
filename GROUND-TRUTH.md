# ReelOS Ground Truth: historical architecture snapshot

> **Historical, not current authority.** This recovered snapshot contains prior claims and assumptions that can conflict with current code and release policy. Read [`AGENTS.md`](AGENTS.md) and run `npm run context:brief` first. Current code/tests, the feature register, and active decisions supersede this document.

**Authoritative Status**: Living Canonical Truth  
**Last Synchronized**: September 17, 2026 (Milestone v2.0.0 "End-to-End Neural Cinema")  
**Applicability**: ALL Agents, Architects, Subagents, and Developers **MUST** read and obey this document prior to inspecting code or proposing changes.

---

## 🧭 The Core Reality of ReelOS

ReelOS is a **sovereign personal cinema operating system and home appliance**. It is zero-VM, local-first, privacy-shielded, and powered end-to-end by an on-device neural media engine.

The system is governed by [The Seven Inviolable Laws of ReelOS](docs/THE-LAWS-OF-REELOS.md).

---

## 🟢 WHAT IS ALIVE & ACTIVE (Current Production Architecture)

### 1. The ReelOS Native Neural Engine
- **No External Media Servers**: ReelOS does **NOT** use Jellyfin, Plex, Emby, or any third-party media server daemon. ReelOS’s built-in neural media engine (`curation-engine.mjs`, `curator-service.mjs`, `media-strategy-service.mjs`, `neural-scale-engine.mjs`, `companion-service.mjs`) completely replaced them.
- **Direct Catalog & Vector Graph**: Maintains high-dimensional vector embeddings (128/256/512 dims) in SQLite/PGLite for semantic search, mood discovery, and resident taste calibration without external metadata servers.
- **Dynamic 100% RAM Allocation**:
  - **Dedicated Machines**: Always allocate 100% of physical RAM headroom ($\text{Total} - 256\text{MB}$ OS baseline on $\ge 8\text{GB}$ machines; preserves a 1GB video ceiling on $<6\text{GB}$ potatoes) directly to AI agents and manifolds. Local app memory eviction is bypassed.
  - **Shared Workstations**: Detects foreign creator apps (`photoshop.exe`, `lightroom.exe`, `steam.exe`, etc.) and politely contracts to $<4\text{MB}$ and idle CPU priority.
  - **Console Ping Protection**: Automatically yields network bandwidth when a PS5, Xbox, or Switch games on the LAN, while keeping 100% AI RAM footprint intact.

### 2. Sovereign Direct Playback & Streaming
- **ReelOS IS the Player**:
  - **Living Room TV (10-Foot Couch Mode)**: Native Kotlin Jetpack Compose app with official Google ExoPlayer 1.3.1 (`clients/android/`) streaming directly in pristine 4K HDR/Dolby Vision with D-pad navigation.
  - **Mobile & Tablet Client**: Adaptive Compose player supporting foldable tabletop split posture, picture-in-picture, and offline reading.
  - **Web Velvet Player**: Native HTML5 / HLS direct stream player (`src/components/player-view.tsx`).
  - **Native Windows Desktop**: Borderless cinema window (`ReelOS.exe`) compiled transparently via official Microsoft `csc.exe` with dynamic non-destructive port hunting (8080 $\rightarrow$ 8081 $\rightarrow$ 8082).
- **Third-Party App Shim**: A lightweight (~20KB) zero-overhead REST protocol shim (`jellyfin-shim-service.mjs`) is provided *only* to allow legacy third-party players (Swiftfin on Apple TV, Infuse) to connect if desired, backed directly by ReelOS's neural catalog.

### 3. Content Sourcing & Strict Zero-P2P ISP Shield
- **Strict Zero-P2P ISP Shield**: ReelOS **NEVER** initiates peer-to-peer torrent connections from the household IP address.
- **One-Debrid Policy**: TorBox is the sole officially supported cloud provider. Public indexers (`1337x`, `yts`, `eztv`, `knaben`, `tpb`) are used strictly to scrape magnet hashes that are handed directly to TorBox cloud servers for encrypted HTTPS playback.
- **Autonomous Neural Indexer Self-Repair**: Monitors latency and Cloudflare blocks across public mirrors, auto-rotating to healthy mirrors with zero user intervention.
- **Offline Public Domain Grace**: If no key is configured or the network drops, ReelOS gracefully serves verified public domain cinema classics (*Night of the Living Dead*, *Charade*, *His Girl Friday*) with zero blocking nag modals.

### 4. Form-Factor Specialization & The Second-Screen Freedom Law
- **TV is Sacred Cinema**: The TV interface is 100% movies and TV series. Zero reading apps, zero EPUBs, zero clutter.
- **Books on Phones & Tablets**: Books and personal reading are a primary feature of handheld devices, kept in a personal drawer.
- **User-Directed 2nd Screen**: When a movie plays on TV, the phone is **never forcefully hijacked**. Users choose their behavior: Companion mode (actor trivia, scene synopsis, zero-spoiler recaps), Remote Control mode, or independent browsing/reading.

### 5. Invisible Magic Standard
- **Zero-AI Perception**: No user should ever know they are interacting with AI. The words *"AI"*, *"Neural"*, *"Model"*, and sparkle icons are strictly forbidden from all consumer screens. All telemetry is quarantined inside a hidden 7-tap Developer Cockpit.

---

## 🔴 THE GRAVEYARD (What is Permanently Dead & Obsolete)

If an agent proposes, writes code for, or references any of the following items as active systems, **the agent is hallucinating and in violation of project reality**:

1. ❌ **Jellyfin Media Server as a Daemon is DEAD**:
   - We do not run the Jellyfin container, we do not require `.NET`, we do not rely on port 8096 for our core player, and we do not configure Jellyfin libraries.
   - Any reference stating *"ReelOS is not a player, Jellyfin is the working path"* is an ancient prototype artifact from early September and is **completely false**.
2. ❌ **The `*arr` Stack (Sonarr, Radarr, Prowlarr, Lidarr) is DEAD**:
   - ReelOS does not run or depend on Sonarr, Radarr, or Prowlarr.
   - Ingestion, scraping, release parsing, and library organization are handled natively by ReelOS services (`debrid-service.mjs`, `curation-engine.mjs`, `neural-indexer-repair.mjs`).
3. ❌ **Docker Compose Runtime is DEAD**:
   - ReelOS does not require Docker or Docker Compose for standard operation.
   - The appliance runs natively as a lightweight, zero-VM Node.js/Wasm process (`reelos-box`).
4. ❌ **Tron Chrome UI is DEAD**:
   - Scrapped in early September. Gold / velvet dark cinema design system is the only shipping chrome.
5. ❌ **Killing Foreign User Processes is FORBIDDEN**:
   - ReelOS never kills Photoshop, Lightroom, Steam, or foreign PIDs. It dynamically hunts open ports safely.
6. ❌ **Mock / Fake Catalogs are DEAD**:
   - All library data represents real public domain media or live TorBox debrid streams.

---

## 📁 Repository Map & Reality Filing Index

| Directory / File | Reality & Purpose |
| :--- | :--- |
| **`scripts/services/`** | **Active Core Services**: Machine classifier, neural scale engine, debrid service, console sentinel, companion service, polite scheduler, HDD guardian. |
| **`src/components/`** | **Active Web & PWA Client UI**: Mindful concierge wizard (Hand-holding spectrum), 30s taste primer, Velvet cinema player, 10-foot Couch mode, settings, hidden 7-tap developer cockpit. |
| **`clients/android/`** | **Active Native Android Client**: ExoPlayer 1.3.1 native player, foldable posture split, subnet LAN sweep, and Android TV 10-foot UI. |
| **`src/installer/`** | **Active Windows Desktop App**: Transparent C# wrapper (`ReelOS-Desktop.cs`) compiled via Microsoft `csc.exe` into `ReelOS.exe` with dynamic port hunting. |
| **`docs/THE-LAWS-OF-REELOS.md`** | **The Canonical Seven Inviolable Laws**: Permanent governing product laws signed by Austin. |
| **`docs/archive/legacy/`** | **Quarantined Docker & *Arr Stack**: Retired legacy container compose files preserved as inert archives. |
| **`docs/archive/historical/`** | **Quarantined Historical Archives**: Early transcripts (Sept 8–11) preserved purely for historical curiosity. NOT active architecture. |

---

*Keep ReelOS grounded. Build the magic.*
