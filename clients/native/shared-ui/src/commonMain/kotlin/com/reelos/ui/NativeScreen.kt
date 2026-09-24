package com.reelos.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class UiStep { IDENTITY, ATMOSPHERE, CURATOR, TASTE, SOURCES, HOME, COMPLETE }
enum class UiAction { PLAY, FIND, PREPARING, UNAVAILABLE }
data class UiMedia(val id: String, val title: String, val action: UiAction, val saved: Boolean, val reaction: String?, val positionMs: Long = 0L)
data class UiTasteSubject(val id: String, val title: String, val reaction: String?, val context: String = "")
data class UiProfile(val id: String, val name: String, val color: String)
data class UiModel(
    val profileId: String?,
    val profiles: List<UiProfile>,
    val name: String?,
    val color: String,
    val step: UiStep,
    val media: List<UiMedia>,
    val tasteSubjects: List<UiTasteSubject>,
    val tasteSeeds: Set<String>,
    val homeMediaIds: List<String>,
    val guidance: String,
    val destinations: List<String>,
    val experimentalHandoffsEnabled: Boolean,
    val buildVersion: String,
    val motionMode: String,
    val effectiveMotion: String,
    val browsingDensity: String,
    val transparencyEnabled: Boolean,
    val error: String? = null,
)

sealed interface UiEvent {
    data class Name(val value: String) : UiEvent
    data class ColorChoice(val value: String) : UiEvent
    data class ContinueCurator(val guidance: String) : UiEvent
    data class Taste(val ids: Set<String>) : UiEvent
    data object ConfirmSources : UiEvent
    data object ContinueStandalone : UiEvent
    data object Back : UiEvent
    data object Import : UiEvent
    data class Play(val id: String) : UiEvent
    data class Save(val id: String, val saved: Boolean) : UiEvent
    data class React(val id: String, val reaction: String?) : UiEvent
    data class SetExperimentalHandoffs(val enabled: Boolean) : UiEvent
    data class SelectProfile(val id: String) : UiEvent
    data class CreateProfile(val name: String) : UiEvent
    data class Appearance(val motion: String? = null, val density: String? = null, val toggleTransparency: Boolean = false) : UiEvent
    data object FinishTaste : UiEvent
}

internal val canvas = Color(0xFF080809)
internal val surface = Color(0xFF17171C)
internal val muted = Color(0xFFB9B9C3)
internal val LocalTransparency = staticCompositionLocalOf { true }
internal val LocalCompact = staticCompositionLocalOf { false }
internal val palette = listOf(
    "#7357A6" to Color(0xFF9866D9), "#376FE4" to Color(0xFF376FE4),
    "#0D9990" to Color(0xFF0D9990), "#659E46" to Color(0xFF659E46),
    "#D39328" to Color(0xFFD39328), "#D56A4A" to Color(0xFFD56A4A),
    "#C65BA1" to Color(0xFFC65BA1), "#657BB3" to Color(0xFF657BB3),
)
internal val colorNames = listOf("Violet", "Blue", "Teal", "Moss", "Amber", "Coral", "Rose", "Slate")

