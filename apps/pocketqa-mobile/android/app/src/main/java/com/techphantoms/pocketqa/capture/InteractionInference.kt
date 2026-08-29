package com.techphantoms.pocketqa.capture

import kotlinx.serialization.json.JsonObject

/**
 * Infer which control was interacted with, from the difference between two
 * stable states — CAP-05, design in
 * `PocketQA_Capture_Findings_and_Inference_Design.md` §2.5.
 *
 * Why this exists: Jetpack Compose dispatches `TYPE_VIEW_CLICKED` only when a
 * click arrives through the accessibility API. A finger tap runs `onClick` and
 * emits nothing, so a capture tool listening for click events sees a screen
 * change with no cause. Measured on the Demo Shop: two taps produced six
 * window-content-changed events, two window-state-changed, and zero clicks.
 *
 * The tapped node is not observable, but it is inferable — a tap is the
 * hypothesis that best explains the transition.
 *
 * The output is never a certainty. It is a ranked attribution with a confidence,
 * handed to the review gate that already exists. Spec §16.3 already treats an
 * inferred selector as a proposal rather than something to act on. A confident
 * wrong answer is worse than an honest gap, because it produces a green test
 * that asserts nothing.
 */
object InteractionInference {

    /** §2.6 confidence bands. */
    const val ACCEPT = 0.75
    const val REVIEW = 0.40

    /** Where the finger went down, in screen pixels. */
    data class Touch(val x: Int, val y: Int)

    data class Candidate(val nodeId: String, val score: Double, val signals: List<String>)

    data class Attribution(
        val nodeId: String,
        val label: String,
        val confidence: Double,
        val signals: List<String>,
        val alternatives: List<String>,
    ) {
        /** Below ACCEPT the review gate must ask a human (§2.6). */
        val needsHumanCorrection: Boolean get() = confidence < ACCEPT
    }

    /**
     * @param focusedNodeId a node reported by TYPE_VIEW_FOCUSED in this window,
     *   when one arrived. Not always present; decisive when it is.
     */
    fun infer(
        before: JsonObject,
        after: JsonObject,
        focusedNodeId: String? = null,
        changedFingerprints: List<String> = emptyList(),
        touch: Touch? = null,
    ): Attribution? {
        val diff = StateDiff.diff(before, after)
        if (diff.isEmpty) return null
        val before1 = StateDiff.nodesOf(before)

        // Signal 0 — an optional touch supplied by an instrumentation or OEM
        // backend. The AccessibilityService backend deliberately does not source
        // this from AccessibilityService.onMotionEvent: Android withholds a
        // registered motion source from the rest of the system, which consumes
        // the operator's physical touchscreen input. When a safe backend supplies
        // a point, the smallest interactive node under it wins because a button
        // may sit inside a card that also reports as clickable.
        //
        // Everything below stays in place: it is what runs on older devices, and
        // it is what covers a tap the platform did not report.
        if (touch != null) {
            val hit = before1
                .filter { (it.clickable || it.role in INTERACTIVE_ROLES) && it.enabled && it.visible }
                .filter { it.contains(touch.x, touch.y) }
                .minByOrNull { it.area }
            if (hit != null) {
                return Attribution(
                    nodeId = hit.nodeId,
                    label = hit.label.ifBlank { "Unknown target" },
                    confidence = 0.99,
                    signals = listOf("the touch landed on this control"),
                    alternatives = emptyList(),
                )
            }
        }

        // No usable touch. A wholesale replacement with the screen unchanged is a
        // scroll or a re-render: nothing visible is left to blame and guessing would be
        // fabrication. Churn *with* a screen change is ordinary navigation and
        // must still be attributed — the two look identical by churn alone, which
        // is why the screen name is part of the test.
        if (diff.distance > 0.9 && !diff.screenChanged) return null

        val candidates = before1
            // Signal 1 — affordance. This is a filter, not a score: a tap lands
            // on something tappable. Everything else scores zero by construction.
            .filter { (it.clickable || it.role in INTERACTIVE_ROLES) && it.enabled && it.visible }
            .map { node -> score(node, diff, focusedNodeId, changedFingerprints) }
            .filter { it.score > 0.0 }
            .sortedByDescending { it.score }

        if (candidates.isEmpty()) return null

        val top = candidates.first()
        // Signal 9 — ambiguity. Several equally good explanations means we do not
        // actually know, and saying so is the point.
        val rivals = candidates.drop(1).count { top.score - it.score < 0.10 }
        val confidence = (top.score - 0.10 * rivals).coerceIn(0.0, 1.0)

        val label = before1.firstOrNull { it.nodeId == top.nodeId }?.label.orEmpty()
        return Attribution(
            nodeId = top.nodeId,
            label = label.ifBlank { "Unknown target" },
            confidence = confidence,
            signals = top.signals,
            alternatives = candidates.drop(1).take(4).map { it.nodeId },
        )
    }

