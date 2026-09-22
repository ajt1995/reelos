# ReelOS Future Horizons: Formal Engineering Tickets & Roadmap

> **Status**: FILED & ARCHIVED FOR NEXT CYCLE  
> **Origin**: Forensic Context Audit across all 125 historical conversations (Sept 13–16, 2026)  
> **Target Release**: ReelOS Post-1.5 / v2.0 Next Horizon  

---

## 📋 Ticket Summary Table

| Ticket ID | Priority | Category | Title | Origin Thread |
| :--- | :--- | :--- | :--- | :--- |
| **REEL-001** | **P1 (High)** | Streaming / Video | Scraped Live TV & Sports Feeds Engine (IPTV + Events) | `f6e6d940`, `61254e6a` |
| **REEL-002** | **P1 (High)** | Social / Networking | True WebSocket Synchronized WatchParty (`/party`) | `febc2e71` |
| **REEL-003** | **P2 (Medium)** | Infrastructure / LAN | Multi-Node LAN Compute Satellite Mesh ("Downstairs HP") | `c5027cb8`, `c11dd108` |
| **REEL-004** | **P1 (High)** | macOS / Platform | Native Apple Silicon macOS Appliance (Zero-VM) | Austin Vision Guidance |
| **REEL-005** | **P2 (Medium)** | Hardware / Installer | Embedded Sector-Level Raw USB ISO Flasher | `9ffc00c4`, `01a8976b` |
| **REEL-006** | **P3 (Creative)** | Marketing / Media | Authentic Real-UI 45-Second Cinematic Teaser Video | `6d4d1ebc` |
| **REEL-007** | **P1 (High)** | Storage / Filesystem | Multi-Tier Storage Pools & Autonomous AI LRU Eviction (<10%) | Austin Vision Guidance |
| **REEL-008** | **P1 (High)** | Networking / QoS | Dynamic Console QoS Video Chunk Pacing & Bitrate Smoothing | Austin Vision Guidance |
| **REEL-009** | **P1 (High)** | Remote Access | Silent Headless Ephemeral Auth Keys for Tailscale MagicDNS | Austin Vision Guidance |

---

### [REEL-001] Scraped Live TV & Sports Feeds Engine
* **Type**: Feature Request
* **Status**: Backlog (Ready for Grooming)
* **Context**:
  > *"How hard would implementing live tv and DVR be? obviously im looking for piracy... build a plugin that brings in live tv from all sources including sports... assume the user has torbox or real-debrid."*
* **Problem**:
  ReelOS completely solves movies and on-demand TV series through high-speed encrypted Debrid pipes. However, household members who watch live sports (NFL, NBA, Premier League, UFC PPV) or broadcast news are still forced to maintain a cable or live TV subscription ($80+/month).
* **Technical Scope**:
  1. Build `scripts/services/livetv-service.mjs` supporting:
     - Scraped live event indexers (DaddyLive, StreamEast, Sportsurge, TVApp).
     - Free legal broadcast streams (Pluto TV, Tubi TV, PBS M3U8 IPTV feeds).
  2. Implement an ultra-clean EPG (Electronic Program Guide) grid in React (`src/components/livetv-guide.tsx`) using virtualization.
  3. Integrate live HLS/M3U8 player with low-latency buffer tuning and DVR-lite live pausing.
* **Acceptance Criteria**:
  - Live TV tab in navigation bar.
  - Zero-configuration auto-fetching of active sports event streams on game days.
  - Failover to alternative mirror within 2 seconds if a stream disconnects.

---

### [REEL-002] True WebSocket Synchronized WatchParty (`/party`)
* **Type**: Feature Request
* **Status**: Backlog (Design Phase)
* **Context**:
  > *"maybe the party features are grouped together... watch party"*
* **Current Gap**:
  Currently, navigating to `/party` redirects to FlickMatch. True synchronized playback between remote family members is not yet built.
* **Problem**:
  Family members away at college or on military deployment want to watch movies simultaneously with their family back home.
