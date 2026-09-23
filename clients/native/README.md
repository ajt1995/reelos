# ReelOS shared native migration

**Validation foundation, not a friend-ready release.** Preserve the current household
installation and signing identity. This directory is the canonical new Kotlin/Compose
implementation; `clients/android` and the web application remain migration references.

## Shared implementation

- `core`: pure Kotlin/JVM state and source-availability policy shared with Android.
- `shared-ui`: Compose Multiplatform UI, Android + desktop targets, no browser.
- `presentation`: one Kotlin adapter compiled into both host applications.
- `desktop`: Windows/Linux native-rendered JVM host. Desktop media decoding is not connected.
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

1. Build dependency download approval: cached Kotlin can compile core, but offline Gradle lacks
   plugin markers and Compose desktop artifacts. Native UI and Android host are not compile-verified yet.
2. Complete desktop media adapter, model-worker boundary and approved artwork/taste field;
   then measure the actual native slice on all four targets before expanding remaining journeys.
3. Validate 32-bit Android TV ABI (`armeabi-v7a`) and Fold ARM64. Windows .214 is 15.8 GiB,
   not 64 GiB. HP SSH port is reachable but current key authentication failed.
4. Preserve all 19 active feature groups / 47 UI requirements. Update their existing acceptance
   ledger only with current evidence; a core smoke pass is not a platform or UI pass.

No models or tools were downloaded for the offline core test. No existing application was
uninstalled, household data wiped, or signing key replaced. A failed build must remain visible,
not be replaced by a stale APK.
