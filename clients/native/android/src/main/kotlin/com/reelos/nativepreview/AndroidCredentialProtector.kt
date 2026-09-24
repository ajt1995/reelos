package com.reelos.nativepreview

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.reelos.providers.SecretProtector
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Keeps provider credentials under a non-exportable key owned by this Android installation. */
class AndroidCredentialProtector(context: Context) : SecretProtector {
    private val alias = "${context.applicationContext.packageName}.provider-credentials.v1"

    override fun protect(plain: ByteArray): ByteArray {
        require(plain.isNotEmpty() && plain.size <= MAX_PLAINTEXT_BYTES) { "Invalid credential size" }
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, existingKey() ?: createKey())
            val nonce = cipher.iv
            check(nonce.size == NONCE_BYTES) { "Credential protection unavailable" }
            cipher.updateAAD(HEADER)
            val encrypted = cipher.doFinal(plain)
            return HEADER + nonce + encrypted
        } catch (_: Exception) {
            throw IllegalStateException("Credential protection failed")
        }
    }

    override fun unprotect(cipher: ByteArray): ByteArray {
        if (cipher.size !in MIN_CIPHERTEXT_BYTES..MAX_CIPHERTEXT_BYTES ||
            !cipher.copyOfRange(0, HEADER.size).contentEquals(HEADER)
        ) {
            throw IllegalArgumentException("Invalid credential ciphertext")
        }
        try {
            // Decryption must never create a replacement key: restored or corrupt data stays unreadable.
            val key = existingKey() ?: throw IllegalStateException("Credential key unavailable")
            val decryptor = Cipher.getInstance(TRANSFORMATION)
            decryptor.init(
                Cipher.DECRYPT_MODE,
                key,
                GCMParameterSpec(TAG_BITS, cipher, HEADER.size, NONCE_BYTES),
            )
            decryptor.updateAAD(HEADER)
            return decryptor.doFinal(cipher, HEADER.size + NONCE_BYTES, cipher.size - HEADER.size - NONCE_BYTES)
        } catch (_: Exception) {
            throw IllegalStateException("Credential decryption failed")
        }
    }

    private fun existingKey(): SecretKey? =
        KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.getKey(alias, null) as? SecretKey

    private fun createKey(): SecretKey = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
        init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .setUserAuthenticationRequired(false)
                .build(),
        )
        generateKey()
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val NONCE_BYTES = 12
        const val TAG_BITS = 128
        const val MAX_PLAINTEXT_BYTES = 32 * 1024
        val HEADER = byteArrayOf('R'.code.toByte(), 'V'.code.toByte(), 'A'.code.toByte(), 1)
        const val MIN_CIPHERTEXT_BYTES = 4 + NONCE_BYTES + TAG_BITS / 8
        const val MAX_CIPHERTEXT_BYTES = MIN_CIPHERTEXT_BYTES + MAX_PLAINTEXT_BYTES
    }
}
