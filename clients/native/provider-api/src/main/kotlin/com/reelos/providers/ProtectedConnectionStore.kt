package com.reelos.providers

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.nio.ByteBuffer
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.util.UUID

/** Secret data never belongs in core snapshots, learned features, or diagnostic strings. */
class StoredConnection internal constructor(val revision: String, val accountId: String?, internal val secret: CharArray) : AutoCloseable {
    fun <T> useSecret(block: (CharArray) -> T): T {
        val borrowed = secret.copyOf()
        return try { block(borrowed) } finally { borrowed.fill('\u0000') }
    }
    override fun close() { secret.fill('\u0000') }
    override fun toString() = "StoredConnection(redacted)"
}

class ConnectionStorageFailure : Exception("Protected connection could not be read or saved.")
class ConnectionChanged : Exception("Connection changed. Try again.")

/** Atomic encrypted record plus persistent tombstone prevents late validation resurrecting a disabled key. */
class ProtectedConnectionStore(private val path: Path, private val protector: SecretProtector) {
    private val lockPath = path.resolveSibling(path.fileName.toString() + ".lock")

    private fun <T> locked(action: () -> T): T = try {
        Files.createDirectories(path.parent)
        FileChannel.open(lockPath, StandardOpenOption.CREATE, StandardOpenOption.WRITE).use { channel ->
            channel.lock().use { action() }
        }
    } catch (failure: ConnectionChanged) { throw failure }
      catch (_: Exception) { throw ConnectionStorageFailure() }

    fun read(): StoredConnection? = locked { readUnlocked() }

    fun invalidate(): String = locked {
        val revision = UUID.randomUUID().toString()
        writeUnlocked(revision, null, charArrayOf())
        revision
    }

    fun replace(expectedRevision: String, accountId: String, secret: CharArray): String = locked {
        require(accountId.isNotBlank() && accountId.length <= 512 && secret.size in 1..4096)
        val current = readUnlocked()
        try { if (current?.revision != expectedRevision) throw ConnectionChanged() } finally { current?.close() }
        val next = UUID.randomUUID().toString()
        writeUnlocked(next, accountId, secret)
        next
    }

    fun isCurrent(revision: String): Boolean = read()?.use { it.revision == revision && it.accountId != null } ?: false

    private fun readUnlocked(): StoredConnection? {
        if (!Files.exists(path)) return null
        require(Files.isRegularFile(path) && !Files.isSymbolicLink(path) && Files.size(path) in 1..65536)
        val cipher = Files.readAllBytes(path)
        val plain = try { protector.unprotect(cipher) } finally { cipher.fill(0) }
        try {
            require(plain.size <= 32768)
            DataInputStream(ByteArrayInputStream(plain)).use { input ->
                require(input.readInt() == 1)
                val revision = input.readUTF()
                require(UUID.fromString(revision).toString() == revision)
                val account = input.readUTF().takeIf { it.isNotEmpty() }
                require(account == null || account.length <= 512)
                val length = input.readInt()
                require(length in 0..16384)
                val keyBytes = ByteArray(length)
                input.readFully(keyBytes)
                val chars = try {
                    val decoded = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(keyBytes))
                    CharArray(decoded.remaining()).also { decoded.get(it); if (decoded.hasArray()) decoded.array().fill('\u0000') }
                } finally { keyBytes.fill(0) }
                if (chars.size > 4096 || (account == null) != chars.isEmpty() || input.read() != -1) {
                    chars.fill('\u0000'); throw ConnectionStorageFailure()
                }
                return StoredConnection(revision, account, chars)
            }
        } finally { plain.fill(0) }
    }

    private fun writeUnlocked(revision: String, account: String?, secret: CharArray) {
        val encoded = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT).encode(CharBuffer.wrap(secret))
        val keyBytes = ByteArray(encoded.remaining()).also { encoded.get(it); if (encoded.hasArray()) encoded.array().fill(0) }
        val buffer = object : ByteArrayOutputStream() { fun clear() { buf.fill(0); reset() } }
        val plain = try {
            DataOutputStream(buffer).use { out -> out.writeInt(1); out.writeUTF(revision); out.writeUTF(account.orEmpty()); out.writeInt(keyBytes.size); out.write(keyBytes) }
            buffer.toByteArray()
        } finally { keyBytes.fill(0); buffer.clear() }
        val cipher = try { protector.protect(plain) } finally { plain.fill(0) }
        var temp: Path? = null
        try {
            require(cipher.size in 1..65536)
            temp = Files.createTempFile(path.parent, ".connection-", ".tmp")
            FileChannel.open(temp, StandardOpenOption.WRITE).use { channel ->
                val data = ByteBuffer.wrap(cipher)
                while (data.hasRemaining()) channel.write(data)
                channel.force(true)
            }
            Files.move(temp, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally { cipher.fill(0); temp?.let { Files.deleteIfExists(it) } }
    }
}
