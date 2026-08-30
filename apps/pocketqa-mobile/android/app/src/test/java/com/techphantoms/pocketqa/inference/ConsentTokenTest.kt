package com.techphantoms.pocketqa.inference

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Consent is a safety control, so it is tested rather than trusted.
 *
 * Every case here is about the boundary TaskClient relies on: a token proves
 * that *this* task was approved for *this* operation, and nothing else.
 */
class ConsentTokenTest {

    @Test
    fun `a token authorises only the task it was granted for`() {
        val token = ConsentToken.GrantedForOperation("explain_failure", "run_1")
        token.assertMatches("explain_failure") // does not throw
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a token granted for one task is refused for another`() {
        // The failure mode this guards: a coordinator reusing a token it had
        // to hand for a different call, which would send data the operator
        // never approved sending.
        ConsentToken.GrantedForOperation("explain_failure", "run_1")
            .assertMatches("compile_intent")
    }

    @Test
    fun `a denial is an outcome, not an exception`() {
        // TaskClient.run promises "a failure is a Result with value == null,
        // never an exception". Denied throwing here broke that contract and
        // made the Denied branch inside run unreachable.
        ConsentToken.Denied.assertMatches("explain_failure")
        assertFalse(ConsentToken.Denied.isNetworkPermitted())
    }

    @Test
    fun `granted and not-required permit the network, denied does not`() {
        assertTrue(ConsentToken.GrantedForOperation("name_test", "job_1").isNetworkPermitted())
        assertTrue(ConsentToken.NotRequired.isNetworkPermitted())
        assertFalse(ConsentToken.Denied.isNetworkPermitted())
    }

    @Test
    fun `wire state names match the server's consent vocabulary`() {
        // These strings cross the boundary to app/engines/base.py ConsentState;
        // renaming one silently on this side would be accepted by the server as
        // a different level of consent.
        assertEquals("OPERATION_LEVEL_GRANTED",
            ConsentToken.GrantedForOperation("name_test", "job_1").serverState)
        assertEquals("NOT_REQUIRED", ConsentToken.NotRequired.serverState)
        assertEquals("DENIED", ConsentToken.Denied.serverState)
    }
}
