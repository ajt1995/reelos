package com.reelos.nativepreview

import android.app.Instrumentation
import android.app.Activity
import android.os.Bundle
import com.reelos.providers.*
import java.nio.file.Files

/** Synthetic credentials only. Real Android Keystore and disk; never calls a provider. */
internal object NativeConnectionChecks {
    fun run(host: Instrumentation) {
        val root = Files.createTempDirectory(host.targetContext.noBackupFilesDir.toPath(), "connection-check-")
        val result = Bundle()
        var count = 0
        fun case(name: String, block: () -> Unit) {
            block(); count++; result.putString(name, "passed")
            host.sendStatus(0, Bundle().apply { putString("stream", "$name: passed\n") })
        }
        try {
            val protector = AndroidCredentialProtector(host.targetContext)
            val path = root.resolve("test.bin")
            val store = ProtectedConnectionStore(path, protector)
            val key = "synthetic-hardware-test-not-a-provider-key".toCharArray()
            var revision = ""
            case("keystore-protected-roundtrip") {
                revision = store.replace(store.invalidate(), "synthetic-account", key)
                store.read()!!.use { check(it.accountId == "synthetic-account"); it.useSecret { value -> check(value.contentEquals(key)) } }
                check(!String(Files.readAllBytes(path)).contains(String(key)))
            }
            case("keystore-reopen-and-clear") {
                val loaded = ProtectedConnectionStore(path, AndroidCredentialProtector(host.targetContext)).read()!!
                check(loaded.revision == revision)
                loaded.close(); loaded.useSecret { value -> check(value.all { it == '\u0000' }) }
            }
            case("keystore-tamper-fails-closed") {
                val original = Files.readAllBytes(path)
                val modified = original.copyOf(); modified[modified.lastIndex] = (modified.last().toInt() xor 1).toByte()
                Files.write(path, modified)
                check(runCatching { store.read() }.exceptionOrNull() is ConnectionStorageFailure)
                check(Files.readAllBytes(path).contentEquals(modified))
                Files.write(path, original)
            }
            case("keystore-disable-rejects-stale-save") {
                val attempt = store.invalidate()
                ProtectedConnectionStore(path, protector).invalidate()
                check(runCatching { store.replace(attempt, "synthetic-account", key) }.exceptionOrNull() is ConnectionChanged)
                check(!store.isCurrent(revision))
                store.read()!!.use { check(it.accountId == null); it.useSecret { value -> check(value.isEmpty()) } }
            }
            key.fill('\u0000')
            result.putString("stream", "Native protected connection checks: $count passed; no skips. No live provider certification.\n")
            host.finish(Activity.RESULT_OK, result)
        } catch (_: Exception) {
            result.putString("stream", "Protected connection checks failed after $count passed. No credential details logged.\n")
            host.finish(Activity.RESULT_CANCELED, result)
        } finally { root.toFile().deleteRecursively() }
    }
}
