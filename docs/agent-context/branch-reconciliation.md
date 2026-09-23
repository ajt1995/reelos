# Current branch reconciliation

Reviewed 2026-09-23. Replace this report when integration advances; do not append a diary.

Current implementation authority: the owner-approved native completion plan supersedes this audit's earlier C# Windows split, unsettled Books-on-TV decision and final-only HP testing restriction. Use shared Kotlin/Compose, exclude Books on TV, forbid learning exports beyond Home, and allow non-destructive isolated four-device feasibility checks. The findings below remain evidence of the preserved incoming branch, not current toolkit decisions. Integration begins from 532ccee on work/codex-native-core-2026-09-23; no whole-branch import.

Base: `428978a`. Incoming: `origin/work/antigravity-foundation-2026-09-22` at `c404416` (implementation `23be08d`). Native-platform contract: `5f039fd` on `work/codex-cleanup-2026-09-22`. Findings below are source inspection, not device certification. No application code was merged or deployed during this review.

## Recovered decisions and provenance

- Incoming `AGENTS.md` explicitly requires full standalone peer nodes, native Android/Desktop with iOS-only browser fallback, native Android Compose/Media3, hardware-friendly TV gradients, and provider-neutral core language. Earlier statements that this branch lacked the no-browser decision were incorrect: the decision exists in AGENTS but was not propagated to active-decisions or packaging.
- Owner confirmed here: a phone can manage another household computer's storage budget and preparation preferences. Preserve this feature with household-manager authorization and target-device acknowledgment. Do not restrict it to self-device changes.
- Incoming implementation adds charging/unmetered preparation controls, per-device quotas, background channels with separate progress, foldable layouts, and four proposed intelligence capabilities. Preserve these as candidate work; code and comments alone do not prove every default or behavior was approved.
- Incoming AGENTS additionally specifies Debian 12 minimal, display startup on boot, Books on every display, and pooled RAM transcoding. Retain this provenance for reconciliation: Books-on-TV conflicts with the current feature register, macOS remains parked, and compute eligibility must still be measured. These are not silently promoted to approved scope.
- The two branches share a base. Incoming changes cover 182 files, including generated web output. Select source changes by dependency, exclude stale generated artifacts, and rebuild only after integration.

## Coverage and evidence

Incoming acceptance retains all 19 feature-group IDs and all 47 interface requirement IDs, with unchanged required-evidence types. It clears old evidence and marks every entry missing. This preserves scope and avoids carrying stale passes forward. The prior 6 verified groups / 11 verified UI statuses are not proof for changed code.

The incoming workstream names checkpoint `2737a22`, which is not the fetched branch tip. Use the actual commits above. The canonical workstream's obsolete statement that no remote exists must also be removed.

## Integration findings

