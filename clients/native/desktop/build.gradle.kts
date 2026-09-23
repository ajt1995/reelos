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
}
compose.desktop {
    application { mainClass = "com.reelos.desktop.MainKt" }
}
// Intentionally no consumer installer/signing task until native acceptance passes.
