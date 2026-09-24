package com.reelos.providers

/** Platform-owned authenticated encryption. No plaintext or machine-wide fallback. */
interface SecretProtector {
    fun protect(plain: ByteArray): ByteArray
    fun unprotect(cipher: ByteArray): ByteArray
}
