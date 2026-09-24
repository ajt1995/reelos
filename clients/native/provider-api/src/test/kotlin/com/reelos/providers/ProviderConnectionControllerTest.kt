package com.reelos.providers

import org.junit.Test
import kotlin.test.*
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class ProviderConnectionControllerTest {
    // Test-only reversible protector; production hosts always use OS authenticated encryption.
    private val protector = object : SecretProtector {
        override fun protect(plain: ByteArray) = plain.map { (it.toInt() xor 91).toByte() }.toByteArray()
        override fun unprotect(cipher: ByteArray) = protect(cipher)
    }
    private open class FakeClient : ProviderClient {
        override fun validate(secret: CharArray) = ProviderAccount("test-account")
        override fun list(secret: CharArray, expectedAccount: String) = emptyList<ProviderVideo>()
        override fun resolve(secret: CharArray, expectedAccount: String, video: ProviderVideo): ProviderStream = error("Not used")
    }
    private fun withStore(block: (ProtectedConnectionStore) -> Unit) {
        val root = Files.createTempDirectory("provider-controller-test")
        try { block(ProtectedConnectionStore(root.resolve("connection.bin"), protector)) }
        finally { root.toFile().deleteRecursively() }
    }

    @Test fun failedReplacementRevokesOldKeyButMalformedInputDoesNotLieAboutIt() = withStore { store ->
        val good = ProviderConnectionController("Test", FakeClient(), store)
        good.connect("test-key".toCharArray()); assertTrue(good.hasSavedConnection())
        assertFailsWith<ProviderFailure> { good.connect("bad key".toCharArray()) }
        assertTrue(good.hasSavedConnection())
        val bad = ProviderConnectionController("Test", object : FakeClient() {
            override fun validate(secret: CharArray): ProviderAccount = throw ProviderFailure(ProviderFailureCode.INVALID_CREDENTIAL)
        }, store)
        assertFailsWith<ProviderFailure> { bad.connect("rejected-test-key".toCharArray()) }
        assertFalse(good.hasSavedConnection())
    }

    @Test fun disconnectWhileValidatingCannotResurrectConnection() = withStore { store ->
        val entered = CountDownLatch(1); val release = CountDownLatch(1)
        val controller = ProviderConnectionController("Test", object : FakeClient() {
            override fun validate(secret: CharArray): ProviderAccount {
                entered.countDown(); check(release.await(5, TimeUnit.SECONDS)); return ProviderAccount("account")
            }
        }, store)
        var outcome: Throwable? = null
        val worker = thread { outcome = runCatching { controller.connect("test-key".toCharArray()) }.exceptionOrNull() }
        try {
            assertTrue(entered.await(5, TimeUnit.SECONDS)); controller.disconnect()
        } finally { release.countDown(); worker.join(6000) }
        assertFalse(worker.isAlive); assertIs<ConnectionChanged>(outcome); assertFalse(controller.hasSavedConnection())
    }

    @Test fun leavingScreenPreventsPublication() = withStore { store ->
        val controller = ProviderConnectionController("Test", FakeClient(), store)
        assertFailsWith<ConnectionChanged> { controller.connect("test-key".toCharArray()) { false } }
        assertFalse(controller.hasSavedConnection())
    }

    @Test fun collectionResponseAfterAnotherInstanceDisconnectsIsRejected() = withStore { store ->
        val other = ProviderConnectionController("Test", FakeClient(), store)
        val controller = ProviderConnectionController("Test", object : FakeClient() {
            override fun list(secret: CharArray, expectedAccount: String): List<ProviderVideo> {
                other.disconnect(); return emptyList()
            }
        }, store)
        controller.connect("test-key".toCharArray())
        assertFailsWith<ConnectionChanged> { controller.videos() }
    }
}
