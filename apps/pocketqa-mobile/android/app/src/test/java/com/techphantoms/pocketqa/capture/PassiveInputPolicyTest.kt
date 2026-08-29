package com.techphantoms.pocketqa.capture

import android.accessibilityservice.AccessibilityServiceInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class PassiveInputPolicyTest {

    @Test
    fun `touchscreen motion sources stay disabled`() {
        assertEquals(0, PassiveInputPolicy.MOTION_EVENT_SOURCES)
    }

    @Test
    fun `motion event flag is removed without disturbing other flags`() {
        val otherFlag = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        val unsafe = otherFlag or AccessibilityServiceInfo.FLAG_SEND_MOTION_EVENTS

        assertEquals(otherFlag, PassiveInputPolicy.sanitizeFlags(unsafe))
    }
}
