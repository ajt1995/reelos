# ReelOS Android Client ProGuard Configuration
# ============================================

# General Optimization and Debugging Attributes
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Kotlin Reflection & Metadata
-keep class kotlin.Metadata { *; }
-keepclassmembers class * {
    @kotlin.jvm.JvmField *;
}
-dontwarn kotlin.**

# Jetpack Compose Rules
-keep class androidx.compose.** { *; }
-keep class androidx.tv.** { *; }
-dontwarn androidx.compose.**
-dontwarn androidx.tv.**

# ExoPlayer / Media3 (4K DirectPlay & Codecs)
-keep class androidx.media3.** { *; }
-keepclassmembers class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# OkHttp & Okio Networking
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Coroutines
-dontwarn kotlinx.coroutines.**
-keep class kotlinx.coroutines.** { *; }

# ReelOS Application Data Models and Entry Points
-keep class com.reelos.** { *; }
-keepclassmembers class com.reelos.** { *; }
