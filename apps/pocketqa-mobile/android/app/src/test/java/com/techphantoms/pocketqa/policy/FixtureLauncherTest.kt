package com.techphantoms.pocketqa.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FixtureLauncherTest {

    @Test
    fun `declared fixture expands into the app-owned URI`() {
        assertEquals(
            "demoshop://reset?fixture=coupon-retry",
            FixtureLauncher.expandUri("demoshop://reset?fixture={fixture}", "coupon-retry"),
        )
    }

    @Test
    fun `unsafe or unsupported fixture ids are rejected`() {
        assertNull(FixtureLauncher.expandUri("demoshop://reset?fixture={fixture}", "../settings"))
        assertNull(FixtureLauncher.expandUri("demoshop://reset", "coupon-retry"))
    }
}
