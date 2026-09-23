plugins {
    id("com.android.application")
    kotlin("android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.reelos.nativepreview"
    compileSdk = 35
    defaultConfig {
        // Coexists with com.reelos; never replaces the user's household app or signing identity.
        applicationId = "com.reelos.nativepreview"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1-native-validation"
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
