package com.reelos.presentation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.reelos.core.GuidanceLevel
import com.reelos.core.DeviceKind
import com.reelos.core.intelligence.NativeTasteCatalog
import com.reelos.core.MotionMode
import com.reelos.core.BrowsingDensity
import com.reelos.core.SubtitleMode
import com.reelos.ui.UiLanguage
import java.util.Locale
import com.reelos.core.effectiveMotionMode
import com.reelos.core.ReactionKind
import com.reelos.core.ReelCore
import com.reelos.ui.NativeScreen
import com.reelos.ui.UiAction
import com.reelos.ui.UiEvent
import com.reelos.ui.UiMedia
import com.reelos.ui.UiModel
import com.reelos.ui.UiStep
import com.reelos.ui.UiProfile
import com.reelos.ui.UiTasteSubject
import java.util.ConcurrentModificationException
import java.util.UUID

/** JVM bridge shared by the Android and desktop hosts. Host callbacks supply native import/play. */
@Composable
fun NativeExperience(
    core: ReelCore,
    onImport: () -> Unit,
    onPlay: (String) -> Unit,
    hostRevision: Int = 0,
    motionAllowed: Boolean = true,
    backRevision: Int = 0,
    onBackAvailabilityChanged: (Boolean) -> Unit = {},
    connection: com.reelos.providers.ProviderConnectionController? = null,
    onProviderPlay: ((com.reelos.providers.ProviderVideo) -> Unit)? = null,
    onConnectionChanged: () -> Unit = {},
) {
    var revision by remember(core) { mutableIntStateOf(0) }
    var error by remember(core) { mutableStateOf<String?>(null) }
    val model = remember(core, revision, hostRevision, error, motionAllowed) {
        val state = core.snapshot
        val profile = state.activeProfile
        UiModel(
            profileId = profile?.id,
            profiles = state.profiles.values.map { UiProfile(it.id, it.name, it.color) },
            name = profile?.name,
            color = profile?.color ?: "#7357A6",
            step = profile?.onboardingStep?.let { UiStep.valueOf(it.name) } ?: UiStep.IDENTITY,
            guidance = profile?.guidance?.name ?: GuidanceLevel.BALANCED.name,
            experimentalHandoffsEnabled = state.experimentalHandoffsEnabled,
            buildVersion = com.reelos.core.NativeBuildInfo.current.displayVersion,
            motionMode = profile?.motionMode?.name ?: "SUBTLE",
            effectiveMotion = profile?.let { effectiveMotionMode(it, motionAllowed, !core.canEnterHome(it.id)).name } ?: if (motionAllowed) "EXPRESSIVE" else "STILL",
            browsingDensity = profile?.browsingDensity?.name ?: "COMFORTABLE",
            transparencyEnabled = profile?.transparencyEnabled ?: true,
            audioLanguage = profile?.playbackPreferences?.audioLanguage,
            subtitleLanguage = profile?.playbackPreferences?.subtitleLanguage,
            subtitleMode = profile?.playbackPreferences?.subtitleMode?.name ?: "AUTO",
            languages = playbackLanguages,
            tasteSeeds = profile?.tasteSeeds ?: emptySet(),
            homeMediaIds = profile?.let { core.rankedHomeMedia(it.id).map { item -> item.id } } ?: emptyList(),
            destinations = core.navigation().map { it.name }.filter { it == "HOME" || it == "LIBRARY" || it == "SETTINGS" },
            media = state.media.values.sortedBy { it.title.lowercase() }.map { item ->
                UiMedia(
                    id = item.id,
                    title = item.title,
                    action = UiAction.valueOf(core.mediaAction(item.id).name),
                    saved = profile?.savedMediaIds?.contains(item.id) == true,
                    reaction = profile?.let { core.reactionFor(it.id, item.id)?.name },
                    positionMs = profile?.playbackPositionsMs?.get(item.id) ?: 0L,
                )
            },
            tasteSubjects = run {
                val subjects = NativeTasteCatalog.subjects(includeBooks = core.deviceKind != DeviceKind.ANDROID_TV)
                // Interleave titles, actors and illustrated-by-example moods without inventing media access.
                val titles = subjects.filter { it.kind in setOf("movie", "series", "book") }
                val actors = subjects.filter { it.kind == "person" }
                val moods = subjects.filter { it.kind == "mood" }
                val mixed = buildList {
                    titles.chunked(4).forEachIndexed { index, chunk ->
                        addAll(chunk)
                        actors.getOrNull(index)?.let(::add)
                        moods.getOrNull(index)?.let(::add)
                    }
                }
                (state.media.values.map { UiTasteSubject(it.id, it.title, profile?.let { p -> core.reactionFor(p.id, it.id)?.name }) } +
                    mixed.map { item -> UiTasteSubject(item.id, item.title, profile?.let { core.reactionFor(it.id, item.id)?.name },
                        when (item.kind) { "person" -> "Actor"; "mood" -> item.examples.joinToString(" · "); "book" -> "Book"; else -> "" }) })
                    .distinctBy { it.id }
            },
            error = error,
        )
    }
    NativeScreen(model, motionAllowed, backRevision, onBackAvailabilityChanged,
        connectionContent = { NativeConnectionPanel(connection, onProviderPlay, onConnectionChanged) }) { event ->
        val profileId = core.snapshot.activeProfileId
        try {
            when (event) {
                is UiEvent.Name -> {
                    if (profileId == null) core.createProfile(UUID.randomUUID().toString(), event.value)
                    else core.setName(profileId, event.value)
                }
                is UiEvent.ColorChoice -> core.setColor(requireNotNull(profileId), event.value)
                is UiEvent.ContinueCurator -> core.acknowledgeCurator(requireNotNull(profileId), GuidanceLevel.valueOf(event.guidance))
                is UiEvent.Taste -> core.setTasteSeeds(requireNotNull(profileId), event.ids)
                UiEvent.ConfirmSources -> core.confirmDefaultSources(requireNotNull(profileId))
                UiEvent.ContinueStandalone -> core.chooseHome(requireNotNull(profileId), null)
                UiEvent.Back -> if (profileId != null) core.back(profileId)
                UiEvent.Import -> onImport()
                is UiEvent.Play -> {
                    check(core.mediaAction(event.id).name == UiAction.PLAY.name) { "This title is not ready to play" }
                    onPlay(event.id)
                }
                is UiEvent.Save -> {
                    val activeId = requireNotNull(profileId)
                    if (event.saved) {
                        check(core.mediaAction(event.id).name == UiAction.PLAY.name) { "This title is not available to save" }
                    } else {
                        check(event.id in core.snapshot.profiles.getValue(activeId).savedMediaIds) { "This title is not saved" }
                    }
                    core.save(activeId, event.id, event.saved)
                }
                is UiEvent.React -> core.setReaction(requireNotNull(profileId), event.id, event.reaction?.let(ReactionKind::valueOf))
                is UiEvent.SetExperimentalHandoffs -> core.setExperimentalHandoffsEnabled(event.enabled)
                is UiEvent.SelectProfile -> core.selectProfile(event.id)
                is UiEvent.CreateProfile -> {
                    val id = UUID.randomUUID().toString()
                    core.createProfile(id, event.name)
                    core.selectProfile(id)
                }
                is UiEvent.Appearance -> core.setAppearance(requireNotNull(profileId),
                    motionMode = event.motion?.let(MotionMode::valueOf),
                    browsingDensity = event.density?.let(BrowsingDensity::valueOf),
                    toggleTransparency = event.toggleTransparency)
                is UiEvent.AudioLanguage -> core.setPlaybackPreferences(requireNotNull(profileId),
                    core.snapshot.profiles.getValue(profileId).playbackPreferences.copy(audioLanguage = event.code))
                is UiEvent.SubtitleDefault -> core.setPlaybackPreferences(requireNotNull(profileId),
                    core.snapshot.profiles.getValue(profileId).playbackPreferences.copy(subtitleMode = SubtitleMode.valueOf(event.mode), subtitleLanguage = event.code))
                UiEvent.FinishTaste -> core.finishTaste(requireNotNull(profileId))
            }
            error = null
            revision++
        } catch (failure: Exception) {
            error = if (failure is ConcurrentModificationException) {
                "Other changes were saved. Review the current setting and try again."
            } else failure.message?.take(180) ?: "That change could not be saved."
            revision++ // A retry may have reloaded a newer snapshot even when persistence failed.
        }
    }
}

private val playbackLanguages by lazy {
    Locale.getISOLanguages().map { UiLanguage(it, Locale.forLanguageTag(it).getDisplayLanguage(Locale.getDefault())) }
        .sortedBy { it.label.lowercase(Locale.getDefault()) }
}
