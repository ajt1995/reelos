# The Seven Inviolable Laws of ReelOS

**Author**: ReelOS Core (`reelos-org`) & Antigravity (Google DeepMind Pair)  
**Status**: Canonical & Inviolable  
**Enacted**: September 17, 2026 (Milestone v1.6.0)  

---

## 🏛️ Preamble
ReelOS is a sovereign personal cinema operating system and home media appliance. It is not a generic piracy script, not an AI playground, not a bloated media server, and not a developer tinker-toy. 

The purpose of ReelOS is singular: **A title plays in 4K HDR on the living room TV with zero buffering, zero subscriptions, zero technical jargon, and zero user maintenance.**

Every pull request, every line of code, and every future agent must adhere strictly to these Seven Inviolable Laws.

---

## Law 1: The Hardware & Memory Allocation Law
> *"Dedicated machines should ALWAYS use 100% of the RAM for AI agents. Yielding only applies to PCs that are otherwise used. If the system detects anything it did not itself execute, it is clearly not a dedicated machine."*

1. **Autonomous Machine Classification**:
   - The host system continuously inspects running processes (`tasklist` on Windows, `ps` on Linux).
   - If any foreign user applications exist (e.g., Photoshop, Lightroom, Premiere, Blender, Steam, Discord, Chrome), the machine is classified as a **Shared Workstation**. It must politely yield CPU priority, contract memory footprint to $<4\text{MB}$, and never interfere with foreground user tasks.
   - If only ReelOS binaries, OS kernel daemons, and developer containers exist, the machine is classified as a **Dedicated Appliance**.
2. **Tiered Dedicated Allocation**:
   - **Low-Spec Appliances ($<6\text{GB}$ RAM / Potatoes)**: The system protects a **1GB safety ceiling** reserved exclusively for Jellyfin direct playback, FUSE streaming buffers, and OS responsiveness, assigning all remaining memory ($\sim 2.7\text{GB}+$) to background intelligence and manifolds.
   - **Full-Scale Appliances ($\ge 8\text{GB}$ RAM)**: The system allocates **100% of physical RAM headroom** ($\text{Total RAM} - 256\text{MB}$ OS baseline) directly to background graph synthesis and vector embeddings.
3. **Console Ping Shield**:
   - LAN console gaming packet pacing remains active on all machines: if a PlayStation, Xbox, or Nintendo Switch initiates gaming traffic, network heavy lifting yields immediately to prevent latency spikes, while 100% of AI memory remains completely untouched.

---

## Law 2: The Invisible Magic Law
> *"No user should ever know they are interacting with AI."*

1. **Zero-AI User Perception**:
   - The words *"AI"*, *"Artificial Intelligence"*, *"Machine Learning"*, *"Neural"*, *"Vectors"*, *"Bandits"*, and *"Model"* are strictly forbidden from all consumer-facing screens and standard settings.
   - The system must feel like **pure magic** curated by a legendary Criterion film archivist, not like a chatbot glued to a video player.
2. **Cinematic Vocabulary**:
   - Features must use warm, human cinematic language: *Curator’s Cut*, *The House Vault*, *Companion Notes*, *Taste Calibration*, *Living Room Resonance*.
3. **No AI Visual Cues**:
   - Zero sparkle icons (`✨`), zero robot avatars, and zero generic "Generating..." spinners. Transitions must use subtle cinema ambient cues (film reel pulse, velvet gold glow).
4. **Criterion Standard for Companion Notes**:
   - All character dossiers, scene trivia, and "Story So Far" recaps must read like passionate, spoiler-shielded film criticism penned by an expert human cinephile.
5. **Developer Quarantine & Fleet App Isolation**:
   - All raw engine telemetry, embedding dimensions, memory budgets, and process logs are banished to a hidden **7-tap Developer Cockpit** or CLI debug flags. Everyday household viewers never see raw internals.
   - **Standalone Fleet Admin App**: Dedicated telemetry visualizers and multi-box orchestrators (such as `ReelOS Fleet` APK) must remain strictly standalone apps for the appliance owner, keeping mainstream consumers completely insulated.

---

## Law 3: Honest Sources & Private Home Policy
> *"A title can teach taste without pretending it is ready to play."*

1. **No household P2P client**:
   - The release runtime must not initiate or seed peer-to-peer transfers from a household device. This is a release requirement to verify—not a legal guarantee or marketing claim.
2. **Public and personal media first**:
   - Verified public-domain media and a person's own library work without a provider. Catalog information can be discoverable without being presented as playable.
