package com.reelos.desktop

import com.reelos.ui.CaptionSize
import com.reelos.ui.CaptionStyle

/** Public LibVLC3 instance options, not unsupported per-media text-renderer options. */
internal data class DesktopCaptionAppearance(
    val size: CaptionSize = CaptionSize.DEVICE,
    val style: CaptionStyle = CaptionStyle.DEVICE,
) {
    constructor(preferences: com.reelos.core.PlaybackPreferences) : this(
        CaptionSize.valueOf(preferences.captionSize.name), CaptionStyle.valueOf(preferences.captionStyle.name))

    fun save(core: com.reelos.core.ReelCore, session: com.reelos.core.LocalPlaybackSession) =
        core.setCaptionAppearance(session, com.reelos.core.CaptionSizePreference.valueOf(size.name),
            com.reelos.core.CaptionStylePreference.valueOf(style.name))

    fun options(): List<String> = buildList {
        if (this@DesktopCaptionAppearance.size != CaptionSize.DEVICE) {
            add("--freetype-fontsize=0")
            add("--freetype-rel-fontsize=" + when (this@DesktopCaptionAppearance.size) {
                CaptionSize.SMALL -> 20
                CaptionSize.REGULAR -> 16
                CaptionSize.LARGE -> 12
                CaptionSize.DEVICE -> error("Handled above")
            })
        }
        if (style != CaptionStyle.DEVICE) {
            add("--freetype-color=" + if (style == CaptionStyle.YELLOW) "16776960" else "16777215")
            add("--freetype-opacity=255")
            add("--freetype-background-color=0")
            add("--freetype-background-opacity=" + if (style == CaptionStyle.OUTLINED) "0" else "255")
            add("--freetype-outline-color=0")
            add("--freetype-outline-thickness=" + if (style == CaptionStyle.OUTLINED) "4" else "0")
        }
    }
}
