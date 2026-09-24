package com.reelos.desktop

import com.sun.jna.Memory
import com.sun.jna.Pointer
import com.sun.jna.ptr.LongByReference
import com.sun.jna.ptr.PointerByReference
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream
import java.lang.reflect.Proxy
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test

class DesktopRemoteMediaTest {
    private class BytesSource(private val bytes: ByteArray) : RemoteByteSource {
        override val expectedSize: Long get() = bytes.size.toLong()
        val offsets = mutableListOf<Long>()
        var closed = false
        override fun open(offset: Long): InputStream {
            offsets += offset
            return ByteArrayInputStream(bytes, offset.toInt(), bytes.size - offset.toInt())
        }
        override fun close() { closed = true }
    }

    @Test fun callbackReadsSeeksAndEndsWithoutGivingVlcAUrl() {
        val source = BytesSource("abcdef".toByteArray())
        val callbacks = RemoteMediaCallbacks(source)
        val data = PointerByReference()
        val size = LongByReference()
        assertEquals(0, callbacks.openCallback.callback(null, data, size))
        assertEquals(6L, size.value)
        val buffer = Memory(16)
        assertEquals(4L, callbacks.readCallback.callback(data.value, buffer, 4))
        assertEquals("abcd", String(buffer.getByteArray(0, 4)))
        assertEquals(0, callbacks.seekCallback.callback(data.value, 2))
        assertEquals(4L, callbacks.readCallback.callback(data.value, buffer, 16))
        assertEquals("cdef", String(buffer.getByteArray(0, 4)))
        assertEquals(0, callbacks.seekCallback.callback(data.value, 6))
        assertEquals(0L, callbacks.readCallback.callback(data.value, buffer, 16))
        assertEquals(listOf(0L, 2L), source.offsets)
        callbacks.closeCallback.callback(data.value)
        callbacks.stop()
        assertTrue(source.closed)
        assertFalse(callbacks.failed)
    }

    @Test fun nativePlayerUsesCallbackMediaAndReleasesSourceWithPlayer() {
        val source = BytesSource("abcd".toByteArray())
        val calls = mutableListOf<String>()
        var openCallback: VlcOpenCallback? = null
        val api = Proxy.newProxyInstance(LibVlc::class.java.classLoader, arrayOf(LibVlc::class.java)) { _, method, args ->
            calls += method.name
            when (method.name) {
                "libvlc_get_version" -> "3.0.0-test"
                "libvlc_media_new_callbacks" -> { openCallback = args!![1] as VlcOpenCallback; Pointer(2) }
                "libvlc_media_player_new_from_media" -> Pointer(3)
                "libvlc_media_release", "libvlc_media_player_release", "libvlc_release" -> null
                else -> error("Unexpected native call ${method.name}")
            }
        } as LibVlc
        val constructor = NativeVlc::class.java.getDeclaredConstructor(LibVlc::class.java, Pointer::class.java)
        constructor.isAccessible = true
        val native = constructor.newInstance(api, Pointer(1))
        val playback = native.player(source, 0)
        val data = PointerByReference()
        assertEquals(0, requireNotNull(openCallback).callback(null, data, LongByReference()))
        playback.close()
        native.close()
        assertEquals(1, calls.count { it == "libvlc_media_new_callbacks" })
        assertFalse(calls.any { it == "libvlc_media_new_path" })
        assertTrue(source.closed)
    }

    @Test fun installedLibVlcAcceptsCallbackMediaWhenOptedIn() {
        assumeTrue("Opt in with REELOS_TEST_LIBVLC_CALLBACKS=1", System.getenv("REELOS_TEST_LIBVLC_CALLBACKS") == "1")
        NativeVlc.open().getOrThrow().use { native ->
            native.player(BytesSource("test bytes".toByteArray()), 0).use { /* No playback or network. */ }
        }
    }

