package com.reelos.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.*
import androidx.compose.runtime.*

/** Identical native choices on desktop, phone and TV; hosts never duplicate the policy. */
@Composable fun SleepTimerControl(label: String, onMinutes: (Int) -> Unit, onEnd: () -> Unit, onCancel: () -> Unit,
    onExpanded: (Boolean) -> Unit = {}) {
    var expanded by remember { mutableStateOf(false) }
    fun expand(value: Boolean) { expanded = value; onExpanded(value) }
    Box {
        Button(onClick = { expand(true) }) { Text(label) }
        DropdownMenu(expanded, onDismissRequest = { expand(false) }) {
            DropdownMenuItem(text = { Text("Off") }, onClick = { expand(false); onCancel() })
            listOf(15, 30, 60, 90).forEach { minutes ->
                DropdownMenuItem(text = { Text("$minutes minutes") }, onClick = { expand(false); onMinutes(minutes) })
            }
            DropdownMenuItem(text = { Text("End of title") }, onClick = { expand(false); onEnd() })
        }
    }
}
