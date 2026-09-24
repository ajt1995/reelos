package com.reelos.providers

import org.junit.Assert.*
import org.junit.Test

class TorBoxProviderClientTest {
    private val hash = "a".repeat(40)
    private val keyA = "synthetic-key-A".toCharArray()
    private val keyB = "synthetic-key-B".toCharArray()

    private fun user(id: Int = 7) = """{"success":true,"data":{"id":$id}}"""
    private fun torrent(
        state: String = "completed", id: Int = 10, fileId: Int = 21,
        fileName: String = "Show.S01E02.mkv", fileSize: Int = 200,
        infohash: String = hash,
        finished: Boolean = state in setOf("completed", "cached", "seeding", "uploading"),
        present: Boolean = finished,
    ) = """{"id":$id,"hash":"$infohash","download_state":"$state","download_finished":$finished,"download_present":$present,"files":[{"id":$fileId,"name":"$fileName","size":$fileSize}]}"""
    private fun list(vararg torrents: String) = """{"success":true,"data":[${torrents.joinToString(",")}]}"""
    private fun download(url: String = "https://cdn.torbox.app/lease?signature=temporary") =
        """{"success":true,"data":"$url"}"""

    private fun client(
        userId: Int = 7,
        rows: String = list(torrent()),
        exact: String = list(torrent()),
        lease: String = download(),
        calls: MutableList<Pair<String, ProviderAuth>> = mutableListOf(),
    ): TorBoxProviderClient = TorBoxProviderClient(ProviderTransport { path, _, auth ->
        calls.add(path to auth)
        val body = when {
            path.endsWith("/user/me") -> user(userId)
            path.contains("/mylist?id=") -> exact
            path.contains("/mylist?") -> rows
            path.contains("/requestdl?") -> lease
            else -> error("Unexpected test route")
        }
        ProviderHttpResponse(200, body)
    })

    private fun failure(code: ProviderFailureCode, block: () -> Unit) {
        try { block(); fail("Expected $code") }
        catch (error: ProviderFailure) { assertEquals(code, error.code) }
    }

    @Test fun validatesAccountAndRequiresExactExpectedAccount() {
        val subject = client()
        assertEquals("7", subject.validate(keyA).id)
        failure(ProviderFailureCode.INVALID_CREDENTIAL) { subject.list(keyA, "8") }
        failure(ProviderFailureCode.INVALID_CREDENTIAL) { subject.list(keyA, "") }
        failure(ProviderFailureCode.INVALID_CREDENTIAL) { subject.validate(charArrayOf()) }
    }

    @Test fun listsExplicitFilesAndResolvesOnlySelectedIdentity() {
        val calls = mutableListOf<Pair<String, ProviderAuth>>()
        val pack = """{"id":10,"hash":"$hash","download_finished":true,"download_present":true,"files":[{"id":20,"name":"Show.S01E01.mkv","size":100},{"id":21,"name":"Show.S01E02.mkv","size":200}]}"""
        val subject = client(rows = list(pack), exact = list(pack), calls = calls)
        val videos = subject.list(keyA, "7")
        assertEquals(2, videos.size)
        assertEquals(listOf("20", "21"), videos.map { it.fileId })
        assertEquals("10", videos[1].torrentId)
        assertEquals(hash, videos[1].infohash)
        assertEquals(200L, videos[1].sizeBytes)
        assertTrue(videos[1].ready)
        val stream = subject.resolve(keyA, "7", videos[1])
        assertEquals("https", stream.useLease { it.scheme })
        assertTrue(calls.last().first.contains("torrent_id=10&file_id=21&redirect=false"))
        assertEquals(ProviderAuth.TORBOX_DOWNLOAD_QUERY, calls.last().second)
        assertFalse(calls.last().first.contains(String(keyA)))
        assertFalse(stream.toString().contains("signature"))
    }

    @Test fun paginatesBoundedCachedPagesAndRejectsRepeatedOrOversizedPages() {
        val calls = mutableListOf<String>()
        val first = list(*(1..25).map { torrent(id = it) }.toTypedArray())
        fun paginated(second: String) = TorBoxProviderClient(ProviderTransport { path, _, _ ->
            calls.add(path)
            ProviderHttpResponse(200, when {
                path.endsWith("/user/me") -> user()
                path.endsWith("offset=0") -> first
                path.endsWith("offset=25") -> second
                else -> error("Unexpected pagination route")
            })
        })
        assertEquals(26, paginated(list(torrent(id = 26))).list(keyA, "7").size)
        assertTrue(calls.filter { it.contains("mylist") }.all { it.contains("bypass_cache=false&limit=25&offset=") })
        failure(ProviderFailureCode.INVALID_RESPONSE) { paginated(first).list(keyA, "7") }
        failure(ProviderFailureCode.INVALID_RESPONSE) {
            client(rows = list(*(1..26).map { torrent(id = it) }.toTypedArray())).list(keyA, "7")
        }
        assertEquals(25, paginated(list()).list(keyA, "7").size)
    }