    @Test fun incompatibleCallbackAbiFailsBeforeNativeInvocation() {
        val source = BytesSource("abcd".toByteArray())
        val api = Proxy.newProxyInstance(LibVlc::class.java.classLoader, arrayOf(LibVlc::class.java)) { _, method, _ ->
            when (method.name) {
                "libvlc_get_version" -> "4.0.0"
                "libvlc_release" -> null
                else -> error("Callback ABI invoked on incompatible LibVLC")
            }
        } as LibVlc
        val constructor = NativeVlc::class.java.getDeclaredConstructor(LibVlc::class.java, Pointer::class.java)
        constructor.isAccessible = true
        val native = constructor.newInstance(api, Pointer(1))
        try {
            try { native.player(source, 0); fail("Expected ABI rejection") }
            catch (error: IllegalStateException) { assertTrue(error.message.orEmpty().contains("LibVLC 3")) }
            assertTrue(source.closed)
        } finally { native.close() }
    }

    @Test fun invalidSeekAndReadFailureStayInsideCallbackAndSetPlayerError() {
        val source = BytesSource("abcdef".toByteArray())
        val callbacks = RemoteMediaCallbacks(source)
        val data = PointerByReference()
        assertEquals(0, callbacks.openCallback.callback(null, data, LongByReference()))
        assertEquals(-1, callbacks.seekCallback.callback(data.value, 7))
        assertTrue(callbacks.failed)
        assertEquals(-1L, callbacks.readCallback.callback(Pointer(999), Memory(4), 4))
        assertEquals(-1L, callbacks.readCallback.callback(data.value, null, 4))
        callbacks.stop()

        val failedSource = object : RemoteByteSource {
            override val expectedSize = 4L
            override fun open(offset: Long): InputStream = object : InputStream() {
                override fun read(): Int = throw IOException("private signed URL must not escape")
                override fun read(b: ByteArray, off: Int, len: Int): Int = read()
            }
            override fun close() = Unit
        }
        val failedCallbacks = RemoteMediaCallbacks(failedSource)
        val failedData = PointerByReference()
        assertEquals(0, failedCallbacks.openCallback.callback(null, failedData, LongByReference()))
        assertEquals(-1L, failedCallbacks.readCallback.callback(failedData.value, Memory(4), 4))
        assertTrue(failedCallbacks.failed)
        failedCallbacks.stop()
    }

    @Test fun stopCancelsBlockedReadBeforeNativeStopAndKeepsCallbacksAlive() {
        val entered = CountDownLatch(1)
        val cancelled = CountDownLatch(1)
        val source = object : RemoteByteSource {
            override val expectedSize = 10L
            @Volatile var closed = false
            override fun open(offset: Long): InputStream = object : InputStream() {
                override fun read(): Int = throw UnsupportedOperationException()
                override fun read(b: ByteArray, off: Int, len: Int): Int {
                    entered.countDown()
                    cancelled.await(5, TimeUnit.SECONDS)
                    throw IOException("cancelled")
                }
                override fun close() { cancelled.countDown() }
            }
            override fun close() { closed = true; cancelled.countDown() }
        }
        val callbacks = RemoteMediaCallbacks(source)
        val data = PointerByReference()
        assertEquals(0, callbacks.openCallback.callback(null, data, LongByReference()))
        val executor = Executors.newSingleThreadExecutor()
        try {
            val read = executor.submit<Long> { callbacks.readCallback.callback(data.value, Memory(16), 10) }
            assertTrue(entered.await(2, TimeUnit.SECONDS))
            val api = Proxy.newProxyInstance(LibVlc::class.java.classLoader, arrayOf(LibVlc::class.java)) { _, method, _ ->
                when (method.name) {
                    "libvlc_media_player_stop" -> { assertTrue(source.closed); null }
                    "libvlc_media_player_release" -> null
                    else -> error("Unexpected native call ${method.name}")
                }
            } as LibVlc
            val playback = VlcPlayback(api, Pointer(1), 0, callbacks)
            val started = VlcPlayback::class.java.getDeclaredField("started")
            started.isAccessible = true
            (started.get(playback) as AtomicBoolean).set(true)
            playback.close()
            assertEquals(-1L, read.get(2, TimeUnit.SECONDS))
            assertTrue(callbacks.failed)
        } finally {
            callbacks.stop()
            executor.shutdownNow()
        }
    }
}
