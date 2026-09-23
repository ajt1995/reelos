import java.security.MessageDigest
import org.gradle.api.attributes.Attribute

plugins {
    kotlin("jvm")
    id("org.jetbrains.compose")
    id("org.jetbrains.kotlin.plugin.compose")
}
kotlin { jvmToolchain(17) }
sourceSets.main { kotlin.srcDir("../presentation/src/main/kotlin") }
dependencies {
    implementation(project(":core"))
    implementation(project(":shared-ui"))
    implementation(compose.desktop.currentOs)
    // Cached approved dependency; LibVLC itself is supplied by the desktop host.
    implementation("net.java.dev.jna:jna:5.6.0")
    testImplementation(kotlin("test-junit"))
}
tasks.test { useJUnit() }

// Validation-only Linux classpath. Keep the Windows currentOs runtime out of this artifact.
val linuxX64ValidationRuntime by configurations.creating {
    isCanBeConsumed = false
    isCanBeResolved = true
    extendsFrom(configurations.runtimeClasspath.get())
    attributes {
        val runtimeAttributes = configurations.runtimeClasspath.get().attributes
        runtimeAttributes.keySet().forEach { key ->
            @Suppress("UNCHECKED_CAST")
            val typedKey = key as Attribute<Any>
            attribute(typedKey, runtimeAttributes.getAttribute(typedKey) ?: error("Missing $key"))
        }
    }
    exclude(group = "org.jetbrains.compose.desktop", module = "desktop-jvm-windows-x64")
    exclude(group = "org.jetbrains.skiko", module = "skiko-awt-runtime-windows-x64")
}
dependencies { add(linuxX64ValidationRuntime.name, compose.desktop.linux_x64) }

tasks.register<Sync>("bundleLinuxX64Validation") {
    group = "verification"
    description = "Build a Linux x64 classpath bundle for isolated native validation; no JRE or LibVLC is included."
    dependsOn(tasks.named("jar"))
    into(layout.buildDirectory.dir("linux-x64-validation"))
    from(linuxX64ValidationRuntime) { into("lib") }
    from(tasks.named("jar")) { into("lib") }
    from("run-linux-x64-validation.sh") { rename { "run.sh" } }
    doFirst {
        val names = linuxX64ValidationRuntime.resolve().map { it.name }
        require(names.any { it.startsWith("skiko-awt-runtime-linux-x64-") }) { "Linux x64 Skiko runtime is missing." }
        require(names.none { it.contains("windows", ignoreCase = true) }) { "Windows runtime leaked into Linux validation bundle." }
    }
    doLast {
        val lib = destinationDir.resolve("lib")
        val lines = lib.listFiles().orEmpty().filter { it.isFile }.sortedBy { it.name }.map { file ->
            val hash = MessageDigest.getInstance("SHA-256").digest(file.readBytes())
                .joinToString("") { "%02x".format(it) }
            "$hash  lib/${file.name}"
        }
        destinationDir.resolve("SHA256SUMS").writeText(lines.joinToString("\n", postfix = "\n"))
    }
}

compose.desktop {
    application { mainClass = "com.reelos.desktop.MainKt" }
}
// Intentionally no consumer installer/signing task until native acceptance passes.
