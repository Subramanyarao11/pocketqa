package com.techphantoms.pocketqa.capture

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StateDiffTest {
    private val json = Json { ignoreUnknownKeys = true }

    private fun state(screen: String, vararg nodes: String): JsonObject =
        json.parseToJsonElement(
            """{"id":"s","screenName":"$screen","nodes":[${nodes.joinToString(",")}]}"""
        ) as JsonObject

    private fun n(id: String, label: String, fp: String, checked: Boolean? = null) = """
        {"nodeId":"$id","role":"button","text":"$label","fingerprint":"$fp",
         "clickable":true,"enabled":true,"visible":true,
         "checkable":${checked != null}${if (checked != null) ",\"checked\":$checked" else ""}}
    """.trimIndent()

    @Test
    fun `matching is by fingerprint so a shifted path id is not a change`() {
        // The whole reason fingerprints exist: inserting a row renumbers every
        // path id below it, and matching on nodeId would report the screen as
        // entirely replaced.
        val before = state("S", n("n_0", "Apply", "fp-apply"))
        val after = state("S", n("n_0_3", "Apply", "fp-apply"))

        val d = StateDiff.diff(before, after)
        assertTrue("a renumbered path must not read as churn", d.isEmpty)
    }

    @Test
    fun `a changed field is reported with both values`() {
        val before = state("S", n("n_1", "Add", "fp-a"))
        val after = state("S", n("n_1", "Added", "fp-a"))

        val d = StateDiff.diff(before, after)
        assertEquals(1, d.changed.size)
        val change = d.changed.first().fields.first { it.field == "label" }
        assertEquals("Add", change.from)
        assertEquals("Added", change.to)
    }

    @Test
    fun `duplicate fingerprints pair off rather than collapsing`() {
        val before = state("S", n("a", "Open", "dup"), n("b", "Open", "dup"))
        val after = state("S", n("c", "Open", "dup"))

        val d = StateDiff.diff(before, after)
        assertEquals("one of the two identical rows is gone", 1, d.removed.size)
    }

    @Test
    fun `screen change is reported`() {
        val d = StateDiff.diff(state("Cart", n("x", "Go", "f")), state("Checkout"))
        assertTrue(d.screenChanged)
        assertEquals("Checkout", d.afterScreen)
    }
}