3. **Optional provider gateway**:
   - TorBox and Real-Debrid are optional, provider-neutral connections. A provider key is validated server-side before provider-backed actions appear; disabling it removes provider-only Library projections without removing personal files, taste, or history.
4. **Optional owner connections**:
   - Public catalogs may be pre-wired. Any owner indexer connection is a manual advanced configuration outside the public bundle. Private presets, keys, bypasses, and provider credentials are never distributed in a consumer release.
5. **Offline public-domain grace**:
   - If no provider is connected or the network is unavailable, ReelOS keeps the verified public-domain and personal-library experience usable without a coercive setup wall.

---

## Law 4: Media Scope & Form-Factor Specialization Law
> *"The books are a main feature of the app for phones, but TV interfaces should be different."*

1. **The Living Room TV is Sacred Cinema**:
   - The 10-foot Couch UI (Android TV, Apple TV, living room display) is dedicated 100% to Movies and Television Series.
   - Books, EPUBs, and reading interfaces are **strictly prohibited** from the TV UI. Nobody reads books from 10 feet away with a remote control.
2. **Personal Handheld Glass (Phones & Tablets)**:
   - Books and personal reading are first-class, primary features on mobile and tablet form factors.
   - The handheld client is a multi-media personal companion: taste calibration, personal reading, library browsing, remote control, and companion second-screen trivia.
3. **Modular Expansion**:
   - Non-cinema media (Books via Kavita, Music) never clutters the primary cinema shelf.

---

## Law 5: The Second-Screen Freedom Law
> *"Let users choose their 2nd screen behavior."*

1. **No Forced Hijacking**:
   - When a movie plays on the TV, the phone must **never** be forcefully hijacked into a second-screen view without the viewer's consent.
2. **User-Directed Companion Modes**:
   - The user chooses their handheld posture:
     - **Companion Mode**: Live actor identification, scene synopsis, zero-spoiler story recap.
     - **Remote Control Mode**: Audio track switching, subtitle sync, playback controls.
     - **Independent Browsing**: Reading a book or discovering the next movie while the TV plays uninterrupted.
3. **Instant Cross-Device Handoff**:
   - 1-tap handoff allows picking up a stream on the TV where it paused on the phone, or vice-versa.

---

## Law 6: Living Room Taste & Household Governance Law
> *"Household consensus in the living room; personal purity on the phone."*

1. **Household Consensus Profile**:
   - The living room TV operates under a shared *Household Cinema* profile that dynamically blends household preferences without corrupting individual personal ratings.
   - Individual phones maintain distinct, sovereign taste profiles.
2. **FlickMatch Party Showdown**:
   - Group decision paralysis is solved through a 45-second party showdown: participants swipe on their own phones, and ReelOS surfaces the exact mathematical intersection of titles everyone loves.
3. **Kid-Safe Sanctuary**:
   - A 1-tap Kid profile strictly locks content to PG/G boundaries with zero PIN friction for children.
4. **Zero-Judgment Guarantee**:
   - The system never exposes, broadcasts, or shames guilty pleasures or private watch habits onto shared family screens.

---

## Law 7: The Autonomy & Zero-Debugger Law
> *"The owner is not the debugger. ReelOS heals itself."*

1. **Autonomous Self-Healing**:
   - ReelOS must resolve its own runtime faults in the background with zero user intervention:
     - If an indexer mirror dies or gets Cloudflare-blocked $\rightarrow$ auto-rotate to healthy mirrors.
     - If TorBox returns HTTP 429 $\rightarrow$ token-bucket queue with exponential backoff.
     - If storage fills $\rightarrow$ auto-evict finished buffer while preserving the 2-episode forward window.
     - If an appliance update fails health checks $\rightarrow$ auto-rollback to the previous working partition via A/B bootloader watchdog.
2. **Silent Background Operation**:
   - Fault recovery occurs silently. Never vomit Docker logs, Python tracebacks, or systemd stack dumps onto the living room TV.
   - Status indicators are discrete and subtle, tucked into the hidden developer cockpit.
3. **Safe Process & Port Protection**:
   - Never terminate, kill, or interfere with foreign user processes (Photoshop, Steam, games).
   - If a default port (8080) is occupied by a foreign application, ReelOS hunts non-destructively for the next open port (8081, 8082) and dynamically updates its UI bindings.
4. **Definition of Done**:
   - A task is never "done" because a test passed or a version bumped.
   - **Done means a title plays in pristine quality on the living room TV.**
