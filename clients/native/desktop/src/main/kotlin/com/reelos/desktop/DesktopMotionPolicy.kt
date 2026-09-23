package com.reelos.desktop

import com.sun.jna.Native
import com.sun.jna.ptr.IntByReference
import com.sun.jna.win32.StdCallLibrary
import java.util.concurrent.TimeUnit

/** Read-only platform adapter. Never changes OS accessibility or security settings. */
internal object DesktopMotionPolicy {
    internal interface WindowsAnimations : StdCallLibrary {
        fun SystemParametersInfoW(action: Int, parameter: Int, value: IntByReference, flags: Int): Int
    }

    fun readAllowed(): Boolean {
        if (System.getenv("REELOS_REDUCED_MOTION")?.lowercase() in setOf("1", "true", "yes")) return false
        return if (System.getProperty("os.name").startsWith("Windows")) readWindowsAllowed() ?: false
            else readLinuxAllowed() ?: true // Kiosk environments may have no desktop-settings service.
    }

    internal fun readWindowsAllowed(): Boolean? = runCatching {
        val enabled = IntByReference()
        val api = Native.load("user32", WindowsAnimations::class.java)
        // SPI_GETCLIENTAREAANIMATION; documented BOOL output, read-only (never SPI_SET).
        // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfow
        if (api.SystemParametersInfoW(0x1042, 0, enabled, 0) == 0) null else enabled.value != 0
    }.getOrNull()

    private fun readLinuxAllowed(): Boolean? = runCatching {
        val process = ProcessBuilder("gsettings", "get", "org.gnome.desktop.interface", "enable-animations")
            .redirectError(ProcessBuilder.Redirect.DISCARD).start()
        try {
            if (!process.waitFor(500, TimeUnit.MILLISECONDS)) null
            else if (process.exitValue() != 0) null else parseLinuxFlag(process.inputStream.bufferedReader().readText())
        } finally { if (process.isAlive) process.destroyForcibly() }
    }.getOrNull()

    internal fun parseLinuxFlag(value: String): Boolean? = when (value.trim()) { "true" -> true; "false" -> false; else -> null }
}
