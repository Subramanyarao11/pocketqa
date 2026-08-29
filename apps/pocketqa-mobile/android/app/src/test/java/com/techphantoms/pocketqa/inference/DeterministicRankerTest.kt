package com.techphantoms.pocketqa.inference

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-language parity for the deterministic engine (Track A task AI-A-15).
 *
 * The expected scores are the output of `services/ai-lab/app/relevance.py` on
 * `packages/ai-fixtures/coupon-retry/rank_assertions.request.json`. If Kotlin
 * and Python disagree, an approved test compiled in the lab would replay
 * differently on the device, and the fixture corpus would stop being evidence
 * about the product.
 *
 * Regenerate the expectations with:
 *   cd services/ai-lab && .venv/bin/python -c "..."   (see the doc comment in
 *   DeterministicRanker for the reference implementation)
 */
class DeterministicRankerTest {

    private val intent = "Verify SAVE20 remains applied after checkout fails and I retry"

    private val candidates = listOf(
        DeterministicRanker.Candidate("a1",
            "Text 'SAVE20 applied' visible in the final cart state", true),
        DeterministicRanker.Candidate("a2",
            "Text 'Network error. Please try again.' visible after placing the order", false),
        DeterministicRanker.Candidate("a3",
            "Text 'Loading…' visible while the retry is in flight", false),
        DeterministicRanker.Candidate("a4",
            "Text 'Total Rs 399' visible in the final cart state", true),
        DeterministicRanker.Candidate("a5",
            "Text 'Order ID 8f3a91c2e4b7d6a5' visible in the final cart state", true),
        DeterministicRanker.Candidate("a6",
            "Text 'Continue shopping' visible in the final cart state", true),
        DeterministicRanker.Candidate("a7",
            "Text 'Discount Rs 100' visible in the final cart state", true),
    )

    @Test
    fun `scores match the python reference`() {
        val expected = mapOf(
            "a1" to 0.7143, "a2" to 0.3486, "a4" to 0.1500,
            "a6" to 0.1500, "a7" to 0.1500, "a3" to 0.0000, "a5" to 0.0000,
        )
        val ranked = DeterministicRanker.rankAssertions(intent, candidates)
        for (row in ranked) {
            assertEquals("score for ${row.candidateId}", expected.getValue(row.candidateId), row.score, 1e-4)
        }
    }

    @Test
    fun `ordering matches the python reference`() {
        val ranked = DeterministicRanker.rankAssertions(intent, candidates).map { it.candidateId }
        assertEquals(listOf("a1", "a2", "a4", "a6", "a7", "a3", "a5"), ranked)
    }

    @Test
    fun `transient and per-run text sink to the bottom`() {
        val ranked = DeterministicRanker.rankAssertions(intent, candidates).map { it.candidateId }
        // a3 is a loading message, a5 carries a per-run order id. Both are true
        // when observed and useless as assertions (spec §17.2).
        assertEquals(setOf("a3", "a5"), ranked.takeLast(2).toSet())
    }

    @Test
    fun `reason explains the dominant signal, not a weak positive`() {
        val ranked = DeterministicRanker.rankAssertions(intent, candidates)
        val orderId = ranked.first { it.candidateId == "a5" }
        assertTrue(orderId.reason, orderId.reason.contains("identifier"))
    }

    @Test
    fun `ties break on input order, never on id`() {
        // a4, a6 and a7 all score 0.15. Reversing their input order must reverse
        // their output order — a stable, reproducible rule the Python engine
        // shares. Sorting on the id instead would silently diverge.
        val reordered = listOf(candidates[6], candidates[5], candidates[3])
        val ranked = DeterministicRanker.rankAssertions(intent, reordered).map { it.candidateId }
        assertEquals(listOf("a7", "a6", "a4"), ranked)
    }

    @Test
    fun `hinglish intent still finds the coupon code`() {
        val hinglish = "Checkout fail hone ke baad bhi SAVE20 coupon apply rehna chahiye retry ke baad"
        val ranked = DeterministicRanker.rankAssertions(hinglish, candidates)
        assertEquals("a1", ranked.first().candidateId)
    }
}
