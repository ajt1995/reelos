package com.reelos.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Pure native 4-digit PIN authentication box.
 * Floating above IME keyboard with imePadding() without squashing.
 * 4 discrete rounded cells with golden active highlight and masking dots.
 */
@Composable
fun NativePinBox(
    pin: String,
    onPinChange: (String) -> Unit,
    onComplete: (String) -> Unit,
    modifier: Modifier = Modifier,
    length: Int = 4,
    autoFocus: Boolean = true,
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(autoFocus) {
        if (autoFocus) {
            focusRequester.requestFocus()
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .imePadding(),
        contentAlignment = Alignment.Center,
    ) {
        // Hidden input target
        BasicTextField(
            value = pin,
            onValueChange = { input ->
                val digits = input.filter { it.isDigit() }.take(length)
                onPinChange(digits)
                if (digits.length == length) {
                    onComplete(digits)
                }
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    if (pin.length == length) onComplete(pin)
                },
            ),
            modifier = Modifier
                .size(1.dp)
                .focusRequester(focusRequester),
        )

        // 4 discrete visual cells
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clickable { focusRequester.requestFocus() }
                .padding(vertical = 12.dp),
        ) {
            for (i in 0 until length) {
                val isFilled = i < pin.length
                val isCurrent = i == pin.length

                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .background(
                            color = Color(0xFF14141A),
                            shape = RoundedCornerShape(14.dp),
                        )
                        .border(
                            width = if (isCurrent) 2.dp else 1.dp,
                            color = if (isCurrent) Color(0xFFF5C518) else if (isFilled) Color.White.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.12f),
                            shape = RoundedCornerShape(14.dp),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isFilled) {
                        Text(
                            text = "●",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFF5C518),
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}
