package com.reelos.desktop

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class WindowsCredentialProtectorTest {
    @Test fun syntheticCredentialRoundTripsThroughCurrentUserDpapi() {
        if (!isWindows()) {
            assertFailsWith<IllegalArgumentException> { WindowsCredentialProtector() }
            return
        }
        val protector = WindowsCredentialProtector()
        val plain = ByteArray(1024) { (it * 31).toByte() }
        val protected = protector.protect(plain)
        assertFalse(protected.contentEquals(plain))
        assertContentEquals(plain, protector.unprotect(protected))
    }

    @Test fun tamperedAndUnknownCiphertextsFailClosed() {
        if (!isWindows()) return
        val protector = WindowsCredentialProtector()
        val protected = protector.protect("synthetic-provider-token".encodeToByteArray())
        val tampered = protected.copyOf().apply { this[lastIndex] = (last().toInt() xor 1).toByte() }
        assertFailsWith<IllegalStateException> { protector.unprotect(tampered) }
        val wrongVersion = protected.copyOf().apply { this[3] = 2 }
        assertFailsWith<IllegalArgumentException> { protector.unprotect(wrongVersion) }
        assertFailsWith<IllegalArgumentException> { protector.unprotect(byteArrayOf(1, 2, 3)) }
    }

    @Test fun oversizedInputsAreRejectedBeforeNativeAllocation() {
        if (!isWindows()) return
        val protector = WindowsCredentialProtector()
        assertFailsWith<IllegalArgumentException> { protector.protect(byteArrayOf()) }
        assertFailsWith<IllegalArgumentException> { protector.protect(ByteArray(32 * 1024 + 1)) }
        assertFailsWith<IllegalArgumentException> { protector.unprotect(ByteArray(64 * 1024 + 1)) }
    }

    private fun isWindows() = System.getProperty("os.name").startsWith("Windows", ignoreCase = true)
}
