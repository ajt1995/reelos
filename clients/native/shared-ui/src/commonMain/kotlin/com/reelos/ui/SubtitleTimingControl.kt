package com.reelos.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.*
import androidx.compose.runtime.*

@Composable fun SubtitleTimingControl(delayMs: Long, onAdjust: (Long) -> Unit, onReset: () -> Unit,
    onExpanded: (Boolean) -> Unit = {}) {
    var expanded by remember { mutableStateOf(false) }
    fun expand(value: Boolean) { expanded = value; onExpanded(value) }
    Box {
        Button(onClick = { expand(true) }) { Text("Caption timing · ${delayMs}ms") }
        DropdownMenu(expanded, onDismissRequest = { expand(false) }) {
            listOf(-1_000L to "Earlier · 1 second", -100L to "Earlier · 0.1 second",
                100L to "Later · 0.1 second", 1_000L to "Later · 1 second").forEach { (delta, label) ->
                DropdownMenuItem(text = { Text(label) }, onClick = { expand(false); onAdjust(delta) })
            }
            DropdownMenuItem(text = { Text("Reset caption timing") }, onClick = { expand(false); onReset() })
        }
    }
}
