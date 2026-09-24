# Native UI/UX audit — initial implementation contract

2026-09-23. Static source and requirement review before the shared native UI is built. This is a design and reachability audit, **not** an installed-device review or a native functional pass. The 47 `ui-*` IDs below come from `docs/feature-acceptance.json` and `docs/INTERFACE-FEATURE-REGISTER.md`. Earlier browser/service evidence cannot certify Windows, Linux, phone, or TV behavior. Record native results against the same IDs only after app and physical-device checks.

## Current installed-app findings

### Native player follow-up — 2026-09-24, after c7c2f67

Actual native Main app, isolated Caption Check profile, synthetic Native-Tracks-30s.mp4;
no owner media or credentials. This narrow check does not accept all of `ui-player`.
The paused replacement now warms the decoder silently at the saved position, restores
tracks, and waits for output before honoring play/pause intent. The visible single-track
and multitrack pixel regressions both pass on the actual Windows desktop. Restricted
sandbox captures returned black even for the ORIGINAL video; tests now verify that
prerequisite rather than misclassifying it as a replacement failure. Current full-batch
counts belong in `.reelos-audit/native-checkpoint/result.json`. Release remains blocked
with146 acceptance gaps; this check does not certify Linux or a live provider account.
After the old Java crash dialog disappeared, the final combined batch passed61 core and33
desktop tests with zero skips, including remote callback paused-pixel/source-close and
caption-offset Replay regressions. The result is generated in the checkpoint artifact.
Actual Main verified paused and playing picture continuity, normal Close/return and Escape
dismissal after the fix. The previous0xC0000374 native heap-corruption record is real but
not reproduced in these subsequent runs; Windows identified StackHash/ntdll rather than
a causal module. It remains a stability investigation, not a resolved defect.

| Finding | Result / remaining check |
| --- | --- |
| Appearance dropdown obscured by heavyweight video | Separate native dialog shows all size/style/reset choices above video; actual pointer selection verified. Escape was missing, is now implemented and verified in Main. Full keyboard focus restoration remains to be checked. |
| Replacement retained old SwingPanel drawable | Keyed surface and stopping old output before removal restore controls and correct resumed time. Duplicate same-handle attachment is guarded. |
| Paused replacement shows black instead of saved picture (major) | Local Windows retest passes: actual Main retained the paused picture at6.417s from6.375s, and both visible pixel regressions pass. Muted warm-up, bounded corrective seek and acknowledged pause replace paused-input seeking. Remote and Linux checks remain open. |
| Sleep expiry or late tracks during replacement | Pause records intent without stalling muted warm-up; authorization still runs before completion. Late tracks trigger one asynchronous corrective seek, with bounded position and timeout-to-fallback. Real-decoder sleep regression and deterministic late-track regression added. |
| Remote byte-adapter replacement | Synthetic multitrack bytes run through real LibVLC callbacks; visible original/replacement pictures, paused position and closure of both sources pass. No real account, network latency or live provider refresh/cancel claim. |
| Replay after caption change | Main exposed retained start-time on Replay. Replay now resets that media option to zero; real-decoder regression proves a20s caption restart does not become the new beginning. |
| Format-specific caption appearance | Main's embedded MP4 mov_text cue remained white despite Yellow selection. Plain SubRip/MKV pixel tests support actual style overrides; authored-format override behavior remains unresolved and must not be claimed universally. |
| Close/return | Native player Close returns to Home; saved Resume action observed. Normal app close exits successfully. |
| Caption appearance reset on every title | Shared profile schema 7 now stores size/style, migrates schema 5/6 to device defaults, preserves language choices and rejects stale playback-profile edits. Android restores the saved style on new playback and persists reset. Desktop opens each playback with its profile's renderer options and only saves a change after successful restoration; failed replacement retains the prior default. Migration/isolation tests and native Android rendered-caption reopening cover this change; desktop Main reopening still needs direct interaction verification. |