* **Technical Scope**:
  1. Implement WebSocket room server in `scripts/services/watchparty-service.mjs`.
  2. Client-side clock synchronization using NTP-style round-trip ping time calculation to eliminate audio/video drift.
  3. Synchronized actions: `PLAY`, `PAUSE`, `SEEK` broadcasted to all room participants with a threshold of $\pm 250\text{ms}$.
  4. Floating ambient reactions (confetti, heart, laugh, gasp) overlaying the video player without obscuring subtitles.
* **Acceptance Criteria**:
  - Room host creates a 4-letter room code (e.g. `WARP`).
  - Remote participants join via unguessable Tailscale link or local LAN.
  - When Host pauses, all participants pause instantaneously.
  - Full end-to-end unit tests simulating network jitter and sync correction.

---

### [REEL-003] Multi-Node LAN Compute Satellite Mesh ("The Downstairs HP Server")
* **Type**: Enhancement / Architecture
* **Status**: Backlog (Prototyped)
* **Context**:
  > *"how many VMs are actually existing now?? i have one i know of on here and the actual HP downstairs. can they be utilized better to speed us along?"*
* **Problem**:
  Users often run ReelOS on a primary low-power "Potato" appliance (Intel Celeron, vintage laptop, 4GB RAM) in the living room, but have a more powerful secondary PC or laptop sitting idle on the home network.
* **Technical Scope**:
  1. Build a zero-configuration mDNS / SSDP broadcast service: `scripts/services/satellite-mesh-service.mjs`.
  2. The primary appliance discovers secondary nodes running `reelos-satellite.mjs`.
  3. Work-stealing scheduler:
     - Heavy background subtitle alignment (Bazarr).
     - Full-library TMDB metadata scraping.
     - Remote family 4K-to-720p transcoding jobs.
  4. Automatically offloads jobs to the satellite and receives stream bytes over local gigabit LAN.
* **Acceptance Criteria**:
  - Primary box CPU stays $< 10\%$ during high-load indexing.
  - If the downstairs laptop lid is closed or powered off, jobs silently fall back to the local box without crashing.

---

### [REEL-004] Native Apple Silicon macOS Appliance (Zero-VM)
* **Type**: Feature / Platform Support
* **Status**: Corrected (Zero-VM Native Architecture)
* **Context**:
  > *"macOS was going to be native"*
  - Prior agent's proposal of a 2GB Virtualization.framework/UTM VM was an agent hallucination violating the Zero-VM Law. ReelOS on macOS is 100% native.
* **Problem**:
  Modern households often use an M1/M2/M3 Mac Mini or MacBook as an always-on home server or desktop. Running ReelOS must be as native, turnkey, and lightweight as `ReelOS.exe` on Windows—consuming <100MB RAM, not gigabytes inside a VM.
* **Technical Scope**:
  1. Create a native macOS bundle: `install/mac/ReelOS-Mac.app` containing a native Swift menu bar controller and embedded Darwin Node.js runtime.
  2. Zero hypervisors, zero VMs. Runs natively on macOS Darwin arm64 with direct POSIX filesystem access, native APFS storage, and VideoToolbox/Metal acceleration.
  3. Menu bar status item with safe non-destructive port hunting (8080..8150), 1-click browser launcher, and launchd background daemon lifecycle.
  4. Native macOS resource yielding: detects resource-heavy apps (Final Cut Pro, Logic, Blender, Xcode) and drops memory footprint to <4MB.
* **Acceptance Criteria**:
  - Drag-and-drop `.dmg` installation for macOS Sonoma / Sequoia.
  - Zero VM overhead: background memory footprint <100MB on Apple Silicon (idle CPU <0.5%).
  - Launches into default browser with native port hunting.


---

### [REEL-005] Embedded Sector-Level Raw USB ISO Flasher
* **Type**: Feature / Hardware
* **Status**: Backlog (Partial Implementation in `reelos-usb-creator.mjs`)
* **Context**:
  > *"The windows exe should offer the users the option to install directly in the VM or flash the drive... directly in the app."*
* **Current Gap**:
  Current USB creator sets up a FAT32 installation payload with answers pre-baked, but creating a raw bootable Linux live disk requires external tools like Rufus or balenaEtcher.
