package com.reelos.core.intelligence

import java.io.ByteArrayInputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NativeTasteCatalogTest {
    @Test fun factualFiniteTitlesHaveUniqueSafeIdentity() {
        val all = NativeTasteCatalog.subjects()
        val titles = all.filter { it.kind in setOf("movie", "series", "book") }
        assertTrue(titles.size >= 80)
        assertEquals(all.size, all.map { it.id }.toSet().size)
        assertTrue(all.all { it.id.isNotBlank() && it.title.isNotBlank() && it.title.none { char -> Character.isISOControl(char) } })
        assertTrue(all.none { it.id in setOf("night-harbor", "last-signal", "static-kingdom", "station-line") })
        assertTrue(all.any { it.id == "tmdb-movie-693134" && it.title == "Dune: Part Two" })
        assertTrue(all.any { it.id == "se-featured-frankenstein" && it.title == "Frankenstein" && it.book })
    }

    @Test fun tvOmissionOnlyRemovesBooks() {
        val all = NativeTasteCatalog.subjects()
        val tv = NativeTasteCatalog.subjects(includeBooks = false)
        assertTrue(all.any { it.book })
        assertTrue(tv.none { it.book })
        assertEquals(all.filterNot { it.book }, tv)
        assertTrue(tv.any { it.kind == "series" })
    }

    @Test fun actorChoicesAndSixMoodsHaveConcreteCatalogExamples() {
        val all = NativeTasteCatalog.subjects()
        val names = all.filter { it.kind in setOf("movie", "series", "book") }.map { it.title }.toSet()
        val actors = all.filter { it.kind == "person" }
        assertTrue(actors.size >= 10)
        assertTrue(actors.any { it.title == "Florence Pugh" })
        assertTrue(actors.any { it.title == "Keanu Reeves" })
        assertFalse(actors.any { it.title in setOf("Christopher Nolan", "Denis Villeneuve", "Hayao Miyazaki") })
        val moods = all.filter { it.kind == "mood" }
        assertEquals(6, moods.size)
        assertTrue(moods.all { it.examples.size >= 2 && it.examples.all(names::contains) })
    }

    @Test fun missingOrInvalidResourceReturnsNoInventedSubjects() {
        assertTrue(NativeTasteCatalog.parseResource(null).isEmpty())
        fun parse(value: String) = NativeTasteCatalog.parseResource(ByteArrayInputStream(value.toByteArray(Charsets.UTF_8)))
        assertTrue(parse("movie\tid\tValid\t\nmovie\tid\tDuplicate\t\n").isEmpty())
        assertTrue(parse("movie\tid\tBad\u0001Label\t\n").isEmpty())
        assertTrue(parse("mood\tquiet\tQuiet\tUnlisted title|Another\n").isEmpty())
    }
}
