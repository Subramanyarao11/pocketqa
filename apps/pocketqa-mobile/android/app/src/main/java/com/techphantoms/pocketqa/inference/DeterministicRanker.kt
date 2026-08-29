package com.techphantoms.pocketqa.inference

import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

/**
 * Deterministic intent relevance — Technical Spec §17.3.
 *
 * Kotlin port of `services/ai-lab/app/relevance.py` (Track A task AI-A-15). The
 * two implementations must produce identical scores on the shared fixture set;
 * `DeterministicRankerTest` pins the coupon-retry corpus against the numbers the
 * Python engine produces.
 *
 * This is the guaranteed baseline (§18.4). It runs with no model, no network and
 * no ML Kit, which is what the airplane-mode demo depends on. Before this
 * existed, `InferenceRouter.rankCandidates` returned the candidate list in input
 * order on the deterministic path — that is, it did not rank at all.
 *
 * Keep this free of anything without a Python equivalent: a divergence here
 * shows up as an on-device test draft that differs from the one the lab
 * validated.
 */
object DeterministicRanker {

    data class Candidate(
        val id: String,
        val fact: String,
        val isEndState: Boolean = false,
    )

    data class Ranked(
        val candidateId: String,
        val score: Double,
        val reason: String,
    )

    private val TOKEN = Regex("[a-z0-9]+")

    private val STOPWORDS: Set<String> = """
        a an the is are was were be been being am do does did doing have has had having
        i me my we our you your he she it they them this that these those there here
        and or but if then than so as of at by for with about into to from on off in out
        up down over under further once all any both each few more most other some
        such only own same too very can will just should now must shall may might would
    """.trimIndent().split(Regex("\\s+")).toSet()

    /** PocketQA's own scaffolding vocabulary — present in nearly every intent and fact. */
    private val SCAFFOLDING: Set<String> = """
        verify check ensure confirm test assert expect expected observe observed
        text visible shown displayed appears appear state screen page view final
        element control widget node label value string
    """.trimIndent().split(Regex("\\s+")).toSet()

    /** Romanised Hindi function words; intents arrive code-mixed. */
    private val HINGLISH: Set<String> = """
        ka ke ki ko se me mein par pe hai hain ho hona hone hui hua huye tha the thi
        bhi aur ya na nahi nahin ye yeh wo woh is us jo kya kar karna karke kiya
        chahiye sakta sakti raha rahe rahi liye lie ek bahut sab kuch abhi phir toh
        baad pehle jab tab agar lekin
    """.trimIndent().split(Regex("\\s+")).toSet()

    private val SYNONYM_GROUPS: List<List<String>> = listOf(
        listOf("retry", "again", "reattempt", "retried", "retries", "dobara", "dubara"),
        listOf("coupon", "discount", "offer", "promo", "promocode", "voucher"),
        listOf("cart", "basket", "bag"),
        listOf("checkout", "pay", "payment", "order", "purchase", "buy"),
        listOf("error", "fail", "fails", "failed", "failing", "failure", "unable",
            "problem", "issue", "wrong", "galat", "kharab"),
        listOf("apply", "applied", "applies", "activate", "activated", "use", "used"),
        listOf("remain", "remains", "remaining", "stay", "stays", "persist", "persists",
            "still", "kept", "keep", "keeps", "intact", "rehna", "rahega", "bana"),
        listOf("total", "amount", "payable", "sum", "subtotal"),
        listOf("remove", "removed", "removes", "delete", "deleted", "cleared", "clear", "gone"),
        listOf("login", "signin", "logon", "authenticate"),
        listOf("loading", "loader", "spinner", "please", "wait"),
    )

    private val CANONICAL: Map<String, String> =
        SYNONYM_GROUPS.flatMap { group -> group.map { it to group.first() } }.toMap()

    private val ERROR_TERMS = setOf("error", "fail", "fails", "failed", "failure", "unable", "problem", "issue")
    private val NEGATIONS = setOf("not", "no", "never", "without", "isnt", "arent", "doesnt", "dont", "cannot", "cant", "nor")
    private val TRANSIENT = listOf("loading", "please wait", "spinner", "one moment", "updating", "refreshing")

    private val DYNAMIC = Regex(
        "(\\b\\d{1,2}:\\d{2}(:\\d{2})?\\b" +
            "|\\b\\d{4}-\\d{2}-\\d{2}\\b" +
            "|\\bsession[_-]?\\w*\\d{3,}\\b" +
            "|\\b[0-9a-f]{16,}\\b" +
            "|\\b\\d+\\s*(ms|seconds?|secs?|minutes?|mins?)\\s+ago\\b)",
        RegexOption.IGNORE_CASE,
    )

