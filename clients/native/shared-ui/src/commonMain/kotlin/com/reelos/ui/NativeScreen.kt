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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
data class UiMedia(val id: String, val title: String, val action: UiAction, val saved: Boolean, val reaction: String?)
data class UiModel(
    val name: String?,
    val color: String,
    val step: UiStep,
    val media: List<UiMedia>,
    val tasteSeeds: Set<String>,
    val guidance: String,
    val destinations: List<String>,
    val optionalProviderBetaEnabled: Boolean,
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
    data class SetOptionalProviderBeta(val enabled: Boolean) : UiEvent
}

private val canvas = Color(0xFF080809)
private val surface = Color(0xFF17171C)
private val muted = Color(0xFFB9B9C3)
private val palette = listOf(
    "#7357A6" to Color(0xFF9866D9), "#376FE4" to Color(0xFF376FE4),
    "#0D9990" to Color(0xFF0D9990), "#659E46" to Color(0xFF659E46),
    "#D39328" to Color(0xFFD39328), "#D56A4A" to Color(0xFFD56A4A),
    "#C65BA1" to Color(0xFFC65BA1), "#657BB3" to Color(0xFF657BB3),
)
private val colorNames = listOf("Violet", "Blue", "Teal", "Moss", "Amber", "Coral", "Rose", "Slate")

@Composable
fun NativeScreen(model: UiModel, motionAllowed: Boolean = true, backRevision: Int = 0,
    onBackAvailabilityChanged: (Boolean) -> Unit = {}, onEvent: (UiEvent) -> Unit) {
    var nameDraft by remember(model.name) { mutableStateOf(model.name.orEmpty()) }
    var colorDraft by remember(model.name, model.color) { mutableStateOf(model.color) }
    var seedDraft by remember(model.name, model.tasteSeeds) { mutableStateOf(model.tasteSeeds) }
    var guidanceDraft by remember(model.name, model.guidance) { mutableStateOf(model.guidance) }
    var query by remember { mutableStateOf("") }
    var destination by remember { mutableStateOf("HOME") }
    var advancedOpen by remember { mutableStateOf(false) }
    SideEffect { onBackAvailabilityChanged((model.step != UiStep.IDENTITY && model.step != UiStep.COMPLETE) || destination != "HOME") }
    var seenBackRevision by remember { mutableIntStateOf(backRevision) }
    LaunchedEffect(backRevision) {
        if (backRevision != seenBackRevision) {
            seenBackRevision = backRevision
            if (model.step == UiStep.COMPLETE) {
                if (advancedOpen) advancedOpen = false else destination = "HOME"
            }
            else if (model.step != UiStep.IDENTITY) onEvent(UiEvent.Back)
        }
    }
    val activeColor = if (model.step == UiStep.ATMOSPHERE) colorDraft else model.color
    val accent = palette.firstOrNull { it.first == activeColor }?.second ?: palette.first().second
    val auraAlpha = if (motionAllowed) {
        val breathing = rememberInfiniteTransition(label = "Personal atmosphere")
        val alpha by breathing.animateFloat(0.22f, 0.36f, infiniteRepeatable(tween(5600), RepeatMode.Reverse), label = "Breathing color")
        alpha
    } else 0.29f
    val content = model.media.filter { query.isBlank() || it.title.contains(query.trim(), ignoreCase = true) }

    MaterialTheme(colorScheme = darkColorScheme(primary = Color.White, surface = surface, background = canvas, onSurface = Color.White)) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(
            Brush.radialGradient(listOf(accent.copy(alpha = auraAlpha), canvas, canvas), radius = 900f)
        ).onPreviewKeyEvent {
            if (it.type == KeyEventType.KeyDown && (it.key == Key.Escape || it.key == Key.Back)) {
                if (model.step != UiStep.COMPLETE || destination != "HOME") {
                    if (model.step == UiStep.COMPLETE) {
                        if (advancedOpen) advancedOpen = false else destination = "HOME"
                    } else onEvent(UiEvent.Back)
                    true
                } else false
            } else false
        },
        contentPadding = androidx.compose.foundation.layout.PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
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
                UiStep.TASTE -> {
                    item {
                        Text("A few favorites?", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                        Text("Pick from your imported titles, or skip for now.", color = muted)
                    }
                    if (model.media.isEmpty()) item { Panel { Text("No titles here yet. You can add them after setup.", color = muted) } }
                    items(model.media, key = { it.id }) { media ->
                        ReelButton("${media.title}${if (media.id in seedDraft) " · selected" else ""}", accent, selected = media.id in seedDraft) {
                            seedDraft = if (media.id in seedDraft) seedDraft - media.id else seedDraft + media.id
                        }
                    }
                    item { ReelButton(if (seedDraft.isEmpty()) "Skip for now" else "Continue", accent) { onEvent(UiEvent.Taste(seedDraft)) } }
                }
                UiStep.SOURCES -> item {
                    Text("Bring your collection.", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                    Text("Start with personal media. Public-domain titles can appear when a source adds them.", color = muted)
                    if (model.optionalProviderBetaEnabled) {
                        Spacer(Modifier.height(16.dp))
                        Panel { Text("Optional external provider setup is unavailable. No adapter is installed in this build.", color = muted) }
                    }
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
                }
            }
            if (destination != "HOME") item {
                ReelButton(if (advancedOpen) "Back to Settings" else "Back to Home", accent) {
                    if (advancedOpen) advancedOpen = false else destination = "HOME"
                }
            }
            when (destination) {
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
                            Text("Upcoming external provider beta is off by default. This choice reveals setup only; it does not connect an account or grant access.", color = muted)
                            Spacer(Modifier.height(14.dp))
                            ReelButton(if (model.optionalProviderBetaEnabled) "Turn provider beta off" else "Turn provider beta on", accent) {
                                onEvent(UiEvent.SetOptionalProviderBeta(!model.optionalProviderBetaEnabled))
                            }
                            if (model.optionalProviderBetaEnabled) {
                                Spacer(Modifier.height(16.dp))
                                Text("Optional external provider setup", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                                Text("Unavailable · no adapter is installed in this build.", color = muted)
                            }
                        } else {
                            Text("Settings", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(10.dp))
                            Text("Your personal collection stays on this device. Home connections and family controls are still in development.", color = muted)
                            Spacer(Modifier.height(12.dp))
                            ReelButton("Add personal media", accent) { onEvent(UiEvent.Import) }
                            Spacer(Modifier.height(12.dp))
                            ReelButton("Advanced settings", accent) { advancedOpen = true }
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
            ReelButton("Play", accent) { onEvent(UiEvent.Play(media.id)) }
            Spacer(Modifier.height(8.dp))
        }
        if (media.saved || media.action == UiAction.PLAY) {
            ReelButton(if (media.saved) "Remove from saved" else "Save", accent) { onEvent(UiEvent.Save(media.id, !media.saved)) }
        }
        listOf("LIKE" to "Like", "LOVE" to "Love", "COZY" to "Cozy", "LESS" to "Less", "DISMISS" to "Dismiss").forEach { (value, label) ->
            ReelButton(if (media.reaction == value) "$label · selected" else label, accent, selected = media.reaction == value) {
                onEvent(UiEvent.React(media.id, if (media.reaction == value) null else value))
            }
            Spacer(Modifier.height(4.dp))
        }
    }
}

@Composable private fun Panel(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().background(surface, RoundedCornerShape(22.dp)).border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(22.dp)).padding(20.dp), content = content)
}

@Composable private fun ReelButton(label: String, accent: Color, enabled: Boolean = true, selected: Boolean = false, compact: Boolean = false, onClick: () -> Unit) {
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
