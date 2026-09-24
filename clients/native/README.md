# ReelOS shared native migration

**Validation foundation, not a friend-ready release.** Preserve the current household
installation and signing identity. This directory is the canonical new Kotlin/Compose
implementation; `clients/android` and the web application remain migration references.

## Shared implementation

- `core`: pure Kotlin/JVM state and source-availability policy shared with Android.
- `shared-ui`: Compose Multiplatform UI, Android + desktop targets, no browser.
- `presentation`: one Kotlin adapter compiled into both host applications.
- `desktop`: Windows/Linux native-rendered JVM host with LibVLC local-media and guarded byte-callback adapters.
  Windows rendered real fixture bytes in a native video surface; Linux first-screen rendering is verified,
  but Linux input/playback acceptance remains open.
  LibVLC is currently a separately installed host dependency, not bundled release media tooling.
- `android`: isolated `com.reelos.nativepreview` validation host using native Media3.
  It has INTERNET permission for explicitly configured optional sources, forbids cleartext traffic,
  does not replace `com.reelos`, and cannot produce a release. The current validation build directly
  includes the optional provider adapter; sanitized public packaging remains a separate release gate.

The first slice persists name, color, guidance, taste selections/reactions, per-profile motion,
density/transparency and local profile state. The native taste field automatically cycles a finite
factual title/actor/mood catalog independently of playable media; it does not grant access or invent
streams. Its current circles have text and breathing light, not the finished artwork treatment.
Public catalog retrieval, endless artwork bubbles, full Family/PIN enforcement,
pretrained encoder inference, Home sync, complete journeys and packaging are not established by it.
Native Home now replays persisted per-profile reactions through a bounded local SGD learner.
This ranks rated or seed-matched titles; it does not establish semantic discovery of unseen titles,
held-out recommendation quality, all fifteen specialists, or a complete machine-resource governor.
Empty/imported catalog state is honest; no movie title is backed by an unrelated sample stream.
Never use this slice for children or treat its local adapter assertions as security certification.

## Reproduce without repeating repository exploration

Read `CORE-CONTRACT.md` and `../../docs/native-ui-ux-audit.md` (all 47 UI requirements).
Run from repository root:

```powershell
npm run test:native-core       # cached compiler, no download, scoped evidence only
npm run test:native-contracts  # structure and UX inventory, not functional acceptance
```

With approved build dependencies and JDK 17 / Android SDK 35 available:

```powershell
$env:GRADLE_USER_HOME = 'C:\Users\austi\Documents\Codex\.toolchains\gradle-home'
$env:ANDROID_HOME = 'C:\Users\austi\Documents\Codex\.toolchains\android-sdk'
.\clients\android\gradlew.bat -p .\clients\native :core:test :desktop:compileKotlin :android:prepareHardwareValidation --offline --max-workers=1 --no-daemon
.\clients\android\gradlew.bat -p .\clients\native :desktop:run
```

Use the existing wrapper from `clients/android`; do not download a second Gradle installation.
Desktop defaults to isolated `.reelos-native-validation` app data; override with
`REELOS_NATIVE_DATA` for test runs. Android owns separate app-private data. Startup corruption
does not reset data. The local snapshot is a feasibility store, not the finished Home-sync database.

## Current blockers / next slice

1. Approved build dependencies downloaded on 2026-09-23. Gradle passed 52 core JUnit tests
   and nine Windows desktop tests (zero failures/skips), desktop Kotlin compilation and Android
   debug assembly. Both the Fold
   and 32-bit Onn TV installed and launched the isolated APK. This is launch/render evidence,
   not complete onboarding, playback, model or platform acceptance.
2. Complete model-worker boundary and approved artwork/taste field;
   then measure the actual native slice on all four targets before expanding remaining journeys.
3. Android TV (`armeabi-v7a`), Fold SM_F971U and Pixel 10 Pro XL each passed 28 physical
   checks: nine empty-profile first-run/import/Play/Resume, twelve media (including rapid
   source revocation/restoration and profile switch/back during playback), and seven personal
   UI checks. Zero skips; the script below records exact source/APK hashes and fails on missing
   cases. Fold is wireless-paired; Pixel is USB-authorized. Fold posture/rotation/keyboard,
   audio/subtitles, sustained playback and full UI acceptance remain open.
   Windows .214 is 15.8 GiB, not 64 GiB.
   HP password SSH verified Ubuntu 26.04.1 x86_64, about 3.2 GiB RAM and an active Wayland
   Cage Wayland kiosk, not a general desktop. Java 17 and LibVLC are now installed with
   approval; an immutable Linux x64 validation bundle renders its first native screen.
   The active kiosk is still the old browser installation; the isolated native render is not
   an installed replacement. Input and playback acceptance on that compositor remain open.
4. Preserve all 19 active feature groups / 47 UI requirements. Update their existing acceptance
   ledger only with current evidence; a core smoke pass is not a platform or UI pass.

No models were downloaded. Build dependencies were downloaded with owner approval; the separate
dependency-free core smoke remains offline. No existing household application was
uninstalled, household data wiped, or signing key replaced. A failed build must remain visible,
not be replaced by a stale APK.

Validated optional media sources are normal functionality, not blanket beta. Only unverified
external-app handoffs have an experimental preference. The shared optional provider adapter is integrated for validation;
verified official-app handoff remains unimplemented and its toggle cannot grant media access. Core schema 5 retains personal
appearance and schema 3's separation: old blanket-beta snapshots do not revive
optional access or inherit experiment consent. OS motion preferences override decorative motion.
The local player binds a persisted source/media/profile access generation and rechecks it roughly
once per second. Profile switching, source revocation, media-access changes and unreadable state
release the session; rapid revoke/restore cannot revive it. This local guard does not certify
Family/PIN enforcement or instantaneous revocation. External transport now checks credential/source
continuity with guarded ranges; live verification is tracked separately below.

