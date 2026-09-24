package com.reelos.core

import java.util.ConcurrentModificationException
import com.reelos.core.intelligence.LearningGate
import com.reelos.core.intelligence.NativeTasteCoordinator
import com.reelos.core.intelligence.TasteRankingTrace

/**
 * Local state coordinator shared by native renderers. Methods persist before publishing a new
 * snapshot, so a failed write leaves the previous snapshot intact. No model inference is implied.
 */
class ReelCore(
    private val store: CoreStore,
    val deviceKind: DeviceKind,
    learningGate: LearningGate = LearningGate {
        val runtime = Runtime.getRuntime()
        !Thread.currentThread().isInterrupted &&
            runtime.maxMemory() - runtime.totalMemory() + runtime.freeMemory() >= 16L * 1024 * 1024
    },
) {
    // Bounded heap admission only; full device/thermal resource-governor integration is pending.
    private val taste = NativeTasteCoordinator(gate = learningGate)
    @Volatile
    var snapshot: CoreState = validateCoreState(store.load())
        private set

    fun navigation(): List<Destination> = if (deviceKind == DeviceKind.ANDROID_TV) {
        listOf(Destination.HOME, Destination.DISCOVER, Destination.LIBRARY, Destination.SETTINGS)
    } else {
        listOf(Destination.HOME, Destination.DISCOVER, Destination.LIBRARY, Destination.BOOKS, Destination.SETTINGS)
    }

    @Synchronized
    fun createProfile(id: String, name: String = ""): ProfileState {
        requireId(id)
        require(id !in snapshot.profiles) { "Profile already exists" }
        val cleanName = name.trim()
        val profile = ProfileState(
            id = id,
            name = cleanName,
            onboardingStep = if (cleanName.isEmpty()) OnboardingStep.IDENTITY else OnboardingStep.ATMOSPHERE,
        )
        publish(snapshot.copy(
            profiles = snapshot.profiles + (id to profile),
            activeProfileId = snapshot.activeProfileId ?: id,
        ))
        return profile
    }

    @Synchronized
    fun selectProfile(id: String) {
        require(id in snapshot.profiles) { "Unknown profile" }
        publish(snapshot.copy(activeProfileId = id))
    }

    @Synchronized
    fun setName(profileId: String, name: String) {
        val clean = name.trim()
        require(clean.isNotEmpty() && clean.length <= 80) { "Name must be 1 to 80 characters" }
        updateProfile(profileId) {
            it.copy(name = clean, onboardingStep = advance(it.onboardingStep, OnboardingStep.IDENTITY))
        }
    }

    @Synchronized
    fun setColor(profileId: String, color: String) {
        require(Regex("#[0-9A-Fa-f]{6}").matches(color)) { "Expected a six-digit color" }
        updateProfile(profileId) {
            require(it.name.isNotBlank()) { "Identity is required first" }
            it.copy(color = color.uppercase(), onboardingStep = advance(it.onboardingStep, OnboardingStep.ATMOSPHERE))
        }
    }

    @Synchronized
    fun setAppearance(
        profileId: String,
        motionMode: MotionMode? = null,
        browsingDensity: BrowsingDensity? = null,
        transparencyEnabled: Boolean? = null,
        toggleTransparency: Boolean = false,
    ) {
        require(!toggleTransparency || transparencyEnabled == null)
        updateProfile(profileId) {
            it.copy(
                motionMode = motionMode ?: it.motionMode,
                browsingDensity = browsingDensity ?: it.browsingDensity,
                transparencyEnabled = if (toggleTransparency) !it.transparencyEnabled else transparencyEnabled ?: it.transparencyEnabled,
            )
        }
    }

    @Synchronized
    fun acknowledgeCurator(profileId: String, guidance: GuidanceLevel = GuidanceLevel.BALANCED) {
        updateProfile(profileId) {
            require(it.onboardingStep == OnboardingStep.CURATOR) { "Curator step is not current" }
            it.copy(guidance = guidance, onboardingStep = OnboardingStep.TASTE)
        }
    }

    @Synchronized
    fun setPlaybackPreferences(profileId: String, preferences: PlaybackPreferences) {
        val normalized = preferences.copy(
            audioLanguage = normalizedPlaybackLanguage(preferences.audioLanguage),
            subtitleLanguage = normalizedPlaybackLanguage(preferences.subtitleLanguage),
        )
        validatePlaybackPreferences(normalized)
        updateProfile(profileId) { it.copy(playbackPreferences = normalized) }
    }

    /** A player's preference edit cannot cross a profile/source change or overwrite language intent. */
    @Synchronized
    fun setCaptionAppearance(session: LocalPlaybackSession, size: CaptionSizePreference, style: CaptionStylePreference) {
        check(session.isAllowed(snapshot)) { "Playback access changed" }
        val previous = snapshot.profiles.getValue(session.profileId).playbackPreferences
        setPlaybackPreferences(session.profileId, previous.copy(captionSize = size, captionStyle = style))
    }

    @Synchronized
    fun setTasteSeeds(profileId: String, seeds: Set<String>) {
        val clean = seeds.map(String::trim).filter(String::isNotEmpty).toSet()
        require(clean.all { it.length <= 128 }) { "Taste seed identifier is too long" }
        updateProfile(profileId) {
            require(it.onboardingStep.ordinal >= OnboardingStep.TASTE.ordinal) { "Taste step is not current" }
            it.copy(tasteSeeds = clean, onboardingStep = advance(it.onboardingStep, OnboardingStep.TASTE))
        }
    }

    /** Continue calibration using the reactions and optional seeds already collected. */
    @Synchronized
    fun finishTaste(profileId: String) {
        updateProfile(profileId) {
            require(it.onboardingStep == OnboardingStep.TASTE) { "Taste step is not current" }
            it.copy(onboardingStep = OnboardingStep.SOURCES)
        }
    }

    @Synchronized
    fun confirmDefaultSources(profileId: String) {
        val profile = profile(profileId)
        require(profile.onboardingStep == OnboardingStep.SOURCES) { "Sources step is not current" }
        val defaults = mapOf(
            PERSONAL_SOURCE_ID to SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PERSONAL, SourceStatus.AVAILABLE),
            PUBLIC_DOMAIN_SOURCE_ID to SourceRecord(PUBLIC_DOMAIN_SOURCE_ID, SourceKind.PUBLIC_DOMAIN, SourceStatus.AVAILABLE),
        )
        publish(snapshot.copy(
            profiles = snapshot.profiles + (profileId to profile.copy(onboardingStep = OnboardingStep.HOME)),
            sources = defaults + snapshot.sources,
        ))
    }

    /** Passing null chooses a fully functional standalone node. */
    @Synchronized
    fun chooseHome(profileId: String, homeId: String?) {
        val profile = profile(profileId)
        require(profile.onboardingStep == OnboardingStep.HOME) { "Home step is not current" }
        val clean = homeId?.trim()?.takeIf(String::isNotEmpty)
        require(clean == null || clean.length <= 128) { "Home identifier is too long" }
        publish(snapshot.copy(
            profiles = snapshot.profiles + (profileId to profile.copy(onboardingStep = OnboardingStep.COMPLETE)),
            requestedHomeId = clean,
        ))
    }

    @Synchronized
    fun back(profileId: String) {
        updateProfile(profileId) {
            val prior = when (it.onboardingStep) {
                OnboardingStep.IDENTITY -> OnboardingStep.IDENTITY
                OnboardingStep.ATMOSPHERE -> OnboardingStep.IDENTITY
                OnboardingStep.CURATOR -> OnboardingStep.ATMOSPHERE
                OnboardingStep.TASTE -> OnboardingStep.CURATOR
                OnboardingStep.SOURCES -> OnboardingStep.TASTE
                OnboardingStep.HOME -> OnboardingStep.SOURCES
                OnboardingStep.COMPLETE -> OnboardingStep.COMPLETE
            }
            it.copy(onboardingStep = prior)
        }
    }

    fun canEnterHome(profileId: String): Boolean =
        profile(profileId).onboardingStep == OnboardingStep.COMPLETE

    @Synchronized
    fun setReaction(profileId: String, itemId: String, kind: ReactionKind?) {
        requireId(itemId)
        updateProfile(profileId) { p ->
            val positive = p.positiveReactions - itemId
            p.copy(
                positiveReactions = if (kind == ReactionKind.LIKE || kind == ReactionKind.LOVE || kind == ReactionKind.COZY)
                    positive + (itemId to kind) else positive,
                dismissedIds = (p.dismissedIds - itemId) + if (kind == ReactionKind.DISMISS) setOf(itemId) else emptySet(),
                lessLikeIds = (p.lessLikeIds - itemId) + if (kind == ReactionKind.LESS) setOf(itemId) else emptySet(),
            )
        }
    }

    fun reactionFor(profileId: String, itemId: String): ReactionKind? {
        val p = profile(profileId)
        return when {
            itemId in p.dismissedIds -> ReactionKind.DISMISS
            itemId in p.lessLikeIds -> ReactionKind.LESS
            else -> p.positiveReactions[itemId]
        }
    }

    /** Native Home only. Library and explicit search retain the complete catalog. */
    @Synchronized
    fun rankedHomeMedia(profileId: String): List<MediaRecord> {
        val person = profile(profileId)
        val candidates = snapshot.media.values
            .sortedWith(compareBy<MediaRecord>({ it.title.lowercase() }, { it.id }))
            .take(2048)
        return taste.rank(person, candidates)
    }

    @Synchronized
    fun tasteRankingTrace(profileId: String): TasteRankingTrace? = taste.lastTrace(profileId)

    @Synchronized
    fun save(profileId: String, mediaId: String, saved: Boolean) {
        requireId(mediaId)
        updateProfile(profileId) {
            it.copy(savedMediaIds = if (saved) it.savedMediaIds + mediaId else it.savedMediaIds - mediaId)
        }
    }

    @Synchronized
    fun setPlaybackPosition(profileId: String, mediaId: String, positionMs: Long) {
        requireId(mediaId)
        require(positionMs >= 0) { "Position cannot be negative" }
        updateProfile(profileId) {
            it.copy(playbackPositionsMs = it.playbackPositionsMs + (mediaId to positionMs))
        }
    }

    @Synchronized
    fun setReadingPosition(profileId: String, bookId: String, position: String) {
        requireId(bookId)
        require(position.length <= 512) { "Reading position is too long" }
        updateProfile(profileId) {
            it.copy(readingPositions = it.readingPositions + (bookId to position))
        }
    }

    @Synchronized
    fun putSource(source: SourceRecord) {
        requireId(source.id)
        require(source.kind != SourceKind.OPTIONAL_ADAPTER) { "Use the optional source registration boundary" }
        require((source.kind == SourceKind.PERSONAL && source.id == PERSONAL_SOURCE_ID) ||
            (source.kind == SourceKind.PUBLIC_DOMAIN && source.id == PUBLIC_DOMAIN_SOURCE_ID)) {
            "Built-in sources require their reserved identity"
        }
        require(snapshot.sources[source.id]?.kind?.let { it == source.kind } ?: true) { "Source kind cannot change" }
        publish(snapshot.copy(sources = snapshot.sources + (source.id to source)))
    }

    /** Trusted optional adapters report availability after their own access checks. */
    @Synchronized
    fun putOptionalSource(sourceId: String, status: SourceStatus) {
        requireId(sourceId)
        require(sourceId != PERSONAL_SOURCE_ID && sourceId != PUBLIC_DOMAIN_SOURCE_ID) { "Built-in source identity is reserved" }
        require(snapshot.sources[sourceId]?.kind?.let { it == SourceKind.OPTIONAL_ADAPTER } ?: true) { "Source kind cannot change" }
        publish(snapshot.copy(sources = snapshot.sources + (sourceId to SourceRecord(sourceId, SourceKind.OPTIONAL_ADAPTER, status))))
    }

    /** External-app experiments only; source authority is validated and revoked independently. */
    @Synchronized
    fun setExperimentalHandoffsEnabled(enabled: Boolean) {
        repeat(3) { attempt ->
            try {
                publish(snapshot.copy(experimentalHandoffsEnabled = enabled))
                return
            } catch (stale: ConcurrentModificationException) {
                snapshot = validateCoreState(store.load())
                if (attempt == 2) throw stale
            }
        }
    }

    @Synchronized
    fun revokeSource(sourceId: String) {
        val source = snapshot.sources[sourceId] ?: return
        publish(snapshot.copy(sources = snapshot.sources + (sourceId to source.copy(status = SourceStatus.REVOKED))))
    }

    @Synchronized
    fun putMedia(item: MediaRecord) {
        requireId(item.id)
        require(item.title.isNotBlank() && item.title.length <= 512) { "Invalid media title" }
        publish(snapshot.copy(media = snapshot.media + (item.id to item)))
    }

    fun mediaAction(mediaId: String): MediaAction {
        val item = snapshot.media[mediaId] ?: return MediaAction.UNAVAILABLE
        val source = item.sourceId?.let(snapshot.sources::get)
        if (item.availability == MediaAvailability.METADATA_ONLY) return MediaAction.FIND
        if (item.availability == MediaAvailability.UNAVAILABLE) return MediaAction.UNAVAILABLE
        if (source == null) return MediaAction.UNAVAILABLE
        if (source.status != SourceStatus.AVAILABLE) return MediaAction.UNAVAILABLE
        return if (item.availability == MediaAvailability.PREPARING) MediaAction.PREPARING else MediaAction.PLAY
    }

    private fun profile(id: String): ProfileState = snapshot.profiles[id] ?: error("Unknown profile")

    private fun updateProfile(id: String, transform: (ProfileState) -> ProfileState) {
        val changed = transform(profile(id))
        publish(snapshot.copy(profiles = snapshot.profiles + (id to changed)))
    }

    private fun publish(next: CoreState) {
        val epochs = snapshot.playbackEpochs.toMutableMap()
        fun bump(key: String) { epochs[key] = Math.addExact(epochs[key] ?: 0L, 1L) }
        if (next.activeProfileId != snapshot.activeProfileId ||
            next.activeProfile?.onboardingStep != snapshot.activeProfile?.onboardingStep) bump(PlaybackEpoch.PROFILE)
        if (next.sources !== snapshot.sources) {
            (snapshot.sources.keys + next.sources.keys).forEach { id ->
                if (snapshot.sources[id] != next.sources[id]) bump(PlaybackEpoch.source(id))
            }
        }
        if (next.media !== snapshot.media) {
            (snapshot.media.keys + next.media.keys).forEach { id ->
                val old = snapshot.media[id]
                val updated = next.media[id]
                if (old?.sourceId != updated?.sourceId || old?.availability != updated?.availability) bump(PlaybackEpoch.media(id))
            }
        }
        val validated = validateCoreState(next.copy(revision = Math.addExact(snapshot.revision, 1), playbackEpochs = epochs))
        store.save(validated)
        snapshot = validated
    }

    private fun advance(current: OnboardingStep, expected: OnboardingStep): OnboardingStep =
        if (current == expected) OnboardingStep.entries[current.ordinal + 1] else current

    private fun requireId(id: String) {
        require(id.isNotBlank() && id.length <= 128) { "Invalid identifier" }
    }
}