The rejected approaches were paused-input seek, a single next-frame call, and start-time
combined with start-paused. Current restoration starts MUTED but playing; it pauses only
after output is ready. Output statistics are cumulative and are not universal pixel proof;
visible tests remain required. Real-decoder test surfaces must be visible, not merely
addNotify-created hidden windows. Next: live provider restart/cancellation, Linux output,
format-specific styling, dialog focus and native crash investigation. The current Android
media case also checks saved appearance after closing/reopening playback and reset persistence;
device pass/fail and exact source hashes belong in `.reelos-audit/native-hardware/<device>/result.json`.
The schema7 batch passed63 core and34 desktop tests plus21 native media cases each on
OnnTV and Pixel, zero skips. A final desktop-only rerun also passed34 after the reviewed
provider-setup cancellation ownership fix (`caption-persistence-final.log`). The Fold was
not connected. These are scoped playback results, not whole-interface approval.
HP authenticated identity/runtime recheck succeeded; its legacy Cage/Chromium kiosk is still
active and unchanged. SSH key-only authentication failed; the existing owner login works
with the already-pinned host key. This is not Linux playback certification.

## Authority and shared design (baseline contract)

Latest owner direction for this implementation: one shared Kotlin/Jetpack Compose UI and core on Windows, Linux, Android phone/tablet, and Android TV; Books is absent on TV; learning data is not exported beyond the Home. This supersedes the older C# Windows/Linux-toolkit wording in `docs/agent-context/owner-requirements.md` and `active-decisions.json` for this implementation. A Home is optional for standalone use. Device layout and input adapt while journey names, meaning, state transitions, and policy stay shared.

Carry these patterns into shared tokens and components:

- Atmosphere: near-black canvas `#080809`/`#0c0c0f`, charcoal surfaces `#141419`/`#17171c`, subtle borders, high-contrast white text and muted secondary text. The selected profile color is a restrained radial accent and breathing glow, not a blanket tint. Source: `src/styles.css:48-59`, `src/experience/reelos-world.tsx:681,1421,2583`.
- Home: full-bleed personalized hero with legible context and truthful Play/Resume/Save; search sits **immediately below** the hero; distinct shelves follow. Decorative falling artwork is unfocusable and does not obscure controls. Source: `reelos-world.tsx:1346-1481,1870`.
- Shared components: artwork card/shelf, search prompt and result, profile portrait/menu, color aura, taste bubble/reaction tray, person card, source/readiness action, scope-labelled settings row, status/empty/retry panel, and native player controls. Keep content in stable places as artwork and ambient color change. Family person cards are separate from the active personal profile destination (`reelos-world.tsx:2453,2837`).
- Motion/transparency: restrained falling art, breathing personal color, and endless taste bubbles retain the approved character. Honor OS reduced motion and in-app Still/Subtle/Expressive; make transparency adjustable without sacrificing contrast. Pause decorative motion during reading and playback. Source: `src/styles.css:126-138,191-386`; `reelos-world.tsx:2719`.
- TV: pre-blended or hardware-friendly radial atmosphere; no viewport software blur. Focus indicator remains stationary and unmistakable, including dark text on a light selected surface. Remote Back always reaches a predictable prior screen. Touch targets remain large on phone/tablet. No redundant page headers, decorative AI icons, hidden-only gestures, or engineering vocabulary on consumer screens.

## Platform and input key

`A` = all four native targets (Windows, Linux appliance/HP, Android phone/tablet, TV). `H` = Windows, Linux, phone/tablet; TV excludes Books. `T` = TV-specific. On desktop use pointer, keyboard, and focus-visible semantics; on phone/tablet use touch plus Fold closed/open layouts; on TV use D-pad/select/back and remote text entry. Every row marked A needs the same meaningful destination on every target, even if a device-specific control is read-only because the capability is unavailable. Physical review should also try keyboard-only traversal on desktop and every major TV path using only the remote.

## All 47 interface acceptance IDs

The final column specifies the native interaction and state that must be visibly checked. Each journey must have loading, meaningful empty, offline/unavailable, error/retry, and Back behavior when its backing operation can enter those states. A selected visual state alone does not prove persistence or service success.

