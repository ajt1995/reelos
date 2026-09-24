package com.reelos.desktop

import com.reelos.providers.SecretProtector
import com.sun.jna.Memory
import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.Structure
import com.sun.jna.win32.StdCallLibrary

/** Current-user DPAPI protection for the Windows native client. */
class WindowsCredentialProtector : SecretProtector {
    init {
        require(System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
            "Windows credential protection is unavailable on this platform"
        }
    }

    override fun protect(plain: ByteArray): ByteArray {
        require(plain.isNotEmpty() && plain.size <= MAX_PLAINTEXT_BYTES) { "Invalid credential size" }
        try {
            val protected = transform(plain, encrypt = true)
            try {
                return HEADER + protected
            } finally {
                protected.fill(0)
            }
        } catch (_: Exception) {
            throw IllegalStateException("Credential protection failed")
        } catch (_: LinkageError) {
            throw IllegalStateException("Credential protection failed")
        }
    }

    override fun unprotect(cipher: ByteArray): ByteArray {
        if (cipher.size !in (HEADER.size + 1)..MAX_CIPHERTEXT_BYTES ||
            !cipher.copyOfRange(0, HEADER.size).contentEquals(HEADER)
        ) {
            throw IllegalArgumentException("Invalid credential ciphertext")
        }
        val protected = cipher.copyOfRange(HEADER.size, cipher.size)
        try {
            return transform(protected, encrypt = false)
        } catch (_: Exception) {
            throw IllegalStateException("Credential decryption failed")
        } catch (_: LinkageError) {
            throw IllegalStateException("Credential decryption failed")
        } finally {
            protected.fill(0)
        }
    }

    private fun transform(bytes: ByteArray, encrypt: Boolean): ByteArray {
        val inputMemory = WipingMemory(bytes.size.toLong())
        val output = DataBlob()
        try {
            inputMemory.write(0, bytes, 0, bytes.size)
            val input = DataBlob(bytes.size, inputMemory)
            val success = if (encrypt) {
                crypt32.CryptProtectData(input, null, null, null, null, CRYPTPROTECT_UI_FORBIDDEN, output)
            } else {
                crypt32.CryptUnprotectData(input, null, null, null, null, CRYPTPROTECT_UI_FORBIDDEN, output)
            }
            check(success != 0) { "DPAPI operation failed" }
            val limit = if (encrypt) MAX_CIPHERTEXT_BYTES - HEADER.size else MAX_PLAINTEXT_BYTES
            check(output.cbData in 1..limit) { "DPAPI result invalid" }
            val pointer = checkNotNull(output.pbData) { "DPAPI result invalid" }
            return pointer.getByteArray(0, output.cbData)
        } finally {
            inputMemory.destroy()
            output.pbData?.let { pointer ->
                if (output.cbData > 0) pointer.clear(output.cbData.toLong())
                check(kernel32.LocalFree(pointer) == null) { "DPAPI cleanup failed" }
            }
        }
    }

    private class WipingMemory(size: Long) : Memory(size) {
        fun destroy() {
            clear()
            dispose()
        }
    }

    internal class DataBlob() : Structure() {
        @JvmField var cbData: Int = 0
        @JvmField var pbData: Pointer? = null

        constructor(size: Int, pointer: Pointer) : this() {
            cbData = size
            pbData = pointer
        }

        override fun getFieldOrder(): List<String> = listOf("cbData", "pbData")
    }

    internal interface Crypt32Api : StdCallLibrary {
        fun CryptProtectData(
            input: DataBlob,
            description: Pointer?,
            optionalEntropy: Pointer?,
            reserved: Pointer?,
            prompt: Pointer?,
            flags: Int,
            output: DataBlob,
        ): Int

        fun CryptUnprotectData(
            input: DataBlob,
            description: Pointer?,
            optionalEntropy: Pointer?,
            reserved: Pointer?,
            prompt: Pointer?,
            flags: Int,
            output: DataBlob,
        ): Int
    }

    internal interface Kernel32Api : StdCallLibrary {
        fun LocalFree(memory: Pointer): Pointer?
    }

    private val crypt32: Crypt32Api by lazy { Native.load("Crypt32", Crypt32Api::class.java) }
    private val kernel32: Kernel32Api by lazy { Native.load("Kernel32", Kernel32Api::class.java) }

    private companion object {
        const val CRYPTPROTECT_UI_FORBIDDEN = 0x1
        const val MAX_PLAINTEXT_BYTES = 32 * 1024
        const val MAX_CIPHERTEXT_BYTES = 64 * 1024
        val HEADER = byteArrayOf('R'.code.toByte(), 'V'.code.toByte(), 'W'.code.toByte(), 1)
    }
}