    @Test fun accountOrCredentialChangeCannotReuseListedVideo() {
        val video = client().list(keyA, "7").single()
        failure(ProviderFailureCode.INVALID_CREDENTIAL) { client(userId = 8).resolve(keyA, "7", video) }
        failure(ProviderFailureCode.INVALID_CREDENTIAL) { client().resolve(keyB, "7", video) }
        failure(ProviderFailureCode.INVALID_CREDENTIAL) { client(userId = 8).resolve(keyA, "8", video) }
        assertNotNull(client(userId = 8).list(keyB, "8").single())
    }

    @Test fun pendingAndExactIdentityChangesFailClosedWithoutLeaseCall() {
        val video = client().list(keyA, "7").single()
        val calls = mutableListOf<Pair<String, ProviderAuth>>()
        failure(ProviderFailureCode.NOT_READY) {
            client(exact = list(torrent(state = "downloading")), calls = calls).resolve(keyA, "7", video)
        }
        assertTrue(calls.none { it.first.contains("requestdl") })
        for (changed in arrayOf(
            list(torrent(id = 11)), list(torrent(infohash = "b".repeat(40))),
            list(torrent(fileId = 22)), list(torrent(fileSize = 201)),
            list(torrent(fileName = "Other.S01E02.mkv")),
            list(torrent(), torrent()),
        )) {
            failure(ProviderFailureCode.INVALID_RESPONSE) { client(exact = changed).resolve(keyA, "7", video) }
        }
    }

    @Test fun readinessRequiresFinishedAndPresentFlagsNotAStateLabel() {
        for (state in listOf("completed", "cached", "seeding", "uploading")) {
            assertTrue(client(rows = list(torrent(state = state))).list(keyA, "7").single().ready)
        }
        for (state in listOf("downloading", "failed", "", "complete")) {
            assertFalse(client(rows = list(torrent(state = state))).list(keyA, "7").single().ready)
        }
        assertTrue(client(rows = list(torrent(state = "paused", finished = true, present = true))).list(keyA, "7").single().ready)
        val video = client().list(keyA, "7").single()
        for (row in listOf(torrent(finished = false, present = true), torrent(finished = true, present = false),
            torrent().replace("\"download_finished\":true,", ""), torrent().replace("\"download_present\":true", "\"download_present\":\"true\""))) {
            assertFalse(client(rows = list(row)).list(keyA, "7").single().ready)
            failure(ProviderFailureCode.NOT_READY) { client(exact = list(row)).resolve(keyA, "7", video) }
        }
    }

    @Test fun pageCanReachBeyondOneThousandWithoutLoadingEarlierPages() {
        val calls = mutableListOf<String>()
        val subject = TorBoxProviderClient(ProviderTransport { path, _, _ ->
            calls.add(path)
            ProviderHttpResponse(200, if (path.endsWith("/user/me")) user() else list(torrent(id = 1001)))
        })
        assertEquals("1001", subject.page(keyA, "7", 1000).videos.single().torrentId)
        assertEquals(2, calls.size)
        assertTrue(calls.last().endsWith("offset=1000"))
    }

    @Test fun statusAndMalformedResponsesAreTypedAndRedacted() {
        val statuses = mapOf(
            401 to ProviderFailureCode.INVALID_CREDENTIAL,
            403 to ProviderFailureCode.INVALID_CREDENTIAL,
            408 to ProviderFailureCode.TIMEOUT,
            429 to ProviderFailureCode.RATE_LIMITED,
            500 to ProviderFailureCode.UNAVAILABLE,
        )
        for ((status, code) in statuses) {
            val subject = TorBoxProviderClient(ProviderTransport { _, _, _ ->
                ProviderHttpResponse(status, "synthetic-key-A secret provider body")
            })
            failure(code) { subject.validate(keyA) }
        }
        val malformed = TorBoxProviderClient(ProviderTransport { _, _, _ ->
            ProviderHttpResponse(200, "{\"success\":true,\"success\":true,\"data\":{}}")
        })
        failure(ProviderFailureCode.INVALID_RESPONSE) { malformed.validate(keyA) }
        assertFalse(ProviderHttpResponse(500, "secret body").toString().contains("secret"))
        assertFalse(ProviderFailure(ProviderFailureCode.INVALID_RESPONSE).toString().contains(String(keyA)))
        assertFalse(client().list(keyA, "7").single().toString().contains("Show"))
    }