| ID | Native entry/destination | Platform, input, state acceptance |
| --- | --- | --- |
| `ui-active-identity` | Persistent portrait → person picker | A; pointer/touch/D-pad. Open, switch, selected, child; color, curation, saves, history and settings change together without cross-profile leak. |
| `ui-personal-destination` | Portrait → own profile | A. Artwork, color, collections and Tune taste; Family administration stays elsewhere; Back returns to prior destination. |
| `ui-setup-identity` | First launch; Settings → review setup | A. Name and adult PIN intent; validation, secure confirmation, Back-preserved draft; child cannot bypass exit PIN. |
| `ui-setup-color` | Setup after identity | A. Eight selectable colors, immediate breathing-glow preview, visible selected/focus state, persistence on return. |
| `ui-setup-guidance` | Setup after color | A. Guided/Balanced/Independent help spectrum; one clear selection persists and changes the amount of curator guidance across journeys. It does not set tonight's exploration mood. |
| `ui-setup-taste` | Setup after guidance | A. Bubble field with Like/Love/Cozy/Dismiss/Skip, clear focus/reaction state; Dismiss remains neutral; first Home responds. |
| `ui-setup-home` | Setup after taste | A. Create/join trusted Home or continue standalone; pairing progress, offline/retry, no accidental duplicate household. |
| `ui-source-choice` | Setup after topology | A. Public/personal path works without credential; optional neutral adapter validation, failure/return; never persist a key in UI draft. |
| `ui-deployment-choice` | Setup after source | A. Add phone/TV/USB options appropriate to target; progress and explicit confirmed/failure state; adding later never restarts onboarding. |
| `ui-home-hero` | Primary Home | A. Personal art/context, Play or Resume only if verified, Save, visible focus, unavailable alternative; profile color/art update without navigation jump. |
| `ui-home-search` | Directly below hero | A. Enter by touch, keyboard, D-pad; title/person/mood/exclusion/scene input; result, ambiguous help, empty, offline. |
| `ui-home-shelves` | Scroll below search | A. Continue, suggested, saved and varied rows; distinct titles, profile-specific results, row focus and See all/empty route. |
| `ui-no-idea` | Lower Home after shelves | A. Falling art plus three useful low-effort invitations; decoration is not a target; only verified-access outcomes claim playable. |
| `ui-taste-calibration` | Profile → Tune your taste | A. Endless title/person/mood bubbles; Like/Love/Cozy/Less/Dismiss/reset/exit, reversible reaction and resumed position. |
| `ui-taste-explanation` | Title detail | A. Human-readable specific connection; no score/model jargon; unknown basis gets neutral copy. |
| `ui-tonight-context` | Discover → Refine | A. Mood/duration/type/person/exploration and Clear; temporary curation changes, long-term taste unchanged. |
| `ui-discover-invitation` | Discover top | A. Art-led feature, one explanation and title action; no introduction stack or dead CTA. |
| `ui-illustrated-paths` | Discover below feature | A. Three visual clusters expose example titles then open real collection grids, including empty/unavailable. |
| `ui-curated-shelves` | Discover scroll | A. Horizontal browse and See all grid; adjacent rows avoid same short set; D-pad rail traversal is stable. |
| `ui-deeper-invitation` | Between Discover shelves | A. Person/adaptation action opens relevant real work; loading/empty/failure returns to Discover. |
| `ui-search-results` | Home/Discover search | A. Titles, people, collections and books on H; TV has no Books category. Precise/vague query, ambiguity and empty refinement. |
| `ui-title-details` | Any poster/result | A. Art, context, primary access action, reaction, cast, related; progressive expansion, unavailable/access-revoked state, related poster opens detail. |
| `ui-prepare-play` | Title primary action | A. Find → prepare → measured progress → ready/failed/retry/cancel; readiness reflects validated source/rendition, not preview or fixture. |
| `ui-player` | Play/Resume | A. Native play/pause, seek, audio/subtitles, listening, sleep, handoff, end choice; controls and progress persist; explicit playback error/retry. TV remote and desktop keyboard paths required. |
| `ui-library-continue` | Library | A. Profile-private artwork/progress and Resume; empty state and exact persisted position after restart. |
| `ui-library-collections` | Library | A. Saved, reactions, retained, sort/collection entry; immediate updates, meaningful empty state, source revocation reflected. |
| `ui-library-activity` | Library → Activity | A. Finding/preparing/ready/failed/cancel/retry visible after leaving title detail; target/source and status are truthful. |
| `ui-travel-downloads` | Library → Downloads | A. Available, queued, progress, verified offline, failure/retry; no completed badge before device validation. |
| `ui-books-shelf` | Library → Books; Settings → Reading | H only. Continue/shelf/discover/import/adaptations, profile-private empty/offline and import failure. No Books navigation or search results on TV. |
| `ui-reader` | Book selection | H only. Chapter, bookmark, in-book search, progress, typography/appearance; restart at profile position; decorative animation stops. |
| `ui-family-overview` | Settings → Family | A. Person cards, add person, all-ages/kids-present; identity, manager authority and presence shown distinctly. |
| `ui-adult-profile-editing` | Family → adult card | A. Color, privacy, optional PIN create/confirm/error; secret never echoed or persisted in view state. |
| `ui-child-profile-editing` | Family → child card | A. Maturity, eight boundaries, bedtime, required exit PIN; save/denied/retry; child escape test uses real enforcement. |
| `ui-kids-present` | Family or Companion | A. Add/remove participating children; visible session state, separate active identity, curation/policy update. |
| `ui-family-filtering` | Child editor and title/player result | A. Catalog severity versus film audio/subtitle treatment clearly distinguished; unavailable/uncertain treatment fails closed. |
| `ui-companion-strip` | Home shell during playback | A. Optional current-title summary and expand; empty/no-session state; never blocks browsing. |
| `ui-companion-remote` | Companion expanded | A. Back/play-pause/forward/remaining; target device named, command pending/ack/failure; no optimistic success. |
| `ui-story-companion` | Companion tabs | A. Catch-up/cast/relationships/soundtrack/craft bounded to current playback time; no spoiler beyond position; unavailable explanation. |
| `ui-watch-together` | Settings → Watch together | A. Host/join, participants, confirmation, reconnect, error and exit; distinguish nearby household from remote party. |
| `ui-devices` | Settings → Devices & connections | A. Named connected devices, add phone/TV/USB, pair/progress/offline/failure/retry/return; remote storage control linked from target card. |
| `ui-torbox-management` | Devices → optional source adapter | A where private adapter installed. Use neutral public-core wording, secure credential entry, validation/pending/failure; do not imply availability without adapter. |
| `ui-ambiance` | Settings → Ambiance | A when supported; art/firelight/private photos/sound/lights/timer, one prominent moving region, unavailable controls explain why. Background TV mode has separate history and Tune In; see extension below. |
| `ui-acoustic-calibration` | Ambiance → calibration | A on capable device. Guided phone/TV steps, permission at use, cancel/failure/retry; no tone or calibrated claim in preview. |
| `ui-settings` | Primary Settings | A. Collapsible Person/Home/Device scopes, current value and pending/ack state; navigation does not depend on technical terms. |
| `ui-motion-preference` | Settings → Look and feel | A. Still/Subtle/Expressive, persisted per person; OS reduced motion overrides decoration. |
| `ui-density-preference` | Settings → Look and feel | A. Comfortable/Compact, persisted; layout changes without disappearing actions or moving TV focus unexpectedly. |
| `ui-help-status` | Settings → Help/status | A. Honest service/capability and update/recovery status, direct route to action, offline/error; distinguish preview from installed operational state. |

