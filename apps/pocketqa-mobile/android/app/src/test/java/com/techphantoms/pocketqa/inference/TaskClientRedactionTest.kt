package com.techphantoms.pocketqa.inference

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What actually leaves the device.
 *
 * These run without a server: every case here is decided before any request is
 * built, which is exactly where a privacy control has to hold.
 */
class TaskClientRedactionTest {

    private val json = Json { ignoreUnknownKeys = true }
    private fun obj(s: String) = json.parseToJsonElement(s) as JsonObject

    private fun client(
        endpoint: String? = "http://127.0.0.1:1",
        redactor: (String) -> TaskClient.RedactionResult,
    ) = TaskClient(baseUrlProvider = { endpoint }, redactor = redactor)

    @Test
    fun `no endpoint means no request and no claim of having used a model`() = runBlocking {
        val called = booleanArrayOf(false)
        val c = client(endpoint = null) { called[0] = true; TaskClient.RedactionResult(it, false) }
        val r = c.run(
            taskId = "name_test",
            request = obj("""{"intentText":"anything"}"""),
            consent = ConsentToken.GrantedForOperation("name_test", "job_1"),
            timeoutMs = 500,
        )
        assertNull(r.value)
        assertEquals(false, r.provenance.usedModel)
        assertEquals(false, r.provenance.networkUsed)
    }

    @Test
    fun `a denied token returns a result instead of throwing`() = runBlocking {
        val c = client { TaskClient.RedactionResult(it, false) }
        val r = c.run(
            taskId = "explain_failure",
            request = obj("""{"a":1}"""),
            consent = ConsentToken.Denied,
            timeoutMs = 500,
        )
        assertNull(r.value)
        assertEquals(false, r.provenance.networkUsed)
    }

    @Test
    fun `redaction that damages the payload fails closed`() = runBlocking {
        // The one path where the privacy control misbehaves must not become the
        // path that sends the original. A redactor that returns unparseable
        // text stands in for any pattern that breaks the JSON structure.
        var attempted = false
        val c = client { attempted = true; TaskClient.RedactionResult("}{ not json", true) }
        val r = c.run(
            taskId = "name_test",
            request = obj("""{"intentText":"card 4111111111111111"}"""),
            consent = ConsentToken.GrantedForOperation("name_test", "job_1"),
            timeoutMs = 500,
        )
        assertTrue(attempted)
        assertNull(r.value)
        assertEquals(false, r.provenance.networkUsed)
    }

    @Test
    fun `the redactor sees the whole serialised request`() = runBlocking {
        // Redaction runs over the serialised body, so anything nested — a
        // captured node label, an assertion's expected text — is covered, not
        // just the top-level intent.
        var seen = ""
        val c = client { seen = it; TaskClient.RedactionResult(it, false) }
        c.run(
            taskId = "compile_intent",
            request = obj("""{"intentText":"hi","candidates":[{"fact":"asha@example.com"}]}"""),
            consent = ConsentToken.GrantedForOperation("compile_intent", "job_1"),
            timeoutMs = 500,
        )
        assertTrue("nested candidate text was not offered to the redactor",
            seen.contains("asha@example.com"))
    }
}
