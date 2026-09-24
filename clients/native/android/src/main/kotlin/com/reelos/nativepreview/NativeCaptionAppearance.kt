package com.reelos.nativepreview

import android.graphics.Color
import android.view.accessibility.CaptioningManager
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.SubtitleView
import com.reelos.ui.CaptionSize
import com.reelos.ui.CaptionStyle

/** Reuses Media3's Canvas subtitle renderer; never WebView, bitmap OCR or a parallel text decoder. */
@androidx.media3.common.util.UnstableApi
internal fun SubtitleView.applyCaptionAppearance(size: CaptionSize, style: CaptionStyle) {
    setApplyEmbeddedStyles(style == CaptionStyle.DEVICE)
    setApplyEmbeddedFontSizes(size == CaptionSize.DEVICE)
    if (size == CaptionSize.DEVICE) setUserDefaultTextSize()
    else {
        val manager = context.getSystemService(CaptioningManager::class.java)
        val accessibilityScale = if (manager?.isEnabled == true) manager.fontScale else 1f
        setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * accessibilityScale * size.scale)
    }
    if (style == CaptionStyle.DEVICE) setUserDefaultStyle()
    else setStyle(CaptionStyleCompat(
        if (style == CaptionStyle.YELLOW) Color.YELLOW else Color.WHITE,
        if (style == CaptionStyle.OUTLINED) Color.TRANSPARENT else Color.BLACK,
        Color.TRANSPARENT,
        if (style == CaptionStyle.OUTLINED) CaptionStyleCompat.EDGE_TYPE_OUTLINE else CaptionStyleCompat.EDGE_TYPE_NONE,
        Color.BLACK, null
    ))
}