| Area | Source evidence | Required disposition |
| --- | --- | --- |
| Native Android | Incoming MainActivity/TvMainActivity extend ComponentActivity and render Compose; new onboarding, bubbles, waterfall, foldable and Media3 work | Reuse after building and testing; keep approved visual direction. |
| False media | Incoming TvMainActivity SAMPLE_CATALOG labels unrelated sample streams as The Dark Knight/The Bear and asserts unmeasured media capabilities; mobile uses three sample films plus local files | Remove production fixtures; use canonical metadata/source authority, with truthful empty/unavailable states. Metadata-only taste titles remain allowed. |
| Browser packaging | Android preBuild still invokes build-android-shared-ui and includes WebKit/SharedReelOsActivity. Windows launches Chrome/Edge; Linux kiosk launches Chromium | Remove Android web dependency after native journey replacement; Windows/Linux native renderer remains an unresolved implementation requirement. |
| Profile isolation | AppPreferences stores one resident_taste_vector_json regardless of activeResidentId | Key taste and reactions by profile, test restart and A/B switches; do not silently assign an already-mixed vector to a resident. |
| Remote device control | Gate service permits selfPolicyUpdate for any paired device and accepts body.id targeting another device | Keep cross-device control. Require the acting resident's management authority for remote targets; test owner success and guest/child rejection. |
| Inference truth | shipping-intelligence-specialists sets enhanced=true on FNV hashing; executor diff adds descriptors, not model adapters | Keep useful hashed baselines labeled fallback. Real inference needs an actual adapter/artifact, trace and evaluation. Registration is not inference. |
| Real learning to retain | neural-engine contains SGD user/item learning and LinUCB, with incoming incremental inverse maintenance | Validate numerical stability, per-profile persistence and integration. These are legitimate statistical learning methods; they do not imply an LM or scene model exists. |
| Android analysis | MobileNeuralEngine hashes text and updates centroids; FoldingWorker normalizes an existing vector | Reuse as baseline math, do not describe it as trained NPU inference or fresh scene learning. Connect all phone/TV reaction paths consistently. |
| Ambient playback | New AmbientPlaybackService has no production reference outside its own file; tests inspect internal flags | Wire playback/progress to session mode and canonical source authorization; test background progress isolation, promotion and actual channel transition. |
| Shared memory budget | Static cache grows to a 256MiB floor/4GiB cap; transcode and prewarm caches independently grow up to 2GiB each | Use one measured budget with playback priority, pressure reclamation and protected free space; independent ceilings cannot establish safe aggregate use. |
| New capability IDs | Scheduler, in-flight distillation, ambient governor and cache prediction add coordinator/fallback entries | Keep lifecycle honest; in-flight fallback extracts nothing and predictive cache fallback approves no preparation. Require real inputs, execution and outcome evidence before promotion. |
| Test changes | Many tests expand, but hardware-probe tests remove OTA ordering assertions | Review each changed expectation; retain or replace meaningful checks. Source regex assertions cannot certify device behavior. |

## Next execution slices

1. Establish an isolated integration branch from the common base with current decisions applied. Preserve both source branches. Reconcile feature mapping before importing implementation hunks; record retained, repaired and deferred changes.
2. Integrate Android native components with canonical catalog/source contracts. Remove fake streams and browser packaging, fix profile isolation, and verify standalone startup, taste-to-Home and real playback on phone and TV.
3. Integrate remote storage policy with explicit household-manager authorization, target identity and applied/pending state. Test authorized phone-to-computer changes, denied guest/child changes, offline targets and playback-safe budget reduction.
4. Integrate and evaluate useful SGD/LinUCB changes; restore honest fallback labels. Wire ambient sessions and shared resource budgeting before enabling new background workloads. Neural adapters require real runtime evidence and the existing privacy boundary.
5. Implement the confirmed C# native Windows and Kotlin/Compose Android direction over shared behavior and engine contracts. Select Linux native presentation after a bounded feasibility check. Reuse approved visuals. Current Android-only screens and desktop browser launchers do not establish full platform parity.
6. Run targeted tests per slice, then native device journeys and release gates. Refresh all 19/47 evidence records only from actual runs; no UI or release claims based on registered routes alone.

## Worker policy

Lead owns architecture, integration and final verification. Use Sol for bounded implementation/review and Luna for mechanical inventories when slots permit. Supply only relevant files and decisions; avoid full chat forks. Keep edit ownership disjoint, verify worker findings centrally, and use deterministic scripts for routine checks. This review used two Sol workers and local inventory; the third worker could not start due to the environment thread limit.

## Owner decision list received

The owner supplied seven decision groups on 2026-09-23: branch/stop workflow, full-node parity and unified onboarding, native UI/toolkits and TV legibility, real ML/512D embeddings, four physical acceptance targets, provider neutrality, and audits/persona retirement. They are now reconciled in `owner-requirements.md`, active decisions, agent entrypoints and feature acceptance text. This supersedes the earlier pending request for that list. C# on Windows is settled; Linux native toolkit, Books-on-TV and exact cache/charging defaults remain unsettled. No generated legal assertion is promoted to legal certainty.