* **Technical Scope**:
  1. Enhance `src/installer/ReelOS-Desktop.cs` with raw disk block writing via Win32 API (`CreateFile`, `DeviceIoControl`, `WriteFile` with `GENERIC_WRITE` and `FSCTL_LOCK_VOLUME`).
  2. Stream raw `.iso` image sector-by-sector with visual progress bar in the desktop window.
  3. Auto-inject `answers.json` and Tailscale authentication credentials into the target FAT32 persistent partition post-flash.
* **Acceptance Criteria**:
  - Non-technical users can create a bootable live ReelOS USB thumb stick without downloading Rufus.
  - Safe drive filtering prevents accidental overwriting of internal Windows system drives (`C:`).

---

### [REEL-006] Authentic Real-UI 45-Second Cinematic Teaser Video
* **Type**: Creative / Showcase
* **Status**: **VOLUNTARILY SCRAPPED BY USER** (Ledger Section 15)
* **Context**:
  > Austin explicitly directed: *"Scrap the video (commercials) entirely"*. ReelOS is a sovereign cinema OS, not an advertising or promotional vehicle. Mainstream viewers experience the real UI directly with zero commercial clutter.
* **Resolution**: Permanently pruned from launch requirements and codebase wiring. Video assets removed from repository.

---

### [REEL-007] Multi-Tier Storage Pools & Autonomous AI LRU Eviction (<10%)
* **Type**: Feature / Architecture
* **Status**: Backlog (Ready for Implementation)
* **Context**:
  > *"Let users choose how much disk to use and where. Everything from flash drives to server racks, let the AI decide how to handle it"*
* **Problem**:
  Users want flexibility in media storage: some want to plug in a 128GB USB flash drive into their potato box; others have multi-terabyte network storage arrays or server racks. The system must autonomously manage placement and eviction without manual file management.
* **Technical Scope**:
  1. Expand `scripts/services/storage-service.mjs` with multi-path pool registration.
  2. Implement background autonomous disk watchdog: if free storage drops below 10%, execute silent LRU eviction of watched/completed media while protecting in-progress downloads.
  3. UI in settings allowing users to designate custom storage paths and headroom caps.
* **Acceptance Criteria**:
  - Dynamic detection of external drives and mount points.
  - Zero disk-full crashes: automated eviction triggers at exactly 10% remaining threshold.

---

### [REEL-008] Dynamic Console QoS Video Chunk Pacing & Bitrate Smoothing
* **Type**: Feature / Network
* **Status**: Backlog (Ready for Implementation)
* **Context**:
  > *"Smooth out the network and preserve playing, even if it means smoothly transcoding (depending on hardware) or lowering video quality."*
* **Problem**:
  When a console gamer starts an intensive online multiplayer match, existing bufferbloat mitigation only pauses background downloads. If someone is watching 4K on TV, the network can still experience packet congestion.
* **Technical Scope**:
  1. Enhance `console-sentinel.mjs` to emit fine-grained network pressure levels (`NORMAL`, `PACED`, `CRITICAL`).
  2. Stream server (`neural-stream-server.mjs`) responds by pacing HTTP chunk responses or signaling the client player to smoothly step down to 1080p/720p.
* **Acceptance Criteria**:
  - Gaming gateway ping returns to baseline (<15ms variance) within 3 seconds of QoS activation.
  - Video stream continues playback smoothly without freezing or playback errors.

---

### [REEL-009] Silent Headless Ephemeral Auth Keys for Tailscale MagicDNS
* **Type**: Feature / Security & Onboarding
* **Status**: Backlog (Ready for Implementation)
* **Context**:
  > *"5 section 1 is supposed to be an anymized tailscale address so it works off network and cannot be guessed"*
* **Problem**:
  Using raw LAN IP addresses in QR codes and companion discovery exposes local subnet structure and fails when devices leave the home network.
* **Technical Scope**:
  1. Wire silent ephemeral auth key exchange into `scripts/services/network-service.mjs`.
  2. Generate randomized, guess-proof MagicDNS aliases (`https://reel-<hash>.ts.net`).
  3. Replace all LAN IP hardcodes in TV QR codes and client discovery with the anonymized MagicDNS domain.
* **Acceptance Criteria**:
  - Out-of-the-box off-network pairing with zero user credential entry, upholding the Invisible Magic standard.

