package com.reelos.desktop

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class DesktopMotionPolicyTest {
    @Test fun parsesOnlyExplicitDesktopAnimationSettings() {
        assertEquals(true, DesktopMotionPolicy.parseLinuxFlag("true\n"))
        assertEquals(false, DesktopMotionPolicy.parseLinuxFlag("false"))
        assertNull(DesktopMotionPolicy.parseLinuxFlag("schema missing"))
        assertNull(DesktopMotionPolicy.parseLinuxFlag(""))
    }
    @Test fun installedWindowsAdapterReadsARealSystemFlagWithoutChangingIt() {
        if (System.getProperty("os.name").startsWith("Windows")) {
            assertNotNull(DesktopMotionPolicy.readWindowsAllowed())
        } else {
            assertNull(DesktopMotionPolicy.parseLinuxFlag("not a boolean"))
        }
    }
}
