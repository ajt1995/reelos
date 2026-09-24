package com.reelos.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.*
import androidx.compose.runtime.*

/** Shared presentation intent; platform renderers own text layout, decoding and accessibility. */
enum class CaptionSize(val label: String, val scale: Float) {
    DEVICE("Device size", 1f), SMALL("Small captions", .8f), REGULAR("Regular captions", 1f), LARGE("Large captions", 1.4f)
}
enum class CaptionStyle(val label: String) {
    DEVICE("Device style"), OUTLINED("White with outline"), BOXED("White on black"), YELLOW("Yellow on black")
}

@Composable fun CaptionAppearanceControl(size: CaptionSize, style: CaptionStyle,
    onSize: (CaptionSize) -> Unit, onStyle: (CaptionStyle) -> Unit, onReset: () -> Unit,
    onExpanded: (Boolean) -> Unit = {}) {
    var expanded by remember { mutableStateOf(false) }
    fun expand(value: Boolean) { expanded = value; onExpanded(value) }
    Box {
        Button(onClick = { expand(true) }) { Text("Caption appearance") }
        DropdownMenu(expanded, onDismissRequest = { expand(false) }) {
            CaptionSize.entries.forEach { choice ->
                DropdownMenuItem(text = { Text(choice.label) },
                    trailingIcon = { if (choice == size) Text("✓") },
                    onClick = { expand(false); onSize(choice) })
            }
            HorizontalDivider()
            CaptionStyle.entries.forEach { choice ->
                DropdownMenuItem(text = { Text(choice.label) },
                    trailingIcon = { if (choice == style) Text("✓") },
                    onClick = { expand(false); onStyle(choice) })
            }
            DropdownMenuItem(text = { Text("Use device captions") },
                onClick = { expand(false); onReset() })
        }
    }
}
