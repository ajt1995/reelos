# Current completion execution contract

Owner-approved 2026-09-23. Replace this file when the plan changes; it is not a work diary.
Read AGENTS.md and owner-requirements.md first. Git and generated evidence establish status.
This plan describes remaining required work, not completed behavior.

## Locked product and acceptance

One shared Kotlin engine and Compose native interface on Windows, Linux, Android phone/tablet
and Android TV. Every node works standalone; Home adds authorized synchronization and resources.
No browser/WebView consumer shell. Books is absent on TV. macOS, live TV/sports and fleet
administration stay parked. Preserve approved artwork, breathing color, transparency, endless
taste bubbles and Family design. No false catalog, semantic embeddings, readiness or progress.

Household movie-night playback is an intermediate checkpoint. Friend release still requires
19 active feature groups and 47 UI requirements, physical evidence on the Windows workstation,
Fold, Onn TV and HP, independent UX/security review, install/update/rollback/recovery, and no
unsupported skips. See feature-register.json and feature-acceptance.json for the exact IDs.
Unavailable experiments cannot excuse missing ordinary journeys.

Validated optional external sources are NOT blanket beta. Public-domain/personal defaults,
manual private owner sources and provider-neutral public distribution remain. Unverified
official app handoffs are individually experimental. No capture/relay of protected browser
streams. Model workers cannot access networks or credentials; no learning exports outside Home.

## Execution graph and ownership

Preservation/context/versioning -> shared contracts -> media/UI/intelligence workstreams ->
household playback checkpoint -> remaining native journeys and Home -> independent review ->
signed install/update/recovery candidate -> full friend-release gate.

Lead owns shared contracts, integration, decisions, evidence and device operation. Use at most
two implementation workers concurrently, disjoint isolated worktrees, and independent reviewers.
Workers return narrow tested commits. Use targeted local checks, compact results and cached tools.
After two failed repairs diagnose centrally. Never run desktop against mutable Gradle outputs
while compiling. Build immutable candidates. Do not make acceptance claims from unit/source tests.

## Dependency-complete work packages

| ID | Work | Dependencies | Completion evidence |
| --- | --- | --- | --- |
| A1 | Recoverable current-tree checkpoint; reviewed incoming source classification | none | Git checkpoint; no lost untracked implementation |
| A2 | Correct owner decisions, version identity, workstream ownership and public-repo boundary | A1 | Context checks, secret scan, remote commit verification |
| B1 | Canonical title/episode/edition/source/file identity and authority | A2 | Contract and negative authorization tests |
| B2 | Shared profile/state migrations, typed events/features/outcomes and bounded trace | A2 | Restart, atomicity, idempotency, profile isolation |
| C1 | Exact provider torrent/file lookup, positive readiness, pack episode selection, reacquisition | B1 | Regression tests plus live authorized bytes |
| C2 | Credential-revision validation, scoped caches, accurate provider errors and disable/revocation | B1 | Changed-key/account tests; no stale access |
| C3 | HTTPS/redirect destination safety and bounded playback leases | C1,C2 | SSRF, range, revocation and expiry tests |
| C4 | Native direct play, seek/resume, episodes, audio/subtitles, level/night listening and recovery | B2,C3 | Installed desktop/phone/TV/Linux media evidence |
| C5 | Verified remux/preparation/renditions, storage preferences and measured live-transcode fallback | C4 | Output verification; two 10-minute >=1.20x recipe runs; pressure yield |
| N1 | Reuse real SGD/LinUCB; genuine learned 512D spaces; bounded native numerical primitives | B2 | Numerical/reference, finite/dimension, snapshot and isolation tests |
| N2 | Connect persisted reactions/events to useful profile-private ranking and corrections | N1 | Native effects, reversible semantics, restart, held-out baseline |
| N3 | Real model adapters, signed/hash/provenance/ABI-qualified artifacts, worker isolation | B2 | Actual inference; DNS/socket/HTTP denial; no secret inputs |
| N4 | Connect all 15 specialist routes to shared coordinator/resource leases | C5,N2,N3 | Real inputs, guarded execution, outcome traces, usefulness |
| U1 | Native setup/profile/Family identity, Back/focus and continuous save | B2 | Native phone/Fold/TV/desktop journeys |
| U2 | Endless taste field, Home search/shelves/compact No Idea, personal atmosphere | U1,N2 | No reload/pagination/collision; per-profile first Home |
| U3 | Discover/search/people/collections/details with precise source-derived actions | U2,C4,N3 | Art-led browse and exact search; honest unavailable states |
| U4 | Player, Library/activity/travel, Books reader, settings/help | U3,C5 | Complete native controls and all failure/empty states |
| U5 | Family/Kids Present, companion/spoilers and parties | U1,C4,N4 | Escape prevention, edition/timebase, reconnect and profile privacy |
| H1 | Home membership, offline sync, leave/revoke, identity and management authority | B2 | Partitions/duplicates/conflicts; departed node denied |
| H2 | Phone-to-device storage changes with pending/delivered/applied acknowledgments | H1,C5 | Owner success; guest/child denied; offline state honest |
| H3 | Household compute, gaming/playback yielding, cancellation and standalone fallback | H1,N4 | Peer loss, bounded leases and no duplicate publication |
| H4 | Persistent Friends across separate Homes; explicit recommendations, shared watchlists and party invitations | B2,H1,U5 | Mutual identity/acceptance, remove/block/revoke, parent authority, offline/reconnect; each participant independently authorizes their own media; no private learning/history export |
| X1 | Background TV, isolated ambient history/progress, Tune In | C4,N4 | Ambient vs deliberate history isolation |
| X2 | Overnight charging/unmetered preparation and useful predictive caching | C5,N4,H2 | Storage/battery/provider backoff and restart recovery |
| X3 | In-flight sampled scene/audio/intro-credit analysis with edition provenance | C5,N3 | Actual extracted evidence; not compression-only |
| X4 | Ambiance/photos/sound/timing and allowed physical integrations | U2,N4 | Honest permission/unsupported states and motion budget |
| S1 | Regional availability/attribution and verified official app handoffs | U3 | Missing app/account/data states; no fabricated links/playback |
| R1 | One-revision platform packages, artifact allowlist and existing signing identity | C4,U4,H1 | Native package inspection and clean install |
| R2 | Signed update, staged activation, interrupted update, rollback and recovery | R1 | Real retained-state and rollback rehearsal |
| R3 | Authorized LAN/Tailscale pairing, certificate/reconnect/revocation | H1,R1 | Real authenticated destination; random URL not security |
| V1 | Independent 47-ID UI/UX and security review on installed builds | U4,U5,H3,H4,X1,X2,X3,X4,S1 | Findings with revision/device/steps/severity and retest |
| V2 | Four-device release acceptance and friend clean-user rehearsal | V1,R2,R3 | 19/19 and 47/47 current evidence, no unsupported skips |
| D1 | User/Family/private-owner/recovery guides and measured technical whitepaper | V2 | Docs agree with verified, experimental and parked capabilities |

