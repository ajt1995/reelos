import java.security.MessageDigest

plugins {
    kotlin("jvm") version "2.0.21" apply false
    kotlin("multiplatform") version "2.0.21" apply false
    kotlin("android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("org.jetbrains.compose") version "1.7.3" apply false
    id("com.android.application") version "8.7.2" apply false
    id("com.android.library") version "8.7.2" apply false
}

// VERSION remains the product authority. Native validation builds expose their exact source.
val productVersion = rootDir.resolve("../../VERSION").readText().trim()
require(Regex("[0-9]+\\.[0-9]+\\.[0-9]+").matches(productVersion)) { "Invalid canonical VERSION" }
val revisionResult = providers.exec {
    commandLine("git", "-C", rootDir.absolutePath, "rev-parse", "--short=12", "HEAD")
    isIgnoreExitValue = true
}
val sourceRevision = if (revisionResult.result.get().exitValue == 0)
    revisionResult.standardOutput.asText.get().trim() else "unversioned"
val sourceDigest = MessageDigest.getInstance("SHA-256")
sourceDigest.update(productVersion.toByteArray(Charsets.UTF_8))
fileTree(rootDir) {
    include("**/*.kt", "**/*.kts", "**/*.xml", "**/*.properties", "**/*.sh")
    exclude("**/build/**", "**/.gradle/**", "**/.kotlin/**", "**/local.properties")
}.files.sortedBy { it.relativeTo(rootDir).invariantSeparatorsPath }.forEach {
    sourceDigest.update(it.relativeTo(rootDir).invariantSeparatorsPath.toByteArray(Charsets.UTF_8))
    sourceDigest.update(0)
    sourceDigest.update(it.readBytes())
}
val sourceFingerprint = sourceDigest.digest().joinToString("") { "%02x".format(it) }
val nativeVersion = "$productVersion-native.$sourceRevision.${sourceFingerprint.take(12)}"
val parts = productVersion.split(".").map(String::toInt)
require(parts[0] in 0..2000 && parts[1] in 0..999 && parts[2] in 0..999)
val nativeVersionCode = parts[0] * 1_000_000 + parts[1] * 1_000 + parts[2]
extra["reelosProductVersion"] = productVersion
extra["reelosSourceRevision"] = sourceRevision
extra["reelosSourceFingerprint"] = sourceFingerprint
extra["reelosNativeVersion"] = nativeVersion
extra["reelosAndroidVersionCode"] = nativeVersionCode
allprojects { version = nativeVersion }
