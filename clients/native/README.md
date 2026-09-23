# ReelOS shared native migration

**Validation foundation, not a friend-ready release.** Preserve the current household
installation and signing identity. This directory is the canonical new Kotlin/Compose
implementation; `clients/android` and the web application remain migration references.

## Shared implementation

- `core`: pure Kotlin/JVM state and source-availability policy shared with Android.
- `shared-ui`: Compose Multiplatform UI, Android + desktop targets, no browser.
- `presentation`: one Kotlin adapter compiled into both host applications.
- `desktop`: Windows/Linux native-rendered JVM host with a LibVLC local-media adapter.
  Windows rendered real fixture bytes in a native video surface; Linux execution is not yet verified.
  LibVLC is currently a separately installed host dependency, not bundled release media tooling.
- `android`: isolated `com.reelos.nativepreview` local-media validation host using native Media3.
  It has no internet permission, does not replace `com.reelos`, and cannot produce a release.

The first slice persists name, color, guidance, taste selections/reactions and local
profile state. Public catalog retrieval, endless artwork bubbles, full Family/PIN enforcement,
actual model inference, Home sync, complete journeys and packaging are not established by it.
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
.\clients\android\gradlew.bat -p .\clients\native :core:test :desktop:compileKotlin :android:assembleDebug
.\clients\android\gradlew.bat -p .\clients\native :desktop:run
```

Use the existing wrapper from `clients/android`; do not download a second Gradle installation.
Desktop defaults to isolated `.reelos-native-validation` app data; override with
`REELOS_NATIVE_DATA` for test runs. Android owns separate app-private data. Startup corruption
does not reset data. The local snapshot is a feasibility store, not the finished Home-sync database.

## Current blockers / next slice

1. Approved build dependencies downloaded on 2026-09-23. Gradle passed nine core JUnit tests
   (zero failures/skips), desktop Kotlin compilation and Android debug assembly. Both the Fold
   and 32-bit Onn TV installed and launched the isolated APK. This is launch/render evidence,
   not complete onboarding, playback, model or platform acceptance.
2. Complete model-worker boundary and approved artwork/taste field;
   then measure the actual native slice on all four targets before expanding remaining journeys.
3. Android TV (`armeabi-v7a`) passed ten physical media checks; the script below
   replaces evidence on each run and fails on missing checks. This is not full UI acceptance.
   Fold ARM64 is currently disconnected. Windows .214 is 15.8 GiB, not 64 GiB.
   HP password SSH verified Ubuntu 26.04.1 x86_64, about 3.2 GiB RAM and an active Wayland
   Cage Wayland kiosk, not a general desktop. Java 17 and LibVLC are now installed with
   approval; an immutable Linux x64 validation bundle renders its first native screen.
   Input and playback acceptance on that compositor remain in progress.
4. Preserve all 19 active feature groups / 47 UI requirements. Update their existing acceptance
   ledger only with current evidence; a core smoke pass is not a platform or UI pass.

No models were downloaded. Build dependencies were downloaded with owner approval; the separate
dependency-free core smoke remains offline. No existing household application was
uninstalled, household data wiped, or signing key replaced. A failed build must remain visible,
not be replaced by a stale APK.

External-provider setup is behind an off-by-default beta in Settings > Advanced settings.
The native adapter itself is not implemented; opt-in truthfully reports that state and does
not connect an account. Provider beta is not a child/owner authorization mechanism.

## Physical media checks

`scripts/test-native-android-hardware.ps1 -Device <authorized-adb-serial>` installs only
`com.reelos.nativepreview` and its test APK, wakes the display, and requires every named
test to finish within a bounded timeout. Build `:android:assembleDebug` and
`:android:assembleDebugAndroidTest` first. Results, source/package hashes and scoped logs
replace `.reelos-audit/native-hardware/<serial>/result.json`. The generated video lives
only under `src/androidTest/assets`; it contains no personal data and must never enter
the application APK/catalog. Tests cover integration, not a complete user journey.

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
or an installer test. Seven desktop tests also passed with the real decoder fixture and
zero skips. Neither this nor TV integration evidence completes the 19/47 release gates.