    @Test fun documentedBodyErrorsClassifyOnlyBadOrMissingTokenAsCredentialFailure() {
        for (providerCode in listOf("BAD_TOKEN", "NO_AUTH", "AUTH_ERROR", "DATABASE_ERROR", "UNKNOWN_ERROR")) {
            val subject = TorBoxProviderClient(ProviderTransport { _, _, _ ->
                ProviderHttpResponse(200,
                    """{"success":false,"error":"$providerCode","detail":"synthetic-key-A private diagnostic","data":null}""")
            })
            val expected = if (providerCode in listOf("BAD_TOKEN", "NO_AUTH"))
                ProviderFailureCode.INVALID_CREDENTIAL else ProviderFailureCode.UNAVAILABLE
            try { subject.validate(keyA); fail("Expected provider failure") }
            catch (error: ProviderFailure) {
                assertEquals(expected, error.code)
                assertFalse(error.toString().contains("synthetic-key-A"))
                assertFalse(error.message.orEmpty().contains("private diagnostic"))
            }
        }
    }

    @Test fun rejectsUnsafeOrCredentialBearingLeaseAndOversizedResponse() {
        val video = client().list(keyA, "7").single()
        for (url in listOf(
            "http://cdn.example.test/file", "https://user:pass@cdn.example.test/file",
            "https://cdn.example.test/file#fragment", "https://cdn.example.test/file?token=synthetic-key-A",
        )) failure(ProviderFailureCode.INVALID_RESPONSE) {
            client(lease = download(url)).resolve(keyA, "7", video)
        }
        val giant = TorBoxProviderClient(ProviderTransport { _, _, _ ->
            ProviderHttpResponse(200, " ".repeat(256 * 1024 + 1))
        })
        failure(ProviderFailureCode.INVALID_RESPONSE) { giant.validate(keyA) }
    }

    @Test fun productionTransportRejectsUnapprovedRoutesBeforeNetwork() {
        val transport = JdkProviderTransport()
        for (path in listOf(
            "https://evil.example/v1/api/user/me",
            "/v1/api/user/me?token=synthetic-key-A",
            "/v1/api/torrents/requestdl?torrent_id=10&file_id=21&redirect=false",
            "/v1/api/other",
        )) failure(ProviderFailureCode.INVALID_RESPONSE) {
            transport.get(path, keyA, ProviderAuth.BEARER)
        }
        failure(ProviderFailureCode.INVALID_RESPONSE) {
            transport.get("/v1/api/torrents/requestdl?torrent_id=10&file_id=21&redirect=true", keyA,
                ProviderAuth.TORBOX_DOWNLOAD_QUERY)
        }
    }

    @Test fun credentialBearingProviderLeaseStaysOpaqueAndRequiresIssuerDomain() {
        val video = client().list(keyA, "7").single()
        val stream = client(lease = download("https://cdn.torbox.app/bytes?token=synthetic-key-A"))
            .resolve(keyA, "7", video)
        assertFalse(stream.toString().contains("synthetic-key-A"))
        for (host in listOf("cdn.torbox.app", "nexus.example.tb-cdn.io", "cdn.tb-cdn.cx",
            "cdn.tb-cdn.pw", "cdn.tb-cdn.sh", "cdn.tb-cdn.st", "cdn.tb-cdn.to", "cdn.tb-cdn.earth")) {
            assertNotNull(client(lease = download("https://$host/bytes?token=synthetic-key-A")).resolve(keyA, "7", video))
        }
        for (host in listOf("torbox.app.evil.example", "eviltorbox.app", "cdn.example.test", "tb-cdn.io.evil.example", "eviltb-cdn.io")) {
            failure(ProviderFailureCode.INVALID_RESPONSE) {
                client(lease = download("https://$host/bytes?token=synthetic-key-A")).resolve(keyA, "7", video)
            }
        }
        val encodedKey = "ab+cd".toCharArray()
        val encodedVideo = client().list(encodedKey, "7").single()
        for (url in listOf("https://evil.example/bytes?token=ab%2bcd", "https://evil.example/bytes?signature=opaque")) {
            failure(ProviderFailureCode.INVALID_RESPONSE) { client(lease = download(url)).resolve(encodedKey, "7", encodedVideo) }
        }
    }
}
