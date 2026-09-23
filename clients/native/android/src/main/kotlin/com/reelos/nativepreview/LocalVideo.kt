package com.reelos.nativepreview

import android.content.Context
import android.content.Intent
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.SystemClock
import java.io.File
import java.util.UUID

/** Selected local bytes only. First-frame validation is not full-film certification. */
internal object LocalVideo {
    fun verifyFirstFrame(context: Context, uri: Uri) {
        verifyAccess(context, uri)
        val extractor = MediaExtractor()
        var decoder: MediaCodec? = null
        try {
            if (uri.scheme == "file") extractor.setDataSource(requireNotNull(uri.path))
            else extractor.setDataSource(context, uri, null)
            val track = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
            } ?: error("No video track")
            val format = extractor.getTrackFormat(track)
            val width = format.getInteger(MediaFormat.KEY_WIDTH)
            val height = format.getInteger(MediaFormat.KEY_HEIGHT)
            require(width in 1..8192 && height in 1..8192) { "Unsupported video size" }
            extractor.selectTrack(track)
            val codec = MediaCodec.createDecoderByType(requireNotNull(format.getString(MediaFormat.KEY_MIME)))
            decoder = codec
            codec.configure(format, null, null, 0)
            codec.start()
            val deadline = SystemClock.elapsedRealtime() + 8_000
            var ended = false
            val info = MediaCodec.BufferInfo()
            while (SystemClock.elapsedRealtime() < deadline && !Thread.currentThread().isInterrupted) {
                if (!ended) {
                    val input = codec.dequeueInputBuffer(10_000)
                    if (input >= 0) {
                        val buffer = requireNotNull(codec.getInputBuffer(input))
                        val size = extractor.readSampleData(buffer, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(input, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            ended = true
                        } else {
                            codec.queueInputBuffer(input, 0, size, extractor.sampleTime.coerceAtLeast(0), 0)
                            extractor.advance()
                        }
                    }
                }
                val output = codec.dequeueOutputBuffer(info, 10_000)
                if (output >= 0) {
                    val decoded = info.size > 0 && info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0
                    codec.releaseOutputBuffer(output, false)
                    if (decoded) return
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                }
            }
            error("No video frame decoded within the validation budget")
        } finally {
            runCatching { decoder?.stop() }
            decoder?.release()
            extractor.release()
        }
    }

    fun retain(context: Context, uri: Uri): Uri {
        // SAF grants can survive restarts without duplicating the original file.
        val retained = runCatching {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }.isSuccess
        if (retained) return uri
        // Open-with grants may be temporary. Keep a bounded private copy, never a dead URI.
        val directory = File(context.filesDir, "media").apply { check(isDirectory || mkdirs()) }
        val budget = minOf(1024L * 1024 * 1024, directory.usableSpace - 256L * 1024 * 1024)
        require(budget > 0) { "Not enough free storage for a private copy" }
        val target = File(directory, "${UUID.randomUUID()}.video")
        try {
            requireNotNull(context.contentResolver.openInputStream(uri)).use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var total = 0L
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        require(total <= budget && directory.usableSpace > 256L * 1024 * 1024) {
                            "Selected video exceeds available import storage"
                        }
                        output.write(buffer, 0, count)
                    }
                    require(total > 0) { "Empty video" }
                    output.fd.sync()
                }
            }
            return Uri.fromFile(target)
        } catch (failure: Exception) {
            target.delete() // Only this attempt's newly allocated private partial copy.
            throw failure
        }
    }

    fun verifyAccess(context: Context, uri: Uri) {
        when (uri.scheme) {
            "content" -> context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { }
                ?: error("File permission unavailable")
            "file" -> {
                val file = File(requireNotNull(uri.path)).canonicalFile
                val parent = File(context.filesDir, "media").canonicalFile
                require(file.parentFile == parent && file.isFile && file.canRead()) { "Invalid private media path" }
            }
            else -> error("Only selected local media is supported")
        }
    }

    fun discardPrivateCopy(context: Context, uri: Uri) {
        if (uri.scheme != "file") return
        val file = File(requireNotNull(uri.path)).canonicalFile
        val parent = File(context.filesDir, "media").canonicalFile
        require(file.parentFile == parent && Regex("[0-9a-f-]{36}\\.video").matches(file.name))
        // Only copies allocated by retain(), never a selected original or external URI.
        if (file.exists()) check(file.delete()) { "Could not remove superseded private copy" }
    }
}
