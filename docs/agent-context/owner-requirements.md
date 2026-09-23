# Owner requirements — reconciled 2026-09-23

This compact record incorporates the owner's seven-part decision list supplied directly in the Codex conversation, plus the explicitly confirmed remote storage feature. Replace superseded requirements in place. It describes required behavior, not completed implementation.

## Workflow

- Develop only on registered workstream/feature branches; never commit directly to main/master. Central integration reviews and validates each worker's changes.
- On an owner stop request, stop active test loops promptly, checkpoint attributable work, push the workstream, and yield. Never include secrets or unrelated changes in that checkpoint; report a blocked push honestly.
- Audit neural systems, UI contracts and feature coverage before modifying critical foundations. Reuse current evidence only when its source revision and affected boundaries still match; rerun invalidated checks.
- Retire the old Gwen persona. Owner instructions and repository requirements govern intent; source and measured tests establish implementation truth.

## Product and presentation

- One canonical codebase and full standalone ReelOS on Windows, Linux appliance, Android phone/tablet and Android TV. Home membership adds peer services; it does not unlock core product functionality.
- One onboarding sequence across platforms: identity, ambiance/personal atmosphere, curator guidance, taste constellation, and mesh topology. Preserve existing required source/access steps and optional joining of a Home. Fresh nodes cannot enter the cinema stage before onboarding; completed nodes resume without repeating it. Layout and input adapt to the device.
- Android/TV use Kotlin and Jetpack Compose with native media playback. Windows uses C# native presentation. Linux must use a native presentation layer; toolkit selection is not settled by this list. Consumer applications on these platforms cannot use browser/WebView wrappers. iOS alone may use browser/PWA presentation.
- Preserve approved Home, falling artwork, breathing personal color, endless taste bubbles and Family direction. On TV use hardware-friendly pre-blended radial gradients rather than large multipass/software blur. D-pad focus stays stationary and highly legible, including dark text on light selected surfaces.
- An authorized household manager can use their phone to adjust another computer/device's storage budget and preparation preferences. Keep target identity, acknowledged state, offline/pending feedback and hard device safety limits.

## ML requirements

- Production embeddings are genuine learned 512-dimensional Float32 representations, with model identity/version, provenance and measured usefulness. Padding, arbitrary hashes or tiny fixtures do not satisfy this requirement.
- Label deterministic fallbacks truthfully. Regex may parse explicit filters but cannot count as learned semantic retrieval. Test fixtures remain test-only and never become production catalog, learned vectors or acceptance evidence.
- Use mathematically valid updates for the algorithm in use. Sherman–Morrison rank-one inverse updates apply to the relevant bandit/covariance matrix, such as LinUCB; they are not a generic update rule for every embedding or neural model. Validate incremental updates against direct solutions, including long runs and ill-conditioned inputs.
- Validate profile isolation, persistence/restart, normalization where required, dimensional compatibility and semantic/ranking quality against a held-out baseline. Learned features and algorithm-specific state are distinct: a 5-dimensional bandit context is not a 512-dimensional media embedding.
- Models run through the shared local neural/event/feature architecture. Policy remains authoritative for credentials, permissions, child boundaries, deletion, updates and resource limits. Registration alone does not prove inference or learning.
- `/ml-best-practices` and `reelos-neural-manifold` were named by the owner but were not found in the available local skill roots or the fetched branch. These explicit repo rules persist independently; do not claim the missing skill contents were read or installed.

## Required physical acceptance targets

| Target | Owner-supplied identity | Verification required |
| --- | --- | --- |
| Windows workstation | 64GB; 192.168.1.214 | Verify current identity/resources and native install, onboarding, playback, yielding, update/recovery. |
| Living Room Onn 4K Pro | Android TV; 192.168.1.95:5555 | Verify device identity, native UI/motion, remote navigation, playback and update. |
| Samsung Galaxy Z Fold | USB serial R5GL64PC0CF | Verify serial/model, folded/unfolded layout, touch, standalone operation, Home sync and remote storage control. |
| HP appliance | Debian 12 Minimal; 192.168.1.234 | Verify actual OS/hardware and native appliance behavior; retain final-candidate-only/no-old-state installation boundary unless owner changes it. |

Addresses are expected locators, not authenticated identity or proof of availability. Unit tests and simulations supplement physical tests; they cannot certify the fleet. Previous wipe instructions do not identify a current disk for destruction.

## Source boundary

Core ships personal and public-domain sources with neutral adapter interfaces. Commercial debrid providers, WebDAV connections and owner sources are optional configured adapters. Commercial provider branding/presets do not enter the core distribution. Preserve private setup documentation without credentials; the boundary is an engineering requirement, not a guarantee about legal liability.

## Unsettled items

The supplied list does not settle Books-on-TV, Linux native toolkit, or exact charging/cache defaults found in generated branch code. macOS remains parked. Do not silently promote those implementation choices into owner decisions.
