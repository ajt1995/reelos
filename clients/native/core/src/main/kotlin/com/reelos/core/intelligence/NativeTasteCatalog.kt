package com.reelos.core.intelligence

import java.io.InputStream
import java.util.Collections

/** A finite setup subject, not a playable media record or a model-generated feature. */
data class TasteSubject(
    val id: String,
    val title: String,
    val kind: String,
    val examples: List<String> = emptyList(),
    val book: Boolean = false,
)

/**
 * Static names for first-run taste calibration. Presence here says nothing about
 * source access, media readiness, an installed book, artwork, or semantic inference.
 * The renderer can cycle this finite list as people dismiss questions.
 */
object NativeTasteCatalog {
    private const val RESOURCE = "/com/reelos/core/intelligence/taste-subjects.tsv"
    private val all by lazy { parseResource(NativeTasteCatalog::class.java.getResourceAsStream(RESOURCE)) }
    private val withoutBooks by lazy { frozen(all.filterNot { it.book }) }

    fun subjects(includeBooks: Boolean = true): List<TasteSubject> =
        if (includeBooks) all else withoutBooks

    /** Missing or corrupt bundled metadata yields no prompts, never a crash or invented fallback. */
    internal fun parseResource(source: InputStream?): List<TasteSubject> {
        if (source == null) return emptyList()
        return try {
            source.bufferedReader(Charsets.UTF_8).use { reader ->
                val result = ArrayList<TasteSubject>()
                val ids = HashSet<String>()
                reader.forEachLine { line ->
                    if (line.isBlank() || line.startsWith("#")) return@forEachLine
                    require(result.size < 256) { "Taste subject limit" }
                    val fields = line.split('\t', limit = 4)
                    require(fields.size == 4) { "Malformed taste subject" }
                    val kind = fields[0]
                    val id = fields[1]
                    val title = fields[2]
                    val examples = if (fields[3].isEmpty()) emptyList() else fields[3].split('|').map(String::trim)
                    require(kind in setOf("movie", "series", "book", "person", "mood"))
                    require(id.matches(Regex("[a-z0-9][a-z0-9-]{0,127}")) && ids.add(id))
                    require(validLabel(title) && title.length <= 256)
                    require(examples.size <= 4 && examples.all { validLabel(it) && it.length <= 256 })
                    result += TasteSubject(id, title, kind, frozen(examples), kind == "book")
                }
                val titles = result.filter { it.kind in setOf("movie", "series", "book") }.map { it.title }.toSet()
                require(result.filter { it.kind == "mood" }.all { mood ->
                    mood.examples.size >= 2 && mood.examples.all { it in titles }
                })
                frozen(result)
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun validLabel(label: String): Boolean =
        label.isNotBlank() && label.none { Character.isISOControl(it) }

    private fun <T> frozen(items: List<T>): List<T> =
        Collections.unmodifiableList(ArrayList(items))
}
