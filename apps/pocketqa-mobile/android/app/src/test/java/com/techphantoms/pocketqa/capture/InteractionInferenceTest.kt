package com.techphantoms.pocketqa.capture

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * CAP-05 — the labelled corpus in miniature.
 *
 * Each case is a (before, after, expected target) triple of the kind CAP-03 will
 * collect from real devices. Hand-written trees keep the algorithm honest before
 * the device corpus exists, and they pin the cases a real corpus would under-
 * represent: the ambiguous transition, the self-updating clock, the scroll.
 */
class InteractionInferenceTest {

    private val json = Json { ignoreUnknownKeys = true }

    private fun node(
        id: String, role: String, label: String,
        clickable: Boolean = true, enabled: Boolean = true, visible: Boolean = true,
        checkable: Boolean = false, checked: Boolean? = null, selected: Boolean = false,
        fp: String = "$role|${label.lowercase()}",
    ) = """
        {"nodeId":"$id","role":"$role","text":"$label","fingerprint":"$fp",
         "clickable":$clickable,"enabled":$enabled,"visible":$visible,
         "checkable":$checkable,${if (checked != null) "\"checked\":$checked," else ""}
         "selected":$selected}
    """.trimIndent()

    private fun state(screen: String, vararg nodes: String): JsonObject =
        json.parseToJsonElement(
            """{"id":"s_$screen","screenName":"$screen","nodes":[${nodes.joinToString(",")}]}"""
        ) as JsonObject

    @Test
    fun `navigation is attributed to the control naming the destination`() {
        // The case that matters most: it is what a QA flow mostly does, and it is
        // exactly what produced zero steps on the device.
        val before = state("Products",
            node("n_1", "button", "Add"),
            node("n_2", "button", "Cart"),
        )
        val after = state("Cart", node("n_9", "text", "Wireless Headphones", clickable = false))

        val result = InteractionInference.infer(before, after)!!
        assertEquals("n_2", result.nodeId)
        assertTrue(result.signals.any { it.contains("destination") })
    }

    @Test
    fun `a flipped toggle is attributed to the toggle`() {
        val before = state("Cart",
            node("n_1", "switch", "Save coupon", checkable = true, checked = false),
            node("n_2", "button", "Apply"),
        )
        val after = state("Cart",
            node("n_1", "switch", "Save coupon", checkable = true, checked = true),
            node("n_2", "button", "Apply"),
        )

        val result = InteractionInference.infer(before, after)!!
        assertEquals("n_1", result.nodeId)
        assertTrue(result.confidence >= InteractionInference.ACCEPT)
    }

    @Test
    fun `a control that changes its own label is attributed to itself`() {
        val before = state("Products", node("n_1", "button", "Add", fp = "button|add-slot"))
        val after = state("Products", node("n_1", "button", "Added", fp = "button|add-slot"))

        val result = InteractionInference.infer(before, after)!!
        assertEquals("n_1", result.nodeId)
        assertTrue(result.signals.any { it.contains("own state") })
    }

    @Test
    fun `non-interactive nodes are never attributed`() {
        // Affordance is a filter, not a score. A heading that happens to sit next
        // to the change must not win.
        val before = state("Cart",
            node("n_head", "text", "Cart", clickable = false),
            node("n_btn", "button", "Checkout"),
        )
        val after = state("Checkout", node("n_x", "text", "Confirm Order", clickable = false))

        val result = InteractionInference.infer(before, after)!!
        assertEquals("n_btn", result.nodeId)
    }

    @Test
    fun `a disabled control is never attributed`() {
        val before = state("Cart",
            node("n_off", "button", "Checkout", enabled = false),
            node("n_on", "button", "Apply"),
        )
        val after = state("Cart", node("n_on", "button", "Apply", enabled = false))

        val result = InteractionInference.infer(before, after)!!
        assertEquals("n_on", result.nodeId)
    }

    @Test
    fun `an ambiguous transition lands below the accept threshold`() {
        // Two identical buttons, nothing distinguishes them. The honest answer is
        // low confidence, which routes to human review rather than a coin flip.
        val before = state("List",
            node("n_1", "button", "Open", fp = "button|open|a"),
            node("n_2", "button", "Open", fp = "button|open|b"),
        )
        val after = state("Detail", node("n_9", "text", "Detail", clickable = false))

        val result = InteractionInference.infer(before, after)!!
        assertTrue(
            "ambiguous transition should not be confident, got ${result.confidence}",
            result.confidence < InteractionInference.ACCEPT,
        )
        assertTrue(result.needsHumanCorrection)
        assertTrue(result.alternatives.isNotEmpty())
    }

    @Test
    fun `an identical pair of states attributes nothing`() {
        val s = state("Cart", node("n_1", "button", "Apply"))
        assertNull(InteractionInference.infer(s, s))
    }

    @Test
    fun `a wholesale replacement is not attributed to a tap`() {
        // A scroll or a fresh render replaces everything. There is no visible
        // control left to blame, and guessing one would be fabrication.
        val before = state("List", *(1..10).map { node("n_$it", "listItem", "Row $it") }.toTypedArray())
        val after = state("List", *(20..29).map { node("n_$it", "listItem", "Row $it") }.toTypedArray())
        assertNull(InteractionInference.infer(before, after))
    }

    @Test
    fun `accessibility focus breaks a tie when the platform reports it`() {
        val before = state("List",
            node("n_1", "button", "Open", fp = "button|open|a"),
            node("n_2", "button", "Open", fp = "button|open|b"),
        )
        val after = state("Detail", node("n_9", "text", "Detail", clickable = false))

        val blind = InteractionInference.infer(before, after)!!
        val hinted = InteractionInference.infer(before, after, focusedNodeId = "n_2")!!

        assertEquals("n_2", hinted.nodeId)
        assertTrue(
            "a focus hint must raise confidence, ${blind.confidence} -> ${hinted.confidence}",
            hinted.confidence > blind.confidence,
        )
    }

    @Test
    fun `alternatives are ranked and exclude the chosen target`() {
        val before = state("Cart",
            node("n_1", "button", "Checkout"),
            node("n_2", "button", "Apply"),
            node("n_3", "button", "Remove"),
        )
        val after = state("Checkout", node("n_9", "text", "Confirm", clickable = false))

        val result = InteractionInference.infer(before, after)!!
        assertTrue(result.nodeId !in result.alternatives)
    }
}
