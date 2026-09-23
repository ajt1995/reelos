# ReelOS native core contract

`clients/native/core` is a pure Kotlin/JVM 17 state foundation shared by native Windows,
Linux, Android phone/tablet, and Android TV renderers. It has no Android or browser dependency.
The consumer renderer owns layout and media playback. This slice is local state and honest
availability policy, not an ML implementation or a complete product runtime.

## Renderer entry points

- Construct `ReelCore(store: CoreStore, deviceKind: DeviceKind)`. Use
  `FileCoreStore(privateAppDataPath: Path)` for durable local state, or `MemoryCoreStore` for
  previews/tests. Read `snapshot: CoreState` after an action. Write methods persist before the
  snapshot changes; exceptions leave the previous snapshot in memory. The published state
  and nested profile collections are defensive immutable copies.
- `snapshot.activeProfile` and `selectProfile(id)` identify the private profile. The profile
  carries name, color, taste seeds, reactions, saves, playback positions, and reading positions.
  `createProfile(id, name = "")` starts at `IDENTITY` or `ATMOSPHERE` when a name is given.
- Onboarding steps are `IDENTITY → ATMOSPHERE → CURATOR → TASTE → SOURCES → HOME → COMPLETE`.
  Call `setName`, `setColor`, `acknowledgeCurator(profileId, guidance = BALANCED)`, `setTasteSeeds`,
  `confirmDefaultSources`, then `chooseHome(profileId, homeId = null)`. Taste seeds may be
  empty when the person skips them. Guidance choices are `GUIDED`, `BALANCED`, and
  `INDEPENDENT`; they persist per profile. `back(profileId)`
  preserves earlier input. `canEnterHome(profileId)` gates the cinema Home. A null Home ID
  completes a standalone node. `snapshot.requestedHomeId` is only the person's choice,
  never proof of pairing or network connection. A separate authenticated Home adapter
  establishes and reports actual membership.
- Call `setReaction(profileId, itemId, kind)` with `LIKE`, `LOVE`, `COZY`, `DISMISS`, `LESS`,
  or null to clear. Dismiss means no opinion; Less is negative. The positive reaction map,
  dismissed set, and less-like set remain separate and mutually exclusive per item.
- `save(profileId, mediaId, saved)` changes a private watchlist preference. It does not
  acquire media or assert that a playable copy exists.
- Source adapters call `putSource(SourceRecord)` and `putMedia(MediaRecord)` only after
  determining actual availability. `mediaAction(mediaId)` yields `PLAY` solely when media
  is `READY` and its source is `AVAILABLE`. Metadata-only yields `FIND`; `revokeSource`
  immediately removes Play and preparing eligibility without deleting local personal files.
  `READY` is trusted adapter input, not an access-security decision; the playback adapter
  must verify access again before opening media.
- `navigation()` omits `BOOKS` for `ANDROID_TV`. Other device kinds retain Books. Native
  renderers should derive their navigation from this method.
- `putOptionalSource(sourceId, status)` is a trusted adapter boundary, never a UI access grant.
  Normal validated optional sources do not depend on experimental handoffs. Revoke a source
  with `revokeSource`; personal originals and metadata are retained.
- `setExperimentalHandoffsEnabled(enabled)` persists a per-install experiment preference.
  It cannot grant, revoke, or restore media-source access. No external-app integration is
  operational just because this preference is enabled.

## Storage and safety boundary

`CoreStore` is versioned at `CORE_SCHEMA_VERSION = 3`. Version 1 and 2 snapshots migrate
with optional sources unavailable until adapter revalidation; legacy beta consent does not
enable handoff experiments. Profile data and media metadata are preserved. Rollback requires
compatible state backup/migration; older binaries must not open a newer schema.
`FileCoreStore` writes a synced
temporary file and replaces the prior state atomically. If atomic replacement is unsupported,
the write fails and the old snapshot remains. Each write checks `CoreState.revision` under a
same-directory OS file lock; a stale writer fails visibly and must reload before retrying.
Unsupported versions and malformed collections fail closed on load and write. Callers choose a private
application-data path and enforce OS file permissions. The schema contains no credential,
token, or PIN field; source adapters keep those in their own protected storage. A media
record stores no URL or playback token. The native playback adapter must resolve the opaque
media/source IDs and apply its own access and child-safety checks before opening bytes.

`rankedHomeMedia(profileId)` connects durable reactions to bounded native SGD ranking for
rated/exact-seed titles. Home uses at most 2048 candidates; Library/search keep the full catalog.
`tasteRankingTrace` distinguishes learned scores, deterministic fallback and pressure yield.
Neutral Dismiss is not dislike; Less excludes from recommendations only. Replays are profile
isolated and restart reproducible. This is not a trained semantic encoder or proof of useful
unseen-title recommendations. Full resource governance, event/feature spine and model-runtime
integration remain pending. Home is optional and the core performs no learning exports.
