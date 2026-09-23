package com.reelos.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp

/** Stationary hit targets; only the inner light breathes. No form submission or page batches. */
@Composable internal fun NativeTasteField(model: UiModel, accent: Color, motionAllowed: Boolean,
    onExit: () -> Unit, onBack: () -> Unit, onEvent: (UiEvent) -> Unit) {
    var activeId by remember(model.profileId) { mutableStateOf<String?>(null) }
    var focusedSlot by remember(model.profileId) { mutableStateOf<Int?>(null) }
    val byId = model.tasteSubjects.associateBy { it.id }
    val active = activeId?.let(byId::get)
    BoxWithConstraints(Modifier.fillMaxSize().background(canvas)) {
    // A narrow display still needs two choices: one selected bubble must not pin the entire field.
    val narrow = maxWidth < 340.dp
    val fieldHeight = maxOf(maxHeight, if (narrow) 600.dp else 420.dp)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
    Column(Modifier.fillMaxWidth().height(fieldHeight).padding(20.dp).onPreviewKeyEvent {
        if (it.type == KeyEventType.KeyDown && (it.key == Key.Back || it.key == Key.Escape)) { onBack(); true } else false
    }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            ReelButton("Back", accent, compact = true, onClick = onBack)
            ReelButton(if (model.step == UiStep.TASTE) "Continue" else "Done", accent, compact = true, onClick = onExit)
        }
        Text("What pulls you in?", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Text("Tap to like. Tap again to love. Stay as long as you like.", color = muted)
        model.error?.let { Text(it, color = Color(0xFFFFC7B9)) }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            if (model.tasteSubjects.isEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Your collection is quiet for now.", color = Color.White, fontSize = 22.sp)
                    Text("Add your titles after setup, then return here whenever you feel like exploring.", color = muted)
                    if (model.step == UiStep.COMPLETE) ReelButton("Add personal media", accent) { onEvent(UiEvent.Import) }
                }
            } else {
                val columns = (maxWidth.value / 150f).toInt().coerceIn(1, 5)
                val rows = (maxHeight.value / 140f).toInt().coerceIn(if (columns == 1) 2 else 1, 4)
                val capacity = columns * rows
                val order = (model.homeMediaIds + model.tasteSubjects.map { it.id }).distinct()
                var slots by remember(model.profileId, capacity) { mutableStateOf(order.take(capacity)) }
                var visited by remember(model.profileId, capacity) { mutableStateOf(slots.toSet()) }
                val reactions = model.tasteSubjects.associate { it.id to it.reaction }
                LaunchedEffect(order, reactions, activeId, focusedSlot) {
                    val occupied = slots.toMutableSet()
                    val eligible = order.filter { it !in occupied && reactions[it] !in setOf("DISMISS", "LESS") }
                    val candidates = (eligible.filter { it !in visited } + eligible.filter { it in visited }).toMutableList()
                    val next = slots.mapIndexedNotNull { index, id ->
                        if (id !in byId || (id != activeId && index != focusedSlot && reactions[id] in setOf("LIKE", "LOVE", "COZY", "DISMISS", "LESS"))) {
                            if (candidates.isNotEmpty()) candidates.removeAt(0) else id.takeIf { it in byId }
                        } else id
                    }.toMutableList()
                    while (next.size < capacity && candidates.isNotEmpty()) next += candidates.removeAt(0)
                    slots = next
                    visited = visited + next
                }
                Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(rows) { row ->
                        Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            repeat(columns) { column ->
                                val index = row * columns + column
                                val item = slots.getOrNull(index)?.let(byId::get)
                                BoxWithConstraints(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) {
                                    if (item != null) TasteBubble(item, accent, motionAllowed, model.effectiveMotion == "EXPRESSIVE", index, minOf(maxWidth, maxHeight),
                                        onFocus = { focused -> if (focused) focusedSlot = index else if (focusedSlot == index) focusedSlot = null },
                                        onClick = {
                                            activeId = item.id
                                            onEvent(UiEvent.React(item.id, when (item.reaction) { "LIKE" -> "LOVE"; "LOVE" -> null; else -> "LIKE" }))
                                        })
                                }
                            }
                        }
                    }
                }
            }
        }
        // Reaction controls and exit never drift with the field or cover its hit targets.
        Column(Modifier.fillMaxWidth().heightIn(min = 92.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(active?.let { it.title + if (it.context.isNotBlank()) " · " + it.context else "" } ?: "Pick something to see more choices", color = muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("COZY" to "Cozy", "DISMISS" to "Dismiss", "LESS" to "Less like this", "RESET" to "Reset").forEach { (value, label) ->
                    ReelButton(label, accent, enabled = active != null, selected = active?.reaction == value, compact = true) {
                        active?.let { onEvent(UiEvent.React(it.id, if (value == "RESET" || it.reaction == value) null else value)) }
                        if (value == "DISMISS" || value == "LESS") activeId = null
                    }
                }
            }
        }
    }
    }
    }
}

@Composable private fun TasteBubble(item: UiTasteSubject, accent: Color, motionAllowed: Boolean, expressive: Boolean, index: Int, diameter: Dp,
    onFocus: (Boolean) -> Unit, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val phase = if (motionAllowed) {
        rememberInfiniteTransition(label = "Taste light").animateFloat(if (expressive) 0.46f else 0.6f, if (expressive) 0.88f else 0.7f,
            infiniteRepeatable(tween((if (expressive) 3600 else 6400) + index * 170), RepeatMode.Reverse), label = "Bubble glow")
    } else remember { mutableStateOf(0.65f) }
    val selected = item.reaction in setOf("LIKE", "LOVE", "COZY")
    Box(Modifier.size(diameter).clip(CircleShape)
        .drawBehind {
            drawCircle(if (focused) Color.White else canvas)
            if (!focused) drawCircle(Brush.radialGradient(listOf(accent.copy(alpha = if (selected) phase.value else phase.value * 0.55f), surface), center, size.minDimension / 2f))
        }
        .border(if (focused) 3.dp else if (selected) 2.dp else 1.dp, if (focused || selected) Color.White else accent.copy(alpha = 0.65f), CircleShape)
        .onFocusChanged { focused = it.isFocused; onFocus(it.isFocused) }
        .clickable(role = Role.Button, onClick = onClick).padding(12.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(item.title, color = if (focused) canvas else Color.White, textAlign = TextAlign.Center,
                fontWeight = FontWeight.SemiBold, fontSize = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (item.context.isNotBlank()) Text(item.context, color = if (focused) canvas else muted, textAlign = TextAlign.Center,
                fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            item.reaction?.let { Text(when(it) { "LIKE" -> "Liked"; "LOVE" -> "Loved"; "COZY" -> "Cozy"; "DISMISS" -> "No opinion"; else -> "Less like this" },
                color = if (focused) canvas else Color.White, fontSize = 12.sp) }
        }
    }
}
