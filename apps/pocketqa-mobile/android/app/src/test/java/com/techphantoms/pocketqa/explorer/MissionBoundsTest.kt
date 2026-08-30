package com.techphantoms.pocketqa.explorer

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The bound the operator approves must be the bound the agent runs with.
 *
 * React Native carries every JS number across the bridge as a Double, so a
 * mission approved for 3 actions is stored as `3.0`. Parsing that as an Int
 * yields null, and the agent silently fell back to a *larger* default — the one
 * direction a safety bound must never fail in.
 */
class MissionBoundsTest {

    private fun mission(json: String) = Json.parseToJsonElement(json) as JsonObject

    @Test
    fun `bounds that crossed the bridge as doubles are honoured`() {
        val m = mission("""{"maxActions":3.0,"maxDurationSeconds":60.0}""")
        assertEquals(3, ExplorerBounds.actions(m))
        assertEquals(60, ExplorerBounds.seconds(m))
    }

    @Test
    fun `plain integers still work`() {
        val m = mission("""{"maxActions":4,"maxDurationSeconds":30}""")
        assertEquals(4, ExplorerBounds.actions(m))
        assertEquals(30, ExplorerBounds.seconds(m))
    }

    @Test
    fun `a fractional budget truncates rather than rounding up`() {
        // A ceiling that rounds up is not a ceiling.
        val m = mission("""{"maxActions":3.9,"maxDurationSeconds":59.9}""")
        assertEquals(3, ExplorerBounds.actions(m))
        assertEquals(59, ExplorerBounds.seconds(m))
    }

    @Test
    fun `missing bounds fall back to the documented defaults`() {
        val m = mission("""{}""")
        assertEquals(ExplorerBounds.DEFAULT_ACTIONS, ExplorerBounds.actions(m))
        assertEquals(ExplorerBounds.DEFAULT_SECONDS, ExplorerBounds.seconds(m))
    }
}
