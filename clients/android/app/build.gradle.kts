plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val repositoryRoot = rootProject.projectDir.resolve("../..").canonicalFile
val syncSharedReelOsUi by tasks.registering(Exec::class) {
    workingDir(repositoryRoot)
    commandLine("node", "scripts/build-android-shared-ui.mjs", "--build")
}

tasks.named("preBuild") {
    dependsOn(syncSharedReelOsUi)
}
val releaseStoreFile = providers.gradleProperty("REELOS_RELEASE_STORE_FILE")
    .orElse(providers.environmentVariable("REELOS_RELEASE_STORE_FILE"))
val releaseStorePassword = providers.gradleProperty("REELOS_RELEASE_STORE_PASSWORD")
    .orElse(providers.environmentVariable("REELOS_RELEASE_STORE_PASSWORD"))
val releaseKeyAlias = providers.gradleProperty("REELOS_RELEASE_KEY_ALIAS")
    .orElse(providers.environmentVariable("REELOS_RELEASE_KEY_ALIAS"))
val releaseKeyPassword = providers.gradleProperty("REELOS_RELEASE_KEY_PASSWORD")
    .orElse(providers.environmentVariable("REELOS_RELEASE_KEY_PASSWORD"))

android {
    namespace = "com.reelos"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.reelos"
        minSdk = 26
        targetSdk = 35
        versionCode = 2005004
        versionName = "2.5.4"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("reelosRelease") {
            val configuredStore = releaseStoreFile.orNull
            if (!configuredStore.isNullOrBlank()) {
                storeFile = file(configuredStore)
                storePassword = releaseStorePassword.orNull
                keyAlias = releaseKeyAlias.orNull
                keyPassword = releaseKeyPassword.orNull
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("reelosRelease")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

gradle.taskGraph.whenReady {
    val releaseRequested = allTasks.any { task ->
        task.name.equals("assembleRelease", ignoreCase = true) ||
            task.name.equals("bundleRelease", ignoreCase = true)
    }
    if (releaseRequested) {
        val missing = listOf(
            "REELOS_RELEASE_STORE_FILE" to releaseStoreFile.orNull,
            "REELOS_RELEASE_STORE_PASSWORD" to releaseStorePassword.orNull,
            "REELOS_RELEASE_KEY_ALIAS" to releaseKeyAlias.orNull,
            "REELOS_RELEASE_KEY_PASSWORD" to releaseKeyPassword.orNull,
        ).filter { (_, value) -> value.isNullOrBlank() }.map { (name, _) -> name }
        check(missing.isEmpty()) {
            "Release signing is not configured. Provide external Gradle properties or environment variables: ${missing.joinToString()}. Debug signing is never used for release."
        }
        check(file(releaseStoreFile.get()).isFile) {
            "Release keystore does not exist: ${releaseStoreFile.get()}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("androidx.tv:tv-foundation:1.0.0-alpha11")
    implementation("androidx.tv:tv-material:1.0.0")

    implementation("androidx.media3:media3-exoplayer:1.5.0")
    implementation("androidx.media3:media3-exoplayer-hls:1.5.0")
    implementation("androidx.media3:media3-ui:1.5.0")
    implementation("androidx.media3:media3-session:1.5.0")

    implementation("androidx.window:window:1.3.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation("junit:junit:4.13.2")
}
