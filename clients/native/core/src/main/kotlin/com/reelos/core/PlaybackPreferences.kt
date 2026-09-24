package com.reelos.core

import java.util.Locale

enum class SubtitleMode { AUTO, OFF, ON }
enum class CaptionSizePreference { DEVICE, SMALL, REGULAR, LARGE }
enum class CaptionStylePreference { DEVICE, OUTLINED, BOXED, YELLOW }

/** Language intent, never a decoder-specific track number or source authority. */
data class PlaybackPreferences(
    val audioLanguage: String? = null,
    val subtitleLanguage: String? = null,
    val subtitleMode: SubtitleMode = SubtitleMode.AUTO,
    val captionSize: CaptionSizePreference = CaptionSizePreference.DEVICE,
    val captionStyle: CaptionStylePreference = CaptionStylePreference.DEVICE,
)

private val iso3To2: Map<String, String> by lazy {
    Locale.getISOLanguages().mapNotNull { code ->
        runCatching { Locale.forLanguageTag(code).isO3Language to code }.getOrNull()
    }.toMap()
}

fun normalizedPlaybackLanguage(value: String?): String? {
    if (value == null) return null
    require(value.length <= 35 && Regex("[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*").matches(value)) { "Invalid language tag" }
    val parts = value.split('-').toMutableList()
    parts[0] = iso3To2[parts[0].lowercase(Locale.ROOT)] ?: parts[0].lowercase(Locale.ROOT)
    val tag = Locale.forLanguageTag(parts.joinToString("-")).toLanguageTag()
    require(tag != "und") { "A named language is required" }
    return tag
}

fun playbackLanguageMatches(preferred: String?, actual: String?): Boolean {
    if (preferred == null || actual == null) return false
    return runCatching {
        normalizedPlaybackLanguage(preferred)?.substringBefore('-') == normalizedPlaybackLanguage(actual)?.substringBefore('-')
    }.getOrDefault(false)
}

internal fun validatePlaybackPreferences(value: PlaybackPreferences) {
    require(normalizedPlaybackLanguage(value.audioLanguage) == value.audioLanguage)
    require(normalizedPlaybackLanguage(value.subtitleLanguage) == value.subtitleLanguage)
}
