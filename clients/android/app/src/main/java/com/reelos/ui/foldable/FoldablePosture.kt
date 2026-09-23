package com.reelos.ui.foldable

import androidx.window.layout.DisplayFeature
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowLayoutInfo

/**
 * Foldable device posture states for ReelOS:
 * - FOLDED_COMPACT: Compact one-handed remote / player when folded.
 * - EXPANSIVE_DUAL_PANE: Expansive dual-pane master console (curator compass/dossiers on left,
 *   active player or real-time TV companion on right) when unfolded.
 * - TABLETOP_FLEX: Tabletop / flex posture (video on top, controls/scrubber on bottom).
 */
enum class FoldablePosture(val cssClass: String) {
    FOLDED_COMPACT("reelos-posture-compact"),
    EXPANSIVE_DUAL_PANE("reelos-posture-dual-pane"),
    TABLETOP_FLEX("reelos-posture-tabletop-flex");

    fun jsDispatchScript(): String =
        "document.documentElement.className = document.documentElement.className.replace(/\\breelos-posture-\\S+/g, '') + ' $cssClass';" +
        "window.dispatchEvent(new CustomEvent('reelos:foldable-posture-change', { detail: { posture: '$name', cssClass: '$cssClass' } }));"
}

object FoldablePostureDetector {
    /**
     * Classifies the current WindowLayoutInfo and screen dimensions into a ReelOS foldable posture.
     */
    fun detect(
        layoutInfo: WindowLayoutInfo,
        screenWidthDp: Int,
        screenHeightDp: Int,
    ): FoldablePosture {
        val foldingFeature = layoutInfo.displayFeatures
            .filterIsInstance<FoldingFeature>()
            .firstOrNull()

        return when {
            // Tabletop / flex posture: device half-opened horizontally (video on top, controls/scrubber on bottom)
            foldingFeature != null &&
            foldingFeature.state == FoldingFeature.State.HALF_OPENED &&
            foldingFeature.orientation == FoldingFeature.Orientation.HORIZONTAL -> {
                FoldablePosture.TABLETOP_FLEX
            }

            // Expansive dual-pane: unfolded flat with wide display (>= 600dp) or vertical separating hinge
            // (curator compass/dossiers on left, active player or real-time TV companion on right)
            (foldingFeature != null && (foldingFeature.isSeparating || foldingFeature.orientation == FoldingFeature.Orientation.VERTICAL)) ||
            screenWidthDp >= 600 -> {
                FoldablePosture.EXPANSIVE_DUAL_PANE
            }

            // Folded: compact one-handed remote/player
            else -> {
                FoldablePosture.FOLDED_COMPACT
            }
        }
    }
}