## Physical media checks

`scripts/test-native-android-hardware.ps1 -Device <authorized-adb-serial>` installs only
`com.reelos.nativepreview` and its test APK, wakes the display, and requires every named
test to finish within a bounded timeout. Build `:android:prepareHardwareValidation` first.
That task builds both APKs and records their exact source/file hashes. The runner rejects changed
sources or APK bytes before installation, rather than rejecting valid Gradle cache timestamps.
Results, source/package hashes and scoped logs
replace `.reelos-audit/native-hardware/<serial>/result.json`. The generated video lives
only under `src/androidTest/assets`; it contains no personal data and must never enter
the application APK/catalog. Tests cover integration, not a complete user journey.

Use `-Journey personal-ui` for a separate seeded native appearance/taste/profile interaction
check. Evidence replaces `.reelos-audit/native-personal-ui/<serial>/result.json`. It verifies
Like/Love/Cozy/Reset/neutral Dismiss, reentry, profile isolation, restart persistence and the
Taste-to-Sources transition. It does not certify fresh onboarding, artwork quality or the
whole product. The runner backs up and restores the isolated validation package's core state;
an interrupted baseline remains recoverable and intervening state is retained before recovery.
It never resets the installed consumer package. Both journeys require current source hashes.

Use `-Journey first-run` for an empty-profile native journey: name entry, Back and restart,
color/guidance, Like/Love, standalone completion, confirmed Open With import, Save/Library,
Play/return and Resume. Setup advances through accessibility controls, not seeded core calls.
Evidence replaces `.reelos-audit/native-first-run/<serial>/result.json`. It uses the short,
silent test-only fixture and does not certify provider access, Family/PIN, artwork, full
onboarding requirements, a system file picker, audio/subtitles or sustained playback. The
existing validation state is backed up/restored; a synced fixture-ID journal supports
cleanup after interrupted runs. Accessibility dispatch waits for observable state changes,
not unbounded animation-idle waits. Every named case is required; failures remain failures.
Shared title cards derive Play versus Resume only from the active person's saved position
and existing source availability; progress never grants access to revoked media.

Native versions derive from the root `VERSION`, Git revision and source fingerprint. Settings
shows the same generated identity on every host; Android package metadata uses that identity too.
These are validation artifacts, not a newly signed consumer release. Changing a native source
invalidates affected device evidence until rebuilt and retested.

Desktop tests need `REELOS_DESKTOP_FIXTURE` pointing to a real local fixture and installed
LibVLC. Without the fixture the decoder test is skipped, which is not release evidence.
Run `:desktop:test`; separately operate native import/Play/pause/seek/resume/end controls.
Open With accepts one absolute local file path and requires visible confirmation before
adding it; it never imports a URL or starts playback automatically.

Do not recompile desktop/core/shared-ui while Gradle `:desktop:run` is alive: its live
classpath points to mutable build outputs and compilation can remove synthetic classes.
Stop the validation process before the next desktop build. Android-only work may proceed
only while shared dependencies remain unchanged. A class-loading failure caused by this
testing collision is not evidence of an installed-package defect.

Windows manual native checks on 2026-09-23 observed onboarding and restart persistence,
confirmed Open With import, real video frames, pause, backward seek, resumed playback,
end-of-video Replay and normal application exit. This uses a 30-second silent fixture,
not a sustained feature film, audio/subtitle certification, OS file-picker certification,
or an installer test. Nine desktop tests also passed with the real decoder fixture and
zero skips. Neither this nor TV integration evidence completes the 19/47 release gates.

## Current optional-source validation slice

One provider protocol, protected connection controller and projection layer serve Android and
Windows. Android Keystore and current-user Windows DPAPI keep credentials out of core/profile
state. Linux has no protected credential adapter yet and never falls back to plaintext.
The shared connection panel supports validate/replace/remove and bounded collection pages;
40 visible files is a navigation window, not an inaccessible tail. Positive readiness requires
provider finished+present flags and fresh exact-file validation. The native players receive
bytes/callbacks, not credential-bearing URLs. Personal originals are never removed by disconnect.

Use `-Journey connection` for four synthetic-key protected-store checks (verified on Fold,
Pixel and Onn). Use `-Journey provider-live` only with explicit owner authorization and an
in-app-entered key: account, exact-file and 16 KiB range checks; no acquisition/deletion,
no secret/media identity output, and no implied decoder or sustained-playback acceptance.
Live Fold account, exact-file resolution and bounded 16 KiB range checks passed. A provider-issued
CDN lease embeds the credential; the corrected opaque transport confines every lease/redirect
to the provider-published CDN domains and checks public DNS/address/range authority. Cancellable
bounded DNS prevents an unresolved lookup from hanging native-player shutdown. This does not
establish full-film remote decoding, audio/subtitles or provider-disable end-to-end UI acceptance.
Integrated offline checks passed 30 provider tests and 20 desktop tests with no skips, including
the opt-in installed-decoder fixture. Recheck the source-fingerprinted reports after each change.

For Windows callback/decoder tests, set `REELOS_DESKTOP_FIXTURE` to
`clients/native/android/src/androidTest/assets/Native-Validation-30s.mp4` (absolute path),
and `REELOS_TEST_LIBVLC_CALLBACKS=1`, then run `:desktop:test`. The latter opt-in tests
silent-fixture byte callbacks, time progress, seek and resume using installed LibVLC 3.
It is not live provider playback or a visual/frame/audio/subtitle certification. Missing
opt-ins count as skipped, never passing hardware evidence.
