package com.reelos.desktop

import com.reelos.core.*
import com.reelos.providers.*
import com.reelos.presentation.ProviderMediaAccess
import org.junit.Test
import kotlin.test.*
import java.nio.file.Files

class ProviderMediaAccessTest {
    @Test fun projectionIsProfileBoundAndRevokedWithoutTouchingOriginals() {
        val root = Files.createTempDirectory("provider-projection-test")
        try {
            val state = MemoryCoreStore()
            fun current() = ReelCore(state, DeviceKind.WINDOWS)
            current().apply {
                createProfile("owner", "Owner"); setColor("owner", "#376FE4"); acknowledgeCurator("owner")
                finishTaste("owner"); confirmDefaultSources("owner"); chooseHome("owner", null)
                putMedia(MediaRecord("original", "Personal original", PERSONAL_SOURCE_ID, MediaAvailability.READY))
            }
            val client = TorBoxProviderClient(ProviderTransport { path, _, _ ->
                ProviderHttpResponse(200, when {
                    path.contains("/user/me") -> """{"success":true,"data":{"id":7}}"""
                    path.contains("/requestdl") -> """{"success":true,"data":"https://cdn.torbox.app/movie"}"""
                    else -> """{"success":true,"data":[{"id":1,"hash":"${"a".repeat(40)}","download_finished":true,"download_present":true,"files":[{"id":2,"name":"test.mp4","size":200}]}]}"""
                })
            })
            val protector = object : SecretProtector {
                override fun protect(plain: ByteArray) = plain.copyOf() // Isolated synthetic test only.
                override fun unprotect(cipher: ByteArray) = cipher.copyOf()
            }
            val connection = ProviderConnectionController("Test", client, ProtectedConnectionStore(root.resolve("key.bin"), protector))
            connection.connect("synthetic-key".toCharArray())
            // No byte test is claimed: range/decoder acceptance is independently exercised.
            val media = ProviderMediaAccess(::current, connection, probe = {})
            val prepared = media.prepare(connection.videos().single())
            try {
                assertEquals(MediaAction.PLAY, current().mediaAction(prepared.mediaId))
                assertTrue(prepared.isAuthorized())
                connection.disconnect(); media.reconcile()
                assertFalse(prepared.isAuthorized())
                assertNotEquals(MediaAction.PLAY, current().mediaAction(prepared.mediaId))
                assertEquals(MediaAction.PLAY, current().mediaAction("original"))
            } finally { prepared.close() }
        } finally { root.toFile().deleteRecursively() }
    }
}
