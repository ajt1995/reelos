package com.reelos.core

import java.util.Properties

/** Generated once from the common native build; no independently maintained platform version. */
data class NativeBuildInfo(
    val productVersion: String,
    val sourceRevision: String,
    val sourceFingerprint: String,
    val displayVersion: String,
) {
    companion object {
        val current: NativeBuildInfo by lazy {
            val values = Properties()
            NativeBuildInfo::class.java.getResourceAsStream("/reelos-build.properties")?.use(values::load)
            NativeBuildInfo(
                values.getProperty("productVersion", "unversioned"),
                values.getProperty("sourceRevision", "unversioned"),
                values.getProperty("sourceFingerprint", "unversioned"),
                values.getProperty("displayVersion", "Development build (unversioned)"),
            )
        }
    }
}