## Specialist accountability

### Reuse shortlist (researched 2026-09-24; not adopted by this list)

Reuse existing dependencies before adding new ones; adapting open-source implementation is
allowed subject to its license, attribution and distribution obligations. No new model/tool
download or dependency migration is approved merely by this research. Keep the native product
and deterministic policy boundaries; test integration on the actual fleet.

| Remaining gap | Reuse candidate / concrete integration | Gate and decision |
| --- | --- | --- |
| Media controls/appearance | Existing Media3 and LibVLC3 adapters | Windows paused/playing picture continuity and Escape verified in actual Main. Visible local and remote-callback fixture regressions pass, including source closure; Replay clears the caption restart offset. Sleep/late-track guards remain tested. Sandbox/obscured captures fail original-video prerequisites rather than creating false passes. C4 still needs live-provider restart/cancel, Linux, authored-caption styling, focus restoration and resolution of the earlier native heap-corruption crash. No new Android physical certification; do not substitute clock-only evidence. |
| Model execution N3 | [ONNX Runtime Java/Android](https://onnxruntime.ai/docs/get-started/with-java.html), MIT | Candidate for the isolated worker, not fifteen resident LMs. Verify actual AAR ABI/operator contents; [armv7 source-build support](https://onnxruntime.ai/docs/build/android.html) is not proof the downloaded artifact supports the 32-bit TV. No inference or model pack is installed by this decision. |
| Genuine text embeddings N1 | [distiluse-base-multilingual-cased-v2](https://huggingface.co/sentence-transformers/distiluse-base-multilingual-cased-v2), Apache-2.0 | Candidate learned 512D output; freeze/export full tokenizer, pooling and dense graph. Prove output dimensions and ranking quality; model size and HP/TV RAM may disqualify it. Never truncate/pad another encoder to fake 512D. |
| Preparation/analysis C5/X3 | Existing FFmpeg/FFprobe on desktop; [Media3 Transformer](https://developer.android.com/media/media3/transformer/getting-started) on Android | Prefer established remux, sampled extraction and loudness filters; respect FFmpeg build-specific LGPL/GPL obligations. Transformer encoder/device limits remain. Match existing Media3 version; do not introduce retired ffmpeg-kit. Add only after current playback checkpoint. |
| Durable Home/Friends events H1/H4 | [SQLDelight](https://github.com/sqldelight/sqldelight), Apache-2.0, with existing OkHttp transport | Evaluate for new outbox/inbox storage, not a wholesale migration of tested core.bin. It does not implement replication, authorization, invitations, relay or conflict semantics. Separate-Home rendezvous/hosting is still an explicit architectural decision. |
| Cryptography and packaging | Existing AndroidKeystore/DPAPI/JDK primitives first; [Tink](https://github.com/tink-crypto/tink-java) only for a demonstrated missing primitive. [jpackage](https://docs.oracle.com/en/java/javase/25/jpackage/packaging-overview.html) and [PackageInstaller.Session](https://developer.android.com/reference/android/content/pm/PackageInstaller.Session) for platform packages | Do not replace functioning secret custody. Packaging APIs do not provide signing identity, trust, atomic application-state migration, rollback or silent Android installation authority. Build on target OS; verify real installs and recovery. |
| Shared UI verification U1-U5/V1 | Existing Compose semantics/focus APIs and [Compose Multiplatform UI tests](https://kotlinlang.org/docs/multiplatform/compose-test.html), Apache-2.0 | Prefer shared roles/state descriptions/test tags and reusable native journey assertions over a new UI/navigation framework. Pin to this repo's Compose version: upstream test API is experimental. Android instrumentation and desktop tests still need actual TV D-pad, Fold posture and accessibility review; not permission to skip hardware. |
| Social message codecs/transport H4 | [kotlinx.serialization JSON](https://kotlinlang.org/docs/serialization.html), Apache-2.0; existing OkHttp transport | Evaluate generated, versioned invitation/watchlist/revocation envelopes once B2 contracts settle; keep tested core.bin unchanged. JVM/Android without a native ABI. Do not add a second HTTP client. Neither library supplies identity, authorization, conflict resolution, durable delivery or cross-Home reachability. |

Incremental research also considered [libebur128](https://github.com/jiixyj/libebur128)
(MIT) for decoded-PCM loudness: defer JNI/JNA and ARM32 packaging until shared PCM analysis
exists; current FFmpeg loudness filters are a cheaper first integration. Avoid adding Python/
OpenCV solely for scene cuts on Android/TV. No new updater framework selected: preserve planned
platform packaging and signed recovery instead of adopting an archived update4j runtime or
introducing another installer/update service. These are integration-cost judgments, not claims
that the remaining neural, social or update features are implemented.

Priority: finish the existing-player integration, then a bounded real-encoder/runtime feasibility
check after artifact approval; use the Home/Friends dependency graph before selecting sync storage.
No savings estimate or upstream test result substitutes for ReelOS acceptance evidence.

Current C4 increment: shared profile schema7 retains caption size/style across titles with
schema5/6 migration and stale-session guards. Native TV/Pixel checks verify rendered styling
after player reopen and persistent reset; desktop uses those same stored choices with
per-playback LibVLC options. Desktop Main reopen/focus, authored-format overrides, live-source
restart/cancellation, Linux output and the earlier native crash remain open. HP identity/runtime
was rechecked through its pinned SSH host key; the legacy kiosk has not been replaced.

Queued after current playback work (C1–C4): extend N2/U5 with Family’s “More of this in their world” parent suggestions and a “Watch with me” collection. Use the shared taste engine; suggestions remain separate from child taste and safety, preserve favorites, enter gently and back off after dismissals. Add tests for attribution/isolation, eligibility, exposure/backoff and unchanged safety enforcement; this addition is recorded, not implemented.

Taste; semantic search; preparation; storage/retention; machine protection; interface/atmosphere;
source/rendition ranking; workload scheduling; ambient presence; predictive caching; scenes;
family annotations; dialogue enhancement; household matching; in-flight analysis.
Fault recovery remains integrated with protection/orchestration, not lost under a misnamed registry.

Each needs owner, model/algorithm and feature-space identity, real inputs, coordinator route,
deterministic fallback, budget, cancellation, privacy boundary, test classification and evidence.
Do not describe hashed vectors as semantic embeddings. Five-dimensional bandit context is
not a 512-dimensional media embedding. Downloading a model does not register or activate it.
Scene/family/dialogue experiments remain non-authoritative until measured gates and signed
promotion. Validating locally requires an actually running evaluation; otherwise unavailable.

## Hardware and release boundaries

Re-verify identities: Windows ~15.8 GiB, Onn TV 32-bit Android ABI, Fold R5GL64PC0CF,
HP Ubuntu ~3.2 GiB. A historical IP is not proof of identity or reachability.
Synthetic 30-second silent media is a smoke fixture, never feature-film/audio acceptance.
Use one resource governor for models, caches, artwork, playback and background work.
RAM-backed temporary storage does not remove codec compute. Never damage network settings
to simulate failures. Owner-away UAC/OS prompts remain explicit blockers, not bypass targets.

Old ReelOS app state may be discarded only at identified app/package paths. Preserve OS,
networking, unrelated files, source/evidence and signing identity. New updates preserve new
user state. No public release, paid purchase, broad wipe or signing-key replacement is implicit.

## Checkpoint and handoff

Each accepted slice: targeted tests -> independent review where needed -> current context ->
credential scan -> commit -> push -> verify remote revision -> source-fingerprinted candidate.
Evidence stores exact revision/artifact/device, test scope, failures and skips. Never turn
a blocked test into passing or copy web evidence into native acceptance. Keep current progress
in workstreams.json and generated checks; Git history is the audit trail.