## Required extensions and cross-journey checks

- **Background TV / Tune In:** TV Home or Ambiance provides a visible background viewing entry, channel selection and Tune In. Entering background mode creates separate session/history/progress from deliberate viewing. Promotion to foreground requires a clear action; passive background viewing must not silently mark a title watched or train dislike. Verify remote channel transition, audio/focus, playback priority and exit.
- **Overnight preparation:** Device settings identify charging and unmetered-network preference, local time window and storage allowance; Library Activity exposes queued, preparing, ready, paused by battery/network/playback/thermal/space, failed and retry. Explain when it will next run. Background work never claims a copy ready until validated.
- **Remote storage control:** Settings → Devices → named target → Storage/Preparation. Show target name and online state, current usage, hard free-space reserve, budget slider and charging/unmetered preferences. Distinguish local draft, sent/pending, target-acknowledged/applied, rejected, offline and conflict. Only an authorized household manager can change another device; child/guest and pairing-only identities see a disabled/explanatory state. Target policy protects originals, pinned/in-use media and playback. Include phone → Windows/HP scenario.
- **Adaptive guidance:** Setup guidance uses a lasting Guided/Balanced/Independent help preference that changes how much assistance and explanation the curator offers. Discover's temporary exploration/refinement choices are separate. Changing guidance must visibly alter help, preserve a clear explanation/reset, and never override explicit reaction, access or family rules. When local learning is unavailable, label the deterministic behavior truthfully in Help, not with an AI badge.
- **HP visible UI:** HP Debian appliance is a full native screen with first-run flow, Home, search, Library, device/storage, playback and visible health/update/recovery state. A headless process, localhost page or service status alone cannot satisfy this. Reserve physical install for the final candidate per owner requirements.
- **Failure/empty system:** Provide native shared patterns for no catalog, no profile, no Home/standalone, offline peer, revoked source, no playable result, queued/failed preparation, no downloads/books, no current playback, missing analysis, failed pair/update and low space. Every blocking state names the affected item/device and an actionable retry, Settings, or Back route. A source-access failure cannot turn into a playable action through cached art.
- **Privacy:** Profile state and history remain isolated locally and across Home sync. Learning/export wording must state that data stays within the Home; no automatic cross-home taste, gradients, weights, transcript, scene, history or settings export under the latest owner direction. Do not show an export or sharing affordance.

