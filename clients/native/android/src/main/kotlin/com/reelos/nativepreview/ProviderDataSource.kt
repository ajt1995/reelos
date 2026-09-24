package com.reelos.nativepreview

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSpec
import com.reelos.providers.RemoteByteStream
import com.reelos.providers.RemoteRange
import java.io.IOException

/** Media3 sees only an opaque local identity; the shared adapter owns all HTTP and authorization. */
@UnstableApi
internal class ProviderDataSource(private val remote: RemoteByteStream) : BaseDataSource(true) {
    private var range: RemoteRange? = null
    private var opened = false
    override fun open(dataSpec: DataSpec): Long {
        close()
        transferInitializing(dataSpec)
        try {
            check(dataSpec.position in 0..remote.expectedSize)
            val available = remote.expectedSize - dataSpec.position
            val length = if (dataSpec.length == C.LENGTH_UNSET.toLong()) available else minOf(dataSpec.length, available)
            if (length > 0) range = remote.open(dataSpec.position, length)
            opened = true; transferStarted(dataSpec)
            return length
        } catch (_: Exception) { throw IOException("This stream is unavailable.") }
    }
    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        val count = range?.read(buffer, offset, length) ?: C.RESULT_END_OF_INPUT
        if (count > 0) bytesTransferred(count)
        return count
    }
    override fun getUri(): Uri = Uri.parse("reelos://authorized-media")
    override fun close() {
        range?.close(); range = null
        if (opened) { opened = false; transferEnded() }
    }
}
