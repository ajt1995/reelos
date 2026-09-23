package com.reelos.presentation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.reelos.core.GuidanceLevel
import com.reelos.core.ReactionKind
import com.reelos.core.ReelCore
import com.reelos.ui.NativeScreen
import com.reelos.ui.UiAction
import com.reelos.ui.UiEvent
import com.reelos.ui.UiMedia
import com.reelos.ui.UiModel
import com.reelos.ui.UiStep
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
) {
    var revision by remember(core) { mutableIntStateOf(0) }
    var error by remember(core) { mutableStateOf<String?>(null) }
    val model = remember(core, revision, hostRevision, error) {
        val state = core.snapshot
        val profile = state.activeProfile
        UiModel(
            name = profile?.name,
            color = profile?.color ?: "#7357A6",
            step = profile?.onboardingStep?.let { UiStep.valueOf(it.name) } ?: UiStep.IDENTITY,
            guidance = profile?.guidance?.name ?: GuidanceLevel.BALANCED.name,
            tasteSeeds = profile?.tasteSeeds ?: emptySet(),
            destinations = core.navigation().map { it.name }.filter { it == "HOME" || it == "LIBRARY" || it == "SETTINGS" },
            media = state.media.values.sortedBy { it.title.lowercase() }.map { item ->
                UiMedia(
                    id = item.id,
                    title = item.title,
                    action = UiAction.valueOf(core.mediaAction(item.id).name),
                    saved = profile?.savedMediaIds?.contains(item.id) == true,
                    reaction = profile?.let { core.reactionFor(it.id, item.id)?.name },
                )
            },
            error = error,
        )
    }
    NativeScreen(model, motionAllowed, backRevision, onBackAvailabilityChanged) { event ->
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
                    check(core.mediaAction(event.id).name == UiAction.PLAY.name) { "This title is not ready to save" }
                    core.save(requireNotNull(profileId), event.id, event.saved)
                }
                is UiEvent.React -> core.setReaction(requireNotNull(profileId), event.id, event.reaction?.let(ReactionKind::valueOf))
            }
            error = null
            revision++
        } catch (failure: Exception) {
            error = failure.message?.take(180) ?: "That change could not be saved."
        }
    }
}
