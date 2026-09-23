package com.reelos.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable internal fun PersonalView(model: UiModel, accent: Color, onTaste: () -> Unit, onPeople: () -> Unit, onEvent: (UiEvent) -> Unit) {
    Column(Modifier.semantics { paneTitle = "Your profile" }, verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text(model.name.orEmpty(), color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Bold)
        ReelButton("Switch person", accent, compact = true, onClick = onPeople)
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            Text("${model.tasteSubjects.count { it.reaction == "LOVE" }} loved", color = muted)
            Text("${model.tasteSubjects.count { it.reaction == "LIKE" }} liked", color = muted)
            Text("${model.tasteSubjects.count { it.reaction == "COZY" }} cozy", color = muted)
        }
        ReelButton("Tune your taste", accent, onClick = onTaste)
        AppearanceControls(model, accent, onEvent)
    }
}

@Composable internal fun ProfilePicker(model: UiModel, accent: Color, onEvent: (UiEvent) -> Unit) {
    var newName by remember(model.profileId) { mutableStateOf("") }
    var adding by remember(model.profileId) { mutableStateOf(false) }
    Column(Modifier.semantics { paneTitle = "Choose a person" }, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        model.profiles.forEach { profile ->
            val color = palette.firstOrNull { it.first.equals(profile.color, true) }?.second ?: accent
            ReelButton(profile.name.ifBlank { "Continue setup" }, color, selected = profile.id == model.profileId) {
                onEvent(UiEvent.SelectProfile(profile.id))
            }
        }
        if (adding) {
            OutlinedTextField(newName, { newName = it.take(80) }, label = { Text("Their name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Text("Adult profiles only in this validation build. Child protection and PINs are not ready yet.", color = muted)
            ReelButton("Create profile", accent, enabled = newName.isNotBlank()) { onEvent(UiEvent.CreateProfile(newName.trim())) }
            ReelButton("Cancel", accent, compact = true) { adding = false; newName = "" }
        } else ReelButton("Add an adult", accent) { adding = true }
    }
}

@Composable internal fun AppearanceControls(model: UiModel, accent: Color, onEvent: (UiEvent) -> Unit) {
    var open by remember(model.profileId) { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ReelButton(if (open) "Close appearance" else "Appearance · you", accent, compact = true) { open = !open }
        if (open) {
            Text("Your color", color = muted)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                palette.forEachIndexed { index, (hex, shade) ->
                    ReelButton(colorNames[index], shade, selected = hex.equals(model.color, true), compact = true) { onEvent(UiEvent.ColorChoice(hex)) }
                }
            }
            Text("Motion", color = muted)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("STILL" to "Still", "SUBTLE" to "Subtle", "EXPRESSIVE" to "Expressive").forEach { (value, label) ->
                    ReelButton(label, accent, selected = model.motionMode == value, compact = true) { onEvent(UiEvent.Appearance(motion = value)) }
                }
            }
            if (model.effectiveMotion == "STILL" && model.motionMode != "STILL") Text("Motion is limited by this device or its accessibility settings.", color = muted)
            Text("Browsing space", color = muted)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("COMFORTABLE" to "Comfortable", "COMPACT" to "Compact").forEach { (value, label) ->
                    ReelButton(label, accent, selected = model.browsingDensity == value, compact = true) { onEvent(UiEvent.Appearance(density = value)) }
                }
            }
            ReelButton(if (model.transparencyEnabled) "Transparency · on" else "Transparency · off", accent, compact = true) {
                onEvent(UiEvent.Appearance(toggleTransparency = true))
            }
        }
    }
}
