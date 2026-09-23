package com.reelos.core

import java.nio.file.Files
import java.util.ConcurrentModificationException

/** Run as a plain Kotlin/JVM main when a test runner is unavailable. */
fun main() {
    val directory = Files.createTempDirectory("reelos-core-smoke-")
    val stateFile = directory.resolve("state.bin")
    try {
        val first = ReelCore(FileCoreStore(stateFile), DeviceKind.WINDOWS)
        first.createProfile("a")
        first.createProfile("b")
        first.setName("a", "Ada")
        first.setColor("a", "#123abc")
        first.acknowledgeCurator("a", GuidanceLevel.GUIDED)
        first.setTasteSeeds("a", setOf("Mystery"))
        first.back("a")

        val resumed = ReelCore(FileCoreStore(stateFile), DeviceKind.WINDOWS)
        check(resumed.snapshot.profiles.getValue("a").onboardingStep == OnboardingStep.TASTE)
        check(resumed.snapshot.profiles.getValue("a").tasteSeeds == setOf("Mystery"))
        check(resumed.snapshot.profiles.getValue("a").guidance == GuidanceLevel.GUIDED)
        check(!resumed.canEnterHome("a"))
        resumed.setTasteSeeds("a", setOf("Mystery"))
        resumed.confirmDefaultSources("a")
        resumed.chooseHome("a", null)
        check(resumed.canEnterHome("a") && resumed.snapshot.requestedHomeId == null)

        resumed.setReaction("a", "film", ReactionKind.LOVE)
        resumed.setReaction("b", "film", ReactionKind.DISMISS)
        check(resumed.reactionFor("a", "film") == ReactionKind.LOVE)
        check(resumed.reactionFor("b", "film") == ReactionKind.DISMISS)
        resumed.setReaction("b", "film", ReactionKind.LESS)
        check(resumed.reactionFor("b", "film") == ReactionKind.LESS)
        resumed.setReaction("b", "film", null)
        check(resumed.reactionFor("b", "film") == null)

        resumed.putMedia(MediaRecord("film", "Film", PERSONAL_SOURCE_ID))
        check(resumed.mediaAction("film") == MediaAction.FIND)
        resumed.putMedia(MediaRecord("film", "Film", PERSONAL_SOURCE_ID, MediaAvailability.READY))
        check(resumed.mediaAction("film") == MediaAction.PLAY)
        resumed.revokeSource(PERSONAL_SOURCE_ID)
        check(resumed.mediaAction("film") == MediaAction.UNAVAILABLE)
        resumed.putMedia(MediaRecord("pending", "Pending", PERSONAL_SOURCE_ID, MediaAvailability.PREPARING))
        check(resumed.mediaAction("pending") == MediaAction.UNAVAILABLE)

        val tv = ReelCore(FileCoreStore(stateFile), DeviceKind.ANDROID_TV)
        check(Destination.BOOKS !in tv.navigation())
        check(tv.mediaAction("film") == MediaAction.UNAVAILABLE)
        check(tv.reactionFor("a", "film") == ReactionKind.LOVE)
        check(runCatching { ReelCore(MemoryCoreStore(CoreState(schemaVersion = 999)), DeviceKind.WINDOWS) }.isFailure)
        check(runCatching {
            MemoryCoreStore(CoreState(profiles = mapOf("a" to ProfileState("different"))))
        }.isFailure)
        val stale = ReelCore(FileCoreStore(stateFile), DeviceKind.LINUX)
        tv.selectProfile("b")
        check(runCatching { stale.selectProfile("a") }.exceptionOrNull() is ConcurrentModificationException)
        val callerSeeds = mutableSetOf("One")
        val isolated = ReelCore(MemoryCoreStore(CoreState(profiles = mapOf("c" to ProfileState("c", "C", tasteSeeds = callerSeeds)))), DeviceKind.WINDOWS)
        callerSeeds += "Two"
        check(isolated.snapshot.profiles.getValue("c").tasteSeeds == setOf("One"))
        check(runCatching {
            (isolated.snapshot.profiles as MutableMap)["d"] = ProfileState("d")
        }.exceptionOrNull() is UnsupportedOperationException)
        check(runCatching {
            (isolated.snapshot.profiles.getValue("c").tasteSeeds as MutableSet) += "Three"
        }.exceptionOrNull() is UnsupportedOperationException)
        println("Core smoke passed")
    } finally {
        Files.deleteIfExists(stateFile)
        Files.deleteIfExists(stateFile.resolveSibling(stateFile.fileName.toString() + ".lock"))
        Files.deleteIfExists(directory)
    }
}
