package com.reelos.core.ota

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull

class OtaVersionTest {
    @Test fun semanticVersionsCompareWithoutLexicalErrors() {
        assertTrue(isNewerVersion("2.10.0", "2.9.9"))
        assertFalse(isNewerVersion("2.5.0", "2.5.0"))
        assertFalse(isNewerVersion("2.4.9", "2.5.0"))
    }

    @Test fun updateRequestsRequireOnlyThePairedDeviceCookie() {
        val request = authenticatedRequest(
            "https://cinema.example.ts.net/api/app/version".toHttpUrl(),
            "reelos_device_token=fake.device-token_123",
        )!!
        assertEquals("reelos_device_token=fake.device-token_123", request.header("Cookie"))
        assertNull(request.header("Authorization"))
        assertNull(authenticatedRequest(request.url, null))
        assertNull(authenticatedRequest(request.url, "reelos_device_token=fake\r\nInjected: yes"))
        assertNull(authenticatedRequest(request.url, "reelos_profile_session=wrong-boundary"))
    }
}
