import groovy.json.JsonOutput
import java.security.MessageDigest

plugins {
    id("com.android.application")
    kotlin("android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.reelos.nativepreview"
    compileSdk = 35
    defaultConfig {
        // Isolated validation channel until the signed consumer candidate passes acceptance.
        applicationId = "com.reelos.nativepreview"
        minSdk = 26
        targetSdk = 35
        versionCode = rootProject.extra["reelosAndroidVersionCode"] as Int
        versionName = rootProject.extra["reelosNativeVersion"].toString()
        testInstrumentationRunner = "com.reelos.nativepreview.NativeHardwareChecks"
    }
    sourceSets["main"].java.srcDir("../presentation/src/main/kotlin")
    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(project(":core"))
    implementation(project(":shared-ui"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.media3:media3-exoplayer:1.5.0")
    implementation("androidx.media3:media3-ui:1.5.0")
}
tasks.configureEach {
    if (name.contains("Release", ignoreCase = true)) {
        doFirst { error("Native feasibility app is not an accepted or signed consumer release.") }
    }
}

// Hash provenance avoids falsely rejecting Gradle's valid cached test APK by timestamp.
// This task builds both APKs before recording their exact source scope and bytes.
tasks.register("prepareHardwareValidation") {
    dependsOn("assembleDebug", "assembleDebugAndroidTest")
    doLast {
        fun digest(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes())
            .joinToString("") { "%02x".format(it) }
        val app = layout.buildDirectory.file("outputs/apk/debug/android-debug.apk").get().asFile
        val tests = layout.buildDirectory.file("outputs/apk/androidTest/debug/android-debug-androidTest.apk").get().asFile
        check(app.isFile && tests.isFile) { "Both isolated validation APKs are required" }
        val sources = rootProject.fileTree(rootProject.rootDir) {
            include("**/*.kt", "**/*.kts", "**/*.xml", "**/*.java", "**/*.mp4", "**/*.properties", "**/*.tsv")
            exclude("**/build/**", "**/.gradle/**", "**/.kotlin/**", "desktop/**", "**/test/**", "**/smoke/**", "**/local.properties")
        }.files.sortedBy { it.relativeTo(rootProject.rootDir).invariantSeparatorsPath }
            .associate { it.relativeTo(rootProject.rootDir).invariantSeparatorsPath to digest(it) }
        val evidence = linkedMapOf(
            "schema" to "reelos-native-validation-build/v1",
            "sourceRevision" to rootProject.extra["reelosSourceRevision"],
            "displayVersion" to rootProject.extra["reelosNativeVersion"],
            "productVersionSha256" to digest(rootProject.rootDir.resolve("../../VERSION")),
            "appSha256" to digest(app),
            "testApkSha256" to digest(tests),
            "sources" to sources,
        )
        val output = layout.buildDirectory.file("outputs/native-validation-build.json").get().asFile
        output.parentFile.mkdirs()
        output.writeText(JsonOutput.prettyPrint(JsonOutput.toJson(evidence)) + "\n")
    }
}
