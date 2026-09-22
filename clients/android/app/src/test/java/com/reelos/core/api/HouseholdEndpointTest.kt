package com.reelos.core.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class HouseholdEndpointTest {
    @Test fun acceptsPrivateLanAndTailscaleHttps() {
        assertEquals("http://192.168.1.20:8080/", HouseholdEndpoint.parse("192.168.1.20").toString())
        assertEquals("https://cinema.example.ts.net/", HouseholdEndpoint.parse("cinema.example.ts.net").toString())
    }

    @Test fun rejectsPublicCleartextAndEmbeddedCredentials() {
        assertNull(HouseholdEndpoint.parse("http://example.com"))
        assertNull(HouseholdEndpoint.parse("http://user:secret@192.168.1.20:8080"))
        assertNull(HouseholdEndpoint.parse("https://example.ts.net/?token=secret"))
    }

    @Test fun acceptsOnlySameOriginResolvedResources() {
        val base = HouseholdEndpoint.parse("https://cinema.example.ts.net")!!
        assertNotNull(HouseholdEndpoint.sameOrigin(base, "/api/stream/item/film"))
        assertNull(HouseholdEndpoint.sameOrigin(base, "https://other.example/video"))
        assertNull(HouseholdEndpoint.sameOrigin(base, "http://cinema.example.ts.net/video"))
    }
}