## Immediate source defects and reachability risks

1. Current repo still has web-specific consumer flow (`src/experience/reelos-world.tsx`) and Android `SharedReelOsActivity.kt:13-26` contains WebView. The incoming Compose `MainActivity.kt:132+` and `TvMainActivity.kt:349+` cover only slices. A native renderer must make all 47 entries reachable through the same journey graph before any native acceptance claim.
2. Incoming TV `TvMainActivity.kt:128,358-375` seeds `SAMPLE_CATALOG`; mobile `MainActivity.kt:153-200` seeds sample streams with asserted formats. Replace production fixtures with authorized catalog/source truth and meaningful empty states. Mere art is not evidence of access, codec, HDR or playback.
3. Incoming mobile `MainActivity.kt:210-340` centers taste and a library toggle, displacing the approved hero → immediately-below search → shelves Home composition. Incoming TV top navigation and Cinema Home need the same journey order and search reachability with D-pad.
4. Incoming `AppPreferences.kt:103-121` persists one `resident_taste_vector_json` for all residents. Native profile switching can display apparently distinct people while retaining mixed taste; fix persistence and test restart/switch isolation before interaction acceptance.
5. `docs/feature-register.json` covers remote storage policy, but the current 47 UI IDs contain no explicit storage row. Make it an assessed subjourney of `ui-devices`, `ui-library-activity` and `ui-settings` until the register is updated. Do not let a phone slider visually apply to an offline target.
6. The `ui-ambiance` register pre-dates expanded background TV behavior; screen entry and isolated history must be observable. The current durable decision still describes cross-home anonymous taste sharing, which conflicts with the latest no-export-beyond-Home direction. Reconcile requirement records before release evidence is refreshed.
7. The new shared core currently advances onboarding through `acknowledgeCurator` without storing a guidance choice (`clients/native/core/src/main/kotlin/com/reelos/core/ReelCore.kt:59-65`; `CoreModels.kt:17-30`). The native UI cannot claim the Guided/Balanced/Independent preference persists until a profile-scoped field and replay behavior exist.

## Physical UX review method after implementation

Use the same 47-ID journey sheet on each installed target; capture app build/commit, OS/device identity, input, person/Home/source fixtures, screen recording or photos, observed state transitions and service acknowledgment. On Windows workstation, traverse by mouse and keyboard; verify installer/onboarding, search, playback, yield and update/recovery. On Onn 4K Pro, traverse only with remote including text entry, focus, Back, background TV and player. On Galaxy Z Fold serial `R5GL64PC0CF`, test folded/unfolded transitions, touch, standalone start and manager remote-storage control. On the HP Debian 12 appliance, perform final-candidate-only native visible UI, local playback, storage, health and recovery checks after device identity is verified. The supplied IPs are locators, not proof of identity. For each target, exercise empty/offline/permission/failure states and reduced motion; mark an ID pass only with actual outcome evidence, not screenshot appearance or source inspection. A screenshot/browser test may inform visual review but cannot serve as native functional acceptance.