    /** Uppercase alphanumeric codes such as SAVE20. Matched on the raw string. */
    private val CODE = Regex("\\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\\d)[A-Z0-9]{4,}\\b")

    private fun tokenize(text: String): List<String> =
        TOKEN.findAll(text.lowercase()).map { it.value }.toList()

    private fun contentTokens(text: String): Set<String> = tokenize(text)
        .filter { it !in STOPWORDS && it !in SCAFFOLDING && it !in HINGLISH && it.length > 1 }
        .map { CANONICAL[it] ?: it }
        .toSet()

    private fun codes(text: String): Set<String> =
        CODE.findAll(text).map { it.value.lowercase() }.toSet()

    private fun numbers(text: String): Set<String> =
        tokenize(text).filter { t -> t.all { it.isDigit() } }.toSet()

    private fun isTransient(text: String): Boolean =
        text.lowercase().let { lowered -> TRANSIENT.any { lowered.contains(it) } }

    private fun isDynamic(text: String): Boolean = DYNAMIC.containsMatchIn(text)

    private fun hasNegation(text: String): Boolean = tokenize(text).any { it in NEGATIONS }

    data class Intent(
        val tokens: Set<String>,
        val codes: Set<String>,
        val numbers: Set<String>,
        val negated: Boolean,
    ) {
        companion object {
            fun parse(text: String) = Intent(
                tokens = contentTokens(text),
                codes = codes(text),
                numbers = numbers(text),
                negated = hasNegation(text),
            )
        }
    }

    private fun round4(v: Double) = round(v * 10000.0) / 10000.0

    /** Mirrors `score_text`: contributions are collected, then sorted by magnitude
     *  so the reported reason is the one that actually moved the score. */
    fun score(intent: Intent, text: String, isEndState: Boolean = false): Pair<Double, String> {
        val contributions = mutableListOf<Pair<Double, String>>()

        val candidateTokens = contentTokens(text)
        val sharedCodes = intent.codes intersect codes(text)
        if (sharedCodes.isNotEmpty()) {
            contributions += 0.45 to "Names the code ${sharedCodes.sorted().first().uppercase()} from the intent"
        }
        if (intent.tokens.isNotEmpty()) {
            val overlap = intent.tokens intersect candidateTokens
            if (overlap.isNotEmpty()) {
                val ratio = overlap.size.toDouble() / intent.tokens.size
                contributions += (0.40 * ratio) to
                    ("Shares intent terms " + overlap.sorted().take(3).joinToString(", "))
            }
        }
        val sharedNumbers = intent.numbers intersect numbers(text)
        if (sharedNumbers.isNotEmpty() && sharedCodes.isEmpty()) {
            contributions += 0.10 to "Matches a numeric value named in the intent"
        }
        if ((ERROR_TERMS intersect candidateTokens).isNotEmpty()) {
            if ((ERROR_TERMS intersect intent.tokens).isNotEmpty()) {
                contributions += 0.12 to "Confirms the failure condition the intent describes"
            } else {
                contributions += -0.05 to "Mentions an error the intent does not"
            }
        }
        if (isEndState) {
            contributions += 0.15 to "Observed in the final state after the last relevant action"
        }
        if (isTransient(text)) {
            contributions += -0.35 to "Transient loading text is unstable as an assertion"
        }
        if (isDynamic(text)) {
            contributions += -0.30 to "Contains a timestamp or opaque identifier that changes per run"
        }
        if (intent.negated && !hasNegation(text)) {
            contributions += -0.05 to "Intent is negative but this fact is positive"
        }

        val total = contributions.sumOf { it.first }
        val reason = contributions.maxByOrNull { kotlin.math.abs(it.first) }?.second
            ?: "No matching intent signal"
        return round4(max(0.0, min(1.0, total))) to reason
    }

    /**
     * Rank grounded candidates by intent relevance.
     *
     * Ties break on the original position, never on the id — the ordering has to
     * be reproducible and identical to the Python engine.
     */
    fun rankAssertions(intentText: String, candidates: List<Candidate>): List<Ranked> {
        val intent = Intent.parse(intentText)
        return candidates
            .mapIndexed { position, candidate ->
                val (score, reason) = score(intent, candidate.fact, candidate.isEndState)
                Triple(score, position, Ranked(candidate.id, score, reason))
            }
            .sortedWith(compareByDescending<Triple<Double, Int, Ranked>> { it.first }.thenBy { it.second })
            .map { it.third }
    }
}
