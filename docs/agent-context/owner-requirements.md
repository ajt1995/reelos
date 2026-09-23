# Owner requirements — reconciled 2026-09-23

This compact record incorporates the owner's approved native completion/release plan of 2026-09-23, superseding the earlier platform split and cross-home learning policy. Replace superseded requirements in place. It describes required behavior, not completed implementation.

## Workflow

- Develop only on registered workstream/feature branches; never commit directly to main/master. Central integration reviews and validates each worker's changes.
- On an owner stop request, stop active test loops promptly, checkpoint attributable work, push the workstream, and yield. Never include secrets or unrelated changes in that checkpoint; report a blocked push honestly.
- Audit neural systems, UI contracts and feature coverage before modifying critical foundations. Reuse current evidence only when its source revision and affected boundaries still match; rerun invalidated checks.
- Retire the old Gwen persona. Owner instructions and repository requirements govern intent; source and measured tests establish implementation truth.

## Product and presentation

- One canonical codebase and full standalone ReelOS on Windows, Linux appliance, Android phone/tablet and Android TV. Home membership adds peer services; it does not unlock core product functionality.
- One onboarding sequence across platforms: identity, ambiance/personal atmosphere, curator guidance, taste constellation, and mesh topology. Preserve existing required source/access steps and optional joining of a Home. Fresh nodes cannot enter the cinema stage before onboarding; completed nodes resume without repeating it. Layout and input adapt to the device.
- Use one shared Kotlin engine and Compose UI for Windows, Linux, Android phone/tablet and TV. Platform adapters handle media, files, secure storage, background execution, networking and installation. Desktop bundles its managed runtime and renders natively, not in a browser. This supersedes the earlier C# Windows split. iOS alone may use browser/PWA presentation; macOS remains parked.
- Books is absent on TV. The HP appliance has a visible native interface by default; headless operation is explicit, not an accidental installation default.
- Preserve approved Home, falling artwork, breathing personal color, endless taste bubbles and Family direction. On TV use hardware-friendly pre-blended radial gradients rather than large multipass/software blur. D-pad focus stays stationary and highly legible, including dark text on light selected surfaces.
- An authorized household manager can use their phone to adjust another computer/device's storage budget and preparation preferences. Keep target identity, acknowledged state, offline/pending feedback and hard device safety limits.

## ML requirements

- Production embeddings are genuine learned 512-dimensional Float32 representations, with model identity/version, provenance and measured usefulness. Padding, arbitrary hashes or tiny fixtures do not satisfy this requirement.
- Label deterministic fallbacks truthfully. Regex may parse explicit filters but cannot count as learned semantic retrieval. Test fixtures remain test-only and never become production catalog, learned vectors or acceptance evidence.
- Use mathematically valid updates for the algorithm in use. Sherman–Morrison rank-one inverse updates apply to the relevant bandit/covariance matrix, such as LinUCB; they are not a generic update rule for every embedding or neural model. Validate incremental updates against direct solutions, including long runs and ill-conditioned inputs.
- Validate profile isolation, persistence/restart, normalization where required, dimensional compatibility and semantic/ranking quality against a held-out baseline. Learned features and algorithm-specific state are distinct: a 5-dimensional bandit context is not a 512-dimensional media embedding.
- Models run through the shared local neural/event/feature architecture. Policy remains authoritative for credentials, permissions, child boundaries, deletion, updates and resource limits. Registration alone does not prove inference or learning.
- No learning exports outside the Home, including anonymous taste exchanges. Network-isolated model workers receive bounded sanitized inputs and no credentials. Authorized Home sync and media/update network services remain separate. Do not call an internet-connected device physically air-gapped.
- `/ml-best-practices` and `reelos-neural-manifold` were named by the owner but were not found in the available local skill roots or the fetched branch. These explicit repo rules persist independently; do not claim the missing skill contents were read or installed.

## Required physical acceptance targets

| Target | Owner-supplied identity | Verification required |
| --- | --- | --- |
| Windows computer | LAPTOP-8J93FFJH; 15.8 GiB measured; 192.168.1.214 | Verify current identity/resources and native install, onboarding, playback, yielding, update/recovery. Earlier 64GB inventory was incorrect. |
| Living Room Onn 4K Pro | Android TV; 192.168.1.95:5555 | Verify device identity, native UI/motion, remote navigation, playback and update. |
| Samsung Galaxy Z Fold | USB serial R5GL64PC0CF | Verify serial/model, folded/unfolded layout, touch, standalone operation, Home sync and remote storage control. |
| HP appliance | 192.168.1.234; Ubuntu 26.04.1 x86_64, ~3.2 GiB RAM measured over authenticated SSH | Active Wayland desktop verified; prior Debian inventory was stale. Java/LibVLC installation awaits approval. Non-destructive isolated feasibility is approved; final installation imports no old state. Exact wipe scope still needs authorization. |

Addresses are expected locators, not authenticated identity or proof of availability. Unit tests and simulations supplement physical tests; they cannot certify the fleet. Previous wipe instructions do not identify a current disk for destruction.

## Source boundary

Core ships personal and public-domain sources with neutral adapter interfaces. Commercial debrid providers, WebDAV connections and owner sources are optional configured adapters. Commercial provider branding/presets do not enter the core distribution. Preserve private setup documentation without credentials; the boundary is an engineering requirement, not a guarantee about legal liability.

## Expanded behaviors and release gate

- Preserve Background TV channels, isolated ambient history/progress and Tune In; charging/unmetered overnight preparation; household compute and gaming/playback yielding; predictive caching; adaptive guidance; remote storage management with acknowledged/pending states; adaptive atmosphere.
- In-flight analysis reuses decode samples for edition-bound scene/audio/intro/credit evidence; it is not just making smaller files. Small predictors and shared encoders may serve multiple specialists. All 15 intended specialists need artifact/algorithm provenance, quality evidence and truthful lifecycle before promotion.
- A UI/UX specialist independently audits all 47 interface requirements before implementation and on installed native candidates afterward. Record reachability, clarity, full interaction states, accessibility, Fold posture, TV focus, visual consistency and retest evidence.
- Friend release requires 19/19 feature groups and 47/47 interface requirements with current acceptance evidence, no unsupported skips, and physical install/playback/update/recovery tests. A missing ordinary feature is not excused by an unavailable button. Existing shadow experiments remain explicitly non-authoritative until qualified.
- Both branches and existing household data are preserved. Non-destructive fleet verification is approved; any wipe, signing-identity replacement, public publication or unapproved model/tool download still requires the appropriate authorization.
