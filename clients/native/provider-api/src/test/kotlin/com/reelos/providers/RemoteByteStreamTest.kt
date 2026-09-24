package com.reelos.providers

import okhttp3.Dns
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import java.io.IOException
import java.net.InetAddress
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RemoteByteStreamTest {
    @Test fun onlyPublicDirectAddressesAreAccepted() {
        fun address(vararg bytes: Int) = InetAddress.getByAddress(bytes.map(Int::toByte).toByteArray())
        assertTrue(RemoteAddressPolicy.isPublic(address(8, 8, 8, 8)))
        assertTrue(RemoteAddressPolicy.isPublic(address(0x26, 0x06, 0x47, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x11, 0x11)))
        listOf(
            address(127, 0, 0, 1), address(10, 1, 2, 3), address(192, 168, 1, 1),
            address(169, 254, 1, 1), address(100, 64, 1, 1), address(198, 18, 1, 1),
            address(0, 0, 0, 0), address(224, 0, 0, 1),
            address(0xfd, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
            address(0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0, 192, 168, 1, 1),
            address(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 127, 0, 0, 1),
            address(0x20, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
        ).forEach { assertFalse(RemoteAddressPolicy.isPublic(it)) }
    }

    @Test fun exactPartialResponseStreamsOnlyRequestedBytesAndChecksRevocation() {
        val authorized = AtomicBoolean(true)
        val requests = mutableListOf<Request>()
        val stream = fakeStream(10, authorized, { request ->
            requests += request
            partial(request, byteArrayOf(3, 4, 5, 6), "bytes 3-6/10")
        })
        val range = stream.open(3, 4)
        assertEquals(4, range.length)
        assertContentEquals(byteArrayOf(3, 4, 5, 6), range.readBytes())
        assertEquals("bytes=3-6", requests.single().header("Range"))
        assertEquals("identity", requests.single().header("Accept-Encoding"))
        range.close()
        stream.close()

        val revokedStream = fakeStream(10, authorized, { request ->
            partial(request, byteArrayOf(3, 4, 5, 6), "bytes 3-6/10")
        })
        authorized.set(true)
        val revokedRange = revokedStream.open(3, 4)
        authorized.set(false)
        assertFailsWith<IOException> { revokedRange.read(ByteArray(4)) }
        revokedStream.close()
    }

    @Test fun mixedPrivateDnsAnswerAndRedirectToPrivateAddressFailBeforeRequest() {
        var requests = 0
        val mixedDns = dns { listOf(publicAddress(), InetAddress.getByAddress(byteArrayOf(10, 0, 0, 1))) }
        val mixed = fakeStream(4, AtomicBoolean(true), { request ->
            requests++
            partial(request, byteArrayOf(1, 2, 3, 4), "bytes 0-3/4")
        }, mixedDns)
        assertFailsWith<IllegalStateException> { mixed.open(0) }
        assertEquals(0, requests)

        val redirectDns = dns { host ->
            if (host == "blocked.example") listOf(InetAddress.getByAddress(byteArrayOf(127, 0, 0, 1)))
            else listOf(publicAddress())
        }
        val redirected = fakeStream(4, AtomicBoolean(true), { request ->
            requests++
            redirect(request, "https://blocked.example/bytes")
        }, redirectDns)
        assertFailsWith<IllegalStateException> { redirected.open(0) }
        assertEquals(1, requests)
    }

    @Test fun ignoredSeekHtmlWrongRangeAndWrongLengthFailClosed() {
        val cases = listOf<(Request) -> Response>(
            { request -> response(request, 200, "OK", byteArrayOf(1, 2, 3, 4)) },
            { request -> partial(request, "html".encodeToByteArray(), "bytes 0-3/4", "text/html") },
            { request -> partial(request, byteArrayOf(1, 2, 3, 4), "bytes 1-4/4") },
            { request -> partial(request, byteArrayOf(1, 2, 3), "bytes 0-3/4") },
        )
        cases.forEach { respond ->
            fakeStream(4, AtomicBoolean(true), respond).use { stream ->
                assertFailsWith<IllegalStateException> { stream.open(0) }
            }
        }
        fakeStream(6, AtomicBoolean(true), { request ->
            partial(request, "<html>".encodeToByteArray(), "bytes 0-5/6")
        }).use { stream -> assertFailsWith<IllegalStateException> { stream.open(0) } }
    }

    @Test fun redirectsDropOldQueryAndNeverForwardAuthOrCookies() {
        val requests = mutableListOf<Request>()
        val stream = fakeStream(4, AtomicBoolean(true), { request ->
            requests += request
            if (requests.size == 1) redirect(request, "https://other.example/media")
            else partial(request, byteArrayOf(1, 2, 3, 4), "bytes 0-3/4")
        }, uri = URI("https://provider.example/media?synthetic=token"))
        stream.use { source -> source.open(0).use { assertContentEquals(byteArrayOf(1, 2, 3, 4), it.readBytes()) } }
        assertEquals(2, requests.size)
        assertEquals("/media", requests[1].url.encodedPath)
        assertEquals(null, requests[1].url.encodedQuery)
        assertEquals(null, requests[1].header("Authorization"))
        assertEquals(null, requests[1].header("Cookie"))
    }

    @Test fun invalidEndpointsAndClosedStreamAreRejected() {
        listOf(
            "http://provider.example/media", "https://user:pass@provider.example/media",
            "https://provider.example:8443/media", "https://provider.example/media#part",
            "https://8.8.8.8/media", "https://[::ffff:8.8.8.8]/media",
        ).forEach { value ->
            assertFailsWith<IllegalArgumentException> { fakeStream(4, AtomicBoolean(true), { request ->
                partial(request, byteArrayOf(1, 2, 3, 4), "bytes 0-3/4")
            }, uri = URI(value)) }
        }
        val stream = fakeStream(4, AtomicBoolean(true), { request ->
            partial(request, byteArrayOf(1, 2, 3, 4), "bytes 0-3/4")
        })
        val range = stream.open(0)
        stream.close()
        assertFailsWith<IOException> { range.read() }
        assertFailsWith<IllegalStateException> { stream.open(0) }
    }

    private fun publicAddress() = InetAddress.getByAddress(byteArrayOf(8, 8, 8, 8))

    private fun dns(resolve: (String) -> List<InetAddress>): Dns = object : Dns {
        override fun lookup(hostname: String): List<InetAddress> = resolve(hostname)
    }

    private fun fakeStream(
        size: Long,
        authorized: AtomicBoolean,
        respond: (Request) -> Response,
        dns: Dns = dns { listOf(publicAddress()) },
        uri: URI = URI("https://provider.example/media"),
    ): RemoteByteStream {
        val client = OkHttpClient.Builder().addInterceptor(Interceptor { respond(it.request()) }).build()
        return RemoteByteStream(uri, size, authorized::get, client, dns)
    }

    private fun partial(request: Request, bytes: ByteArray, contentRange: String, contentType: String = "application/octet-stream") =
        response(request, 206, "Partial Content", bytes)
            .newBuilder()
            .header("Content-Range", contentRange)
            .header("Content-Length", bytes.size.toString())
            .header("Content-Type", contentType)
            .build()

    private fun redirect(request: Request, location: String) =
        response(request, 302, "Found", byteArrayOf())
            .newBuilder().header("Location", location).build()

    private fun response(request: Request, code: Int, message: String, bytes: ByteArray) = Response.Builder()
        .request(request).protocol(Protocol.HTTP_1_1).code(code).message(message)
        .body(bytes.toResponseBody()).build()
}