    /** Lowercase alphanumeric slug: "Add to cart" and "add_to_cart" agree. */
    private fun slugOf(raw: String): String =
        raw.lowercase().filter { it.isLetterOrDigit() }

    /** Words of a label worth matching on; three characters minimum. */
    private fun wordsOf(raw: String): List<String> =
        raw.lowercase().split(Regex("[^a-z0-9]+"))
            .filter { it.length >= 3 }

    /** Identity tokens a destination node offers: its own label and its id. */
    private fun destinationNames(node: StateDiff.NodeRef): Set<String> =
        setOfNotNull(
            slugOf(node.label).takeIf { it.isNotBlank() },
            node.testId?.let { slugOf(it) }?.takeIf { it.isNotBlank() },
        )

    private val INTERACTIVE_ROLES = setOf(
        "button", "link", "listItem", "tab", "switch", "checkbox", "radio",
    )

    private fun score(
        node: StateDiff.NodeRef,
        diff: StateDiff.Result,
        focusedNodeId: String?,
        changedFingerprints: List<String>,
    ): Candidate {
        var total = 0.0
        val signals = mutableListOf<String>()

        val changed = diff.changed.firstOrNull { it.before.fingerprint == node.fingerprint }

        // Signal 2 — a checkable that flipped is near-certainly what was touched.
        if (changed?.fields?.any { it.field == "checked" } == true) {
            total += 0.80; signals += "toggle flipped"
        }
        // Signal 3 — the candidate changed itself: "Add" -> "Added", or disabled.
        if (changed?.fields?.any { it.field in setOf("label", "enabled", "selected") } == true) {
            total += 0.55; signals += "changed its own state"
        }
        // Signal 4 — the label names where we ended up. Tapping "Cart" lands
        // somewhere that calls itself the cart. This is the signal that catches
        // plain navigation, which is most of what a QA flow does.
        //
        // Matched against what the destination actually *contains* — headings and
        // stable ids that appeared — rather than against the screen name. The
        // accessibility event's class name is "View" on every Compose screen, so
        // the earlier screen-name comparison could never fire.
        if (diff.screenChanged && node.label.isNotBlank()) {
            // Word by word, so "Cart (1)" still names the cart. A single slug
            // over the whole label stops matching the moment a control starts
            // showing a count.
            val slugs = wordsOf(node.label)
            // Three characters minimum: shorter slugs match half the tree.
            // Only non-interactive arrivals count as destination identity: a
            // screen is named by its container and its heading, never by another
            // button. Without this a control that re-rendered could name the
            // destination after itself — circular, and it produced a confident
            // wrong answer (the cart's "Remove" claiming the coupon tap).
            if (slugs.isNotEmpty() && diff.added.any { added ->
                    !added.clickable &&
                        added.fingerprint != node.fingerprint &&
                        destinationNames(added).any { name ->
                            slugs.any { name == it || name.startsWith(it) }
                        }
                }
            ) {
                total += 0.60; signals += "destination names \"${node.label}\""
            }
        }
        // Signal 5 — interactive things that vanished: dismiss buttons, rows that
        // navigated away.
        if (diff.removed.any { it.fingerprint == node.fingerprint }) {
            total += 0.35; signals += "disappeared after the interaction"
        }
        // Signal 6 — weak causality. Kept deliberately small: tapping "Add"
        // changes a cart badge elsewhere, so co-location is a tiebreak at best.
        if (diff.screenChanged && node.clickable) {
            total += 0.15; signals += "clickable on the originating screen"
        }
        // Signal 7 — an explicit focus event, when the platform sent one.
        if (focusedNodeId != null && focusedNodeId == node.nodeId) {
            total += 0.20; signals += "received accessibility focus"
        }
        // Signal 8 — the platform told us where the change started. Compose sends
        // no click event for a finger tap, but it does send window-content-changed
        // whose source is the affected subtree; the pressed-state change on the
        // control that was actually touched shows up there. Matched by
        // fingerprint: a path id from the event's tree names a different node
        // once the screen has changed, so comparing path ids invents evidence.
        if (node.fingerprint.isNotBlank() && changedFingerprints.contains(node.fingerprint)) {
            total += 0.45; signals += "platform reported the change here"
        }

        return Candidate(node.nodeId, total.coerceIn(0.0, 1.0), signals)
    }
}
