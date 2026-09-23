package com.reelos.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import kotlin.math.min

/**
 * Hardware-safe, multicolored, intensely radiant atmospheric aura.
 * Uses native Skia radial gradients with pre-blended alpha stops fading to transparent.
 * Blends luminous amber, electric violet-indigo, and rich cyan-emerald into a gorgeous
 * living chromatic aura without GPU shader blur penalty on Mali TV hardware.
 */
@Composable
fun LuminousAuraOrb(
    color: Color = Color(0xFFF5C518),
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "MulticoloredOrbPulse")

    // Violet-Indigo Drift & Pulse (3.1s cycle)
    val indigoScale by transition.animateFloat(
        initialValue = 0.88f,
        targetValue = 1.14f,
        animationSpec = infiniteRepeatable(
            animation = tween(3100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "IndigoScale",
    )
    val indigoAlpha by transition.animateFloat(
        initialValue = 0.28f,
        targetValue = 0.52f,
        animationSpec = infiniteRepeatable(
            animation = tween(3100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "IndigoAlpha",
    )

    // Cyan-Emerald Drift & Pulse (2.7s cycle)
    val cyanScale by transition.animateFloat(
        initialValue = 0.90f,
        targetValue = 1.18f,
        animationSpec = infiniteRepeatable(
            animation = tween(2700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "CyanScale",
    )
    val cyanAlpha by transition.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.48f,
        animationSpec = infiniteRepeatable(
            animation = tween(2700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "CyanAlpha",
    )

    // Luminous Amber-Gold Core Pulse (2.1s cycle)
    val amberScale by transition.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.10f,
        animationSpec = infiniteRepeatable(
            animation = tween(2100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "AmberScale",
    )
    val amberAlpha by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.65f,
        animationSpec = infiniteRepeatable(
            animation = tween(2100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "AmberAlpha",
    )

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val baseRadius = min(size.width, size.height) * 0.45f

            // 1. Electric Indigo / Violet Aura (Top Right Bias)
            val indigoCenter = Offset(center.x + size.width * 0.12f, center.y - size.height * 0.08f)
            val indigoRadius = baseRadius * 1.25f * indigoScale
            drawCircle(
                brush = Brush.radialGradient(
                    colorStops = arrayOf(
                        0.0f to Color(0xFF6366F1).copy(alpha = indigoAlpha),
                        0.38f to Color(0xFF4F46E5).copy(alpha = indigoAlpha * 0.45f),
                        0.75f to Color.Transparent,
                    ),
                    center = indigoCenter,
                    radius = indigoRadius,
                ),
                radius = indigoRadius,
                center = indigoCenter,
            )

            // 2. Vibrant Cyan / Emerald Aura (Bottom Left Bias)
            val cyanCenter = Offset(center.x - size.width * 0.14f, center.y + size.height * 0.10f)
            val cyanRadius = baseRadius * 1.20f * cyanScale
            drawCircle(
                brush = Brush.radialGradient(
                    colorStops = arrayOf(
                        0.0f to Color(0xFF06B6D4).copy(alpha = cyanAlpha),
                        0.35f to Color(0xFF10B981).copy(alpha = cyanAlpha * 0.40f),
                        0.72f to Color.Transparent,
                    ),
                    center = cyanCenter,
                    radius = cyanRadius,
                ),
                radius = cyanRadius,
                center = cyanCenter,
            )

            // 3. Deep Magenta Rose Harmonic Accent (Center Offset)
            val magentaRadius = baseRadius * 0.95f * indigoScale
            drawCircle(
                brush = Brush.radialGradient(
                    colorStops = arrayOf(
                        0.0f to Color(0xFFD946EF).copy(alpha = indigoAlpha * 0.35f),
                        0.40f to Color(0xFFA855F7).copy(alpha = indigoAlpha * 0.15f),
                        0.70f to Color.Transparent,
                    ),
                    center = center,
                    radius = magentaRadius,
                ),
                radius = magentaRadius,
                center = center,
            )

            // 4. Luminous Cinema Gold / Amber Core (Pulsing Center)
            val amberRadius = baseRadius * 0.80f * amberScale
            drawCircle(
                brush = Brush.radialGradient(
                    colorStops = arrayOf(
                        0.0f to Color(0xFFF5C518).copy(alpha = amberAlpha),
                        0.42f to Color(0xFFE5A910).copy(alpha = amberAlpha * 0.35f),
                        0.75f to Color.Transparent,
                    ),
                    center = center,
                    radius = amberRadius,
                ),
                radius = amberRadius,
                center = center,
            )
        }
    }
}
