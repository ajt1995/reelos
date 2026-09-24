package com.reelos.providers

import org.junit.Test
import kotlin.test.*
import java.nio.file.Files
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

class ProtectedConnectionStoreTest {
    private class TestProtector : SecretProtector {
        private val key = KeyGenerator.getInstance("AES").apply { init(128) }.generateKey()
        override fun protect(plain: ByteArray): ByteArray = Cipher.getInstance("AES/GCM/NoPadding").run {
            init(Cipher.ENCRYPT_MODE, key); iv + doFinal(plain)
        }
        override fun unprotect(cipher: ByteArray): ByteArray = Cipher.getInstance("AES/GCM/NoPadding").run {
            init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, cipher.copyOfRange(0, 12))); doFinal(cipher.copyOfRange(12, cipher.size))
        }
    }

    @Test fun encryptedRoundTripAndBorrowedSecretCleared() {
        val root = Files.createTempDirectory("connection-test")
        try {
            val path = root.resolve("connection.bin")
            val protector = TestProtector()
            val store = ProtectedConnectionStore(path, protector)
            assertNull(store.read())
            val revision = store.replace(store.invalidate(), "test-account", "synthetic-key-only".toCharArray())
            assertFalse(String(Files.readAllBytes(path)).contains("synthetic-key-only"))
            val reopened = ProtectedConnectionStore(path, protector).read()!!
            assertEquals(revision, reopened.revision)
            assertEquals("test-account", reopened.accountId)
            assertContentEquals("synthetic-key-only".toCharArray(), reopened.secret)
            assertFalse(reopened.toString().contains("synthetic"))
            reopened.close(); assertTrue(reopened.secret.all { it == '\u0000' })
        } finally { root.toFile().deleteRecursively() }
    }

    @Test fun persistentTombstoneRejectsLateValidationAcrossStoreInstances() {
        val root = Files.createTempDirectory("connection-test")
        try {
            val path = root.resolve("connection.bin"); val protector = TestProtector()
            val a = ProtectedConnectionStore(path, protector); val b = ProtectedConnectionStore(path, protector)
            val attempt = a.invalidate()
            b.invalidate()
            assertFailsWith<ConnectionChanged> { a.replace(attempt, "account", "test-key".toCharArray()) }
            assertFalse(a.isCurrent(attempt)); assertNull(b.read()!!.use { it.accountId })
        } finally { root.toFile().deleteRecursively() }
    }

    @Test fun tamperAndWrongKeyFailWithoutRawDataOrOverwrite() {
        val root = Files.createTempDirectory("connection-test")
        try {
            val path = root.resolve("connection.bin"); val protector = TestProtector()
            val store = ProtectedConnectionStore(path, protector)
            store.replace(store.invalidate(), "test-account", "synthetic-only".toCharArray())
            assertFailsWith<ConnectionStorageFailure> { ProtectedConnectionStore(path, TestProtector()).read() }
            val bytes = Files.readAllBytes(path); bytes[bytes.lastIndex] = (bytes.last().toInt() xor 1).toByte(); Files.write(path, bytes)
            val error = assertFailsWith<ConnectionStorageFailure> { store.read() }
            assertNull(error.cause); assertContentEquals(bytes, Files.readAllBytes(path))
        } finally { root.toFile().deleteRecursively() }
    }
}