@Composable
fun NativeScreen(model: UiModel, motionAllowed: Boolean = true, backRevision: Int = 0,
    onBackAvailabilityChanged: (Boolean) -> Unit = {}, connectionContent: (@Composable () -> Unit)? = null,
    onEvent: (UiEvent) -> Unit) {
    var nameDraft by remember(model.profileId, model.name) { mutableStateOf(model.name.orEmpty()) }
    var colorDraft by remember(model.profileId, model.color) { mutableStateOf(model.color) }
    var guidanceDraft by remember(model.name, model.guidance) { mutableStateOf(model.guidance) }
    var query by remember(model.profileId) { mutableStateOf("") }
    var destination by remember(model.profileId) { mutableStateOf("HOME") }
    var advancedOpen by remember(model.profileId) { mutableStateOf(false) }
    // A new destination/person starts at its entry controls, never a prior screen's scroll offset.
    val destinationScroll = remember(model.profileId, model.step, destination, advancedOpen) { LazyListState() }
    SideEffect { onBackAvailabilityChanged((model.step != UiStep.IDENTITY && model.step != UiStep.COMPLETE) || destination != "HOME") }
    var seenBackRevision by remember { mutableIntStateOf(backRevision) }
    LaunchedEffect(backRevision) {
        if (backRevision != seenBackRevision) {
            seenBackRevision = backRevision
            if (model.step == UiStep.COMPLETE) {
                if (advancedOpen) advancedOpen = false else destination = if (destination == "TASTE" || destination == "PEOPLE") "PROFILE" else "HOME"
            }
            else if (model.step != UiStep.IDENTITY) onEvent(UiEvent.Back)
        }
    }
    val activeColor = if (model.step == UiStep.ATMOSPHERE) colorDraft else model.color
    val accent = palette.firstOrNull { it.first.equals(activeColor, ignoreCase = true) }?.second ?: palette.first().second
    val showingTaste = model.step == UiStep.TASTE || destination == "TASTE"
    val auraAlpha = if (!showingTaste && motionAllowed && model.effectiveMotion != "STILL") {
        val breathing = rememberInfiniteTransition(label = "Personal atmosphere")
        val expressive = model.effectiveMotion == "EXPRESSIVE"
        breathing.animateFloat(if (expressive) 0.20f else 0.26f, if (expressive) 0.42f else 0.32f,
            infiniteRepeatable(tween(if (expressive) 4200 else 7000), RepeatMode.Reverse), label = "Breathing color")
    } else remember { mutableStateOf(0.29f) }
    val byId = model.media.associateBy { it.id }
    val content = if (query.isBlank()) model.homeMediaIds.mapNotNull(byId::get)
        else model.media.filter { it.title.contains(query.trim(), ignoreCase = true) }

    MaterialTheme(colorScheme = darkColorScheme(primary = Color.White, surface = surface, background = canvas, onSurface = Color.White)) {
    CompositionLocalProvider(LocalTransparency provides model.transparencyEnabled, LocalCompact provides (model.browsingDensity == "COMPACT")) {
    if (showingTaste) {
        NativeTasteField(model, accent, motionAllowed && model.effectiveMotion != "STILL",
            onExit = { if (model.step == UiStep.TASTE) onEvent(UiEvent.FinishTaste) else destination = "PROFILE" },
            onBack = { if (model.step == UiStep.TASTE) onEvent(UiEvent.Back) else destination = "PROFILE" }, onEvent = onEvent)
    } else {
    LazyColumn(
        state = destinationScroll,
        // Read animation during drawing, not composition: the whole catalog must not recompose each frame.
        modifier = Modifier.fillMaxSize().background(canvas).drawBehind {
            drawRect(Brush.radialGradient(listOf(accent.copy(alpha = auraAlpha.value), canvas, canvas), radius = size.maxDimension.coerceAtLeast(1f)))
        }.onPreviewKeyEvent {
            if (it.type == KeyEventType.KeyDown && (it.key == Key.Escape || it.key == Key.Back)) {
                if (model.step != UiStep.COMPLETE || destination != "HOME") {
                    if (model.step == UiStep.COMPLETE) {
                        if (advancedOpen) advancedOpen = false else destination = if (destination == "PEOPLE") "PROFILE" else "HOME"
                    } else onEvent(UiEvent.Back)
                    true
                } else false
            } else false
        },
        contentPadding = androidx.compose.foundation.layout.PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(if (LocalCompact.current) 10.dp else 18.dp),
    ) {
        if (model.error != null) item { Panel { Text(model.error, color = Color(0xFFFFC7B9)); Spacer(Modifier.height(8.dp)); Text("Please try again.", color = muted) } }
        if (model.step != UiStep.COMPLETE) {
            item {
                if (model.step != UiStep.IDENTITY) ReelButton("Back", accent, onClick = { onEvent(UiEvent.Back) })
            }
            when (model.step) {
                UiStep.IDENTITY -> item {
                    Text("A cinema that feels like yours.", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    Text("What should we call you?", color = muted)
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(value = nameDraft, onValueChange = { nameDraft = it.take(80) }, label = { Text("Your name") }, singleLine = true, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done), modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(16.dp))
                    ReelButton("Continue", accent, enabled = nameDraft.isNotBlank()) { onEvent(UiEvent.Name(nameDraft)) }
                }
                UiStep.ATMOSPHERE -> item {
                    Text("Make it yours, ${model.name}.", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                    Text("Choose the color that feels like home.", color = muted)
                    Spacer(Modifier.height(16.dp))
                    palette.forEachIndexed { index, (hex, shade) ->
                        ReelButton("${colorNames[index]}${if (hex == colorDraft) " · selected" else ""}", shade, selected = hex == colorDraft) { colorDraft = hex }
                        Spacer(Modifier.height(8.dp))
                    }
                    ReelButton("Continue", accent) { onEvent(UiEvent.ColorChoice(colorDraft)) }
                }
                UiStep.CURATOR -> item {
                    Text("Your way to discover.", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                    Text("Choose how much guidance you'd like. Your choice is saved; personal suggestions are still in development.", color = muted)
                    Spacer(Modifier.height(12.dp))
                    listOf("GUIDED" to "Show me around", "BALANCED" to "Balanced", "INDEPENDENT" to "I'll find my way").forEach { (value, label) ->
                        ReelButton(label, accent, selected = guidanceDraft == value) { guidanceDraft = value }
                        Spacer(Modifier.height(8.dp))
                    }
                    ReelButton("Continue", accent) { onEvent(UiEvent.ContinueCurator(guidanceDraft)) }
                }
                UiStep.TASTE -> Unit // The full-screen field above owns this step.
                UiStep.SOURCES -> item {
                    Text("Bring your collection.", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                    Text("Start with personal media. Public-domain titles can appear when a source adds them.", color = muted)
                    Spacer(Modifier.height(16.dp))
                    connectionContent?.invoke() ?: Text("External media connections are unavailable on this device.", color = muted)
                    Spacer(Modifier.height(20.dp))
                    ReelButton("Continue", accent) { onEvent(UiEvent.ConfirmSources) }
                }
                UiStep.HOME -> item {
                    Text("Your own space.", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                    Text("Continue on this device. Connecting to a Home is not available in this build.", color = muted)
                    Spacer(Modifier.height(20.dp))
                    ReelButton("Continue on this device", accent) { onEvent(UiEvent.ContinueStandalone) }
                }
                UiStep.COMPLETE -> Unit
            }
        } else {
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    model.destinations.forEach { target ->
                        ReelButton(target.lowercase().replaceFirstChar { it.uppercase() }, accent, selected = destination == target, compact = true) {
                            destination = target
                            advancedOpen = false
                        }
                    }
                    ReelButton(model.name ?: "You", accent, selected = destination == "PROFILE", compact = true) { destination = "PROFILE"; advancedOpen = false }
                }
            }
            if (destination != "HOME") item {
                ReelButton(if (advancedOpen) "Back to Settings" else "Back to Home", accent) {
                    if (advancedOpen) advancedOpen = false else destination = "HOME"
                }
            }
            when (destination) {
                "PROFILE" -> item {
                    PersonalView(model, accent, onTaste = { destination = "TASTE" }, onPeople = { destination = "PEOPLE" }, onEvent = onEvent)
                }
                "PEOPLE" -> item { ProfilePicker(model, accent) { event ->
                    onEvent(event)
                    if (event is UiEvent.SelectProfile) destination = if (event.id == model.profileId) "PROFILE" else "HOME"
                } }
                "HOME" -> {
                    item {
                        Panel {
                            Text("Welcome back, ${model.name}.", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(10.dp))
                            Text(if (model.media.isEmpty()) "Your collection starts here." else "Your own collection, ready to explore.", color = muted)
                            Spacer(Modifier.height(18.dp))
                            ReelButton("Add personal media", accent) { onEvent(UiEvent.Import) }
                        }
                    }
                    item { SearchField(query, { query = it }) }
                    item { Text(if (query.isBlank()) "Your titles" else "Search results", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold) }
                    if (content.isEmpty()) item { Panel { Text(if (query.isBlank()) "No titles yet. Add personal media to begin." else "No titles match your search.", color = muted) } }
                    items(content, key = { it.id }) { MediaCard(it, accent, onEvent) }
                }
                "LIBRARY" -> {
                    item { Text("Saved", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold) }
                    val saved = model.media.filter { it.saved }
                    if (saved.isEmpty()) item { Panel { Text("Nothing saved yet.", color = muted) } }
                    items(saved, key = { it.id }) { MediaCard(it, accent, onEvent) }
                }
                else -> item {
                    Panel {
                        if (advancedOpen) {
                            Text("Advanced settings", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(10.dp))
                            Text("Try supported external-app handoffs as they become available. This does not change your media connections.", color = muted)
                            Spacer(Modifier.height(14.dp))
                            ReelButton(if (model.experimentalHandoffsEnabled) "Turn handoff experiments off" else "Try handoff experiments", accent) {
                                onEvent(UiEvent.SetExperimentalHandoffs(!model.experimentalHandoffsEnabled))
                            }
                            if (model.experimentalHandoffsEnabled) {
                                Spacer(Modifier.height(16.dp))
                                Text("External-app handoffs", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                                Text("No handoff integration is available in this build yet.", color = muted)
                            }
                        } else {
                            Text("Settings", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(16.dp))
                            AppearanceControls(model, accent, onEvent)
                            Spacer(Modifier.height(10.dp))
                            Text("Your personal collection stays on this device. Home connections and family controls are still in development.", color = muted)
                            Spacer(Modifier.height(12.dp))
                            Text("Media connections", color = Color.White, fontSize = 20.sp)
                            connectionContent?.invoke() ?: Text("External media connections are unavailable on this device.", color = muted)
                            Spacer(Modifier.height(12.dp))
                            ReelButton("Add personal media", accent) { onEvent(UiEvent.Import) }
                            Spacer(Modifier.height(12.dp))
                            ReelButton("Advanced settings", accent) { advancedOpen = true }
                            Spacer(Modifier.height(16.dp))
                            Text(model.buildVersion, color = muted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
    }
    }
    }
}

@Composable private fun SearchField(value: String, onValue: (String) -> Unit) {
    OutlinedTextField(value = value, onValueChange = onValue, label = { Text("Search your titles") }, singleLine = true, modifier = Modifier.fillMaxWidth())
}

@Composable private fun MediaCard(media: UiMedia, accent: Color, onEvent: (UiEvent) -> Unit) {
    var reactionsOpen by remember(media.id) { mutableStateOf(false) }
    Panel {
        Text(media.title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        Text(when (media.action) {
            UiAction.PLAY -> "On this device"
            UiAction.FIND -> "Title information only · no playable source"
            UiAction.PREPARING -> "Preparing · not ready to play"
            UiAction.UNAVAILABLE -> "Source unavailable"
        }, color = muted)
        Spacer(Modifier.height(12.dp))
        if (media.action == UiAction.PLAY) {
            ReelButton(if (media.positionMs > 0) "Resume" else "Play", accent) { onEvent(UiEvent.Play(media.id)) }
            Spacer(Modifier.height(8.dp))
        }
        if (media.saved || media.action == UiAction.PLAY) {
            ReelButton(if (media.saved) "Remove from saved" else "Save", accent) { onEvent(UiEvent.Save(media.id, !media.saved)) }
        }
        Spacer(Modifier.height(8.dp))
        ReelButton(if (reactionsOpen) "Close reactions" else media.reaction?.lowercase()?.replaceFirstChar { it.uppercase() } ?: "Your reaction", accent, compact = true) {
            reactionsOpen = !reactionsOpen
        }
        if (reactionsOpen) {
            Spacer(Modifier.height(8.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("LIKE" to "Like", "LOVE" to "Love", "COZY" to "Cozy", "LESS" to "Less like this", "DISMISS" to "Not sure").forEach { (value, label) ->
                    ReelButton(if (media.reaction == value) "$label · selected" else label, accent, selected = media.reaction == value, compact = true) {
                        onEvent(UiEvent.React(media.id, if (media.reaction == value) null else value))
                    }
                }
            }
        }
    }
}

@Composable internal fun Panel(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().background(surface.copy(alpha = if (LocalTransparency.current) 0.76f else 1f), RoundedCornerShape(22.dp)).padding(if (LocalCompact.current) 14.dp else 20.dp), content = content)
}

@Composable internal fun ReelButton(label: String, accent: Color, enabled: Boolean = true, selected: Boolean = false, compact: Boolean = false, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val lit = focused || selected
    Box(
        Modifier.then(if (compact) Modifier else Modifier.fillMaxWidth())
            .heightIn(min = 52.dp)
            .background(if (lit) Color.White else accent.copy(alpha = if (enabled) 0.34f else 0.12f), RoundedCornerShape(16.dp))
            .border(if (focused) 3.dp else 1.dp, if (focused) accent else Color.White.copy(alpha = 0.16f), RoundedCornerShape(16.dp))
            .onFocusChanged { focused = it.isFocused }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (lit) canvas else if (enabled) Color.White else muted, fontWeight = FontWeight.SemiBold) }
}
