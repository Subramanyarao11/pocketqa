package com.techphantoms.pocketqa.capture

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import com.techphantoms.pocketqa.policy.PolicyEngine
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest

/**
 * Turns an [AccessibilityNodeInfo] tree into a redacted, schema-shaped
 * `UIState` JSON payload. Runs entirely inside the accessibility service so
 * unredacted node data never crosses the module boundary.
 *
 * The traversal is depth-first; every node contributes at most one row. Nodes
 * that fail the [PolicyEngine.isSensitive] check are still included so the
 * executor can still resolve selectors against them, but their `text` /
 * `contentDescription` are elided.
 */
object UiTreeCapture {
    private val policy = PolicyEngine()
    private const val MAX_NODES = 512

    data class Snapshot(val stateId: String, val payload: String)

    /**
     * Screen geometry, needed to normalise bounds to ratios and to evaluate
     * dp-based accessibility rules. Absolute pixels alone cannot express either.
     */
    data class Display(val widthPx: Int, val heightPx: Int, val density: Float)

    fun snapshot(
        root: AccessibilityNodeInfo,
        packageName: String,
        screenName: String,
        capturedAt: Long,
        display: Display? = null,
    ): Snapshot {
        val nodes = mutableListOf<JsonObject>()
        val ocr = mutableListOf<String>()
        traverse(root, "n", nodes, ocr, depth = 0, inScrollable = false)
        val nodesArr = buildJsonArray { for (n in nodes) add(n) }
        val ocrArr = buildJsonArray { for (line in ocr.take(24)) add(JsonPrimitive(line)) }
        val stateId = "state_" + hash("$packageName:$screenName:${nodesArr}")
        val payload: JsonObject = buildJsonObject {
            put("id", JsonPrimitive(stateId))
            put("packageName", JsonPrimitive(packageName))
            put("screenName", JsonPrimitive(screenName))
            // Identity of the screen, derived from the tree itself. The
            // accessibility event's class name is useless here: a single-Activity
            // Compose app reports the same class on every screen, so anything
            // keyed off `screenName` cannot tell navigation from a repaint.
            put("screenSignature", JsonPrimitive(screenSignature(nodes)))
            put("capturedAt", JsonPrimitive(capturedAt))
            put("ocrText", ocrArr)
            put("nodes", nodesArr)
            if (display != null) put("display", buildJsonObject {
                put("widthPx", JsonPrimitive(display.widthPx))
                put("heightPx", JsonPrimitive(display.heightPx))
                put("density", JsonPrimitive(display.density))
            })
        }
        return Snapshot(stateId, payload.toString())
    }

    /**
     * Structural identity of a screen: the stable chrome, ignoring anything
     * inside a scrollable container and ignoring free text.
     *
     * Built from stable ids only. Text is excluded deliberately: a total that
     * recalculates, a badge that increments and a row that appears are all the
     * same screen, and treating them as navigation let a control on the current
     * screen "name the destination" after itself. Navigating swaps the ids
     * wholesale, which is the distinction interaction inference needs.
     *
     * An app that exposes no ids yields an empty signature, and the caller falls
     * back to the screen name.
     */
    private fun screenSignature(nodes: List<JsonObject>): String {
        val anchors = nodes.asSequence()
            .mapNotNull { n ->
                n["testId"]?.jsonPrimitive?.contentOrNull
                    ?: n["resourceId"]?.jsonPrimitive?.contentOrNull?.substringAfterLast('/')
            }
            .filter { it.isNotBlank() }
            .toSortedSet()
        return if (anchors.isEmpty()) "" else hash(anchors.joinToString("|")).take(12)
    }

    private fun traverse(
        node: AccessibilityNodeInfo?,
        pathId: String,
        nodes: MutableList<JsonObject>,
        ocr: MutableList<String>,
        depth: Int,
        inScrollable: Boolean,
    ) {
        if (node == null) return
        if (nodes.size >= MAX_NODES || depth > 32) return
        val text = node.text?.toString()
        val contentDescription = node.contentDescription?.toString()
        val resourceId = node.viewIdResourceName
        val testId = extractTestId(node)
        val role = classifyRole(node)
        // A Compose Button carries no text of its own — the label sits in a child
        // Text node. Every label-based rule (step naming, textAndRole selectors,
        // the destination signal in inference) sees an empty string without this,
        // which is why buttons compiled as "Tap element" with no usable name.
        // Composing a name from descendants is what the platform itself does when
        // it announces a control.
        val derivedName = if (text.isNullOrBlank() && contentDescription.isNullOrBlank()) {
            subtreeName(node)
        } else null
        val sensitive = policy.isSensitive(text) ||
            policy.isSensitive(contentDescription) ||
            role in listOf("passwordField", "otpField", "pinField")
        val bounds = Rect().also { node.getBoundsInScreen(it) }
        val entry: JsonObject = buildJsonObject {
            put("nodeId", JsonPrimitive(pathId))
            put("role", JsonPrimitive(role))
            if (!sensitive && !text.isNullOrEmpty()) put("text", JsonPrimitive(text))
            if (!sensitive && !contentDescription.isNullOrEmpty()) put("contentDescription", JsonPrimitive(contentDescription))
            if (!resourceId.isNullOrEmpty()) put("resourceId", JsonPrimitive(resourceId))
            if (!testId.isNullOrEmpty()) put("testId", JsonPrimitive(testId))
            if (!sensitive && !derivedName.isNullOrBlank()) put("name", JsonPrimitive(derivedName))
            put("enabled", JsonPrimitive(node.isEnabled))
            put("visible", JsonPrimitive(node.isVisibleToUser))
            put("sensitive", JsonPrimitive(sensitive))
            // CAP-01. Interaction inference scores affordance first: a tap lands
            // on something tappable. Without these the tree cannot support the
            // strongest signal in the design, and the accessibility auditor
            // cannot evaluate touch targets either.
            put("clickable", JsonPrimitive(node.isClickable))
            put("longClickable", JsonPrimitive(node.isLongClickable))
            put("focusable", JsonPrimitive(node.isFocusable))
            put("checkable", JsonPrimitive(node.isCheckable))
            if (node.isCheckable) put("checked", JsonPrimitive(node.isChecked))
            put("selected", JsonPrimitive(node.isSelected))
            put("scrollable", JsonPrimitive(node.isScrollable))
            put("inScrollable", JsonPrimitive(inScrollable))
            put("editable", JsonPrimitive(node.isEditable))
            // Path ids (n_0_0_1) shift when a sibling is inserted, so they cannot
            // match a node across two trees. This is stable under sibling churn:
            // identity comes from what the node *is*, not where it sits.
            put("fingerprint", JsonPrimitive(
                nodeFingerprint(role, text ?: derivedName, contentDescription, resourceId, bounds)))
            put("bounds", buildJsonObject {
                put("x", JsonPrimitive(bounds.left))
                put("y", JsonPrimitive(bounds.top))
                put("w", JsonPrimitive(bounds.width()))
                put("h", JsonPrimitive(bounds.height()))
            })
        }
        nodes += entry
        if (!sensitive) text?.takeIf { it.isNotBlank() }?.let { ocr += it }
        for (i in 0 until node.childCount) {
            traverse(node.getChild(i), "${pathId}_$i", nodes, ocr, depth + 1,
                inScrollable = inScrollable || node.isScrollable)
        }
    }

    /**
     * The accessible name a control inherits from its own subtree.
     *
     * Bounded deliberately: two levels and two text nodes. A whole card would
     * otherwise be named after its price, its badge and its description, which
     * is worse than no name at all.
     */
    private fun subtreeName(node: AccessibilityNodeInfo, depth: Int = 0): String? {
        if (depth > 2) return null
        val parts = mutableListOf<String>()
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val own = child.text?.toString()?.takeIf { it.isNotBlank() }
                ?: child.contentDescription?.toString()?.takeIf { it.isNotBlank() }
            val name = own ?: subtreeName(child, depth + 1)
            if (!name.isNullOrBlank()) parts += name.trim()
            if (parts.size >= 2) break
        }
        return parts.joinToString(" ").takeIf { it.isNotBlank() }
    }

    /**
     * Fingerprint of a live node, so a signal observed at event time can be
     * matched against a captured tree. Path ids cannot do this: they index one
     * particular tree, and after a navigation the same path names an unrelated
     * node — which turns a hint into a false accusation.
     */
    fun fingerprintOf(node: AccessibilityNodeInfo?): String? {
        node ?: return null
        val bounds = Rect().also { node.getBoundsInScreen(it) }
        val text = node.text?.toString()
        val cd = node.contentDescription?.toString()
        val name = if (text.isNullOrBlank() && cd.isNullOrBlank()) subtreeName(node) else null
        return nodeFingerprint(
            classifyRole(node), text ?: name, cd, node.viewIdResourceName, bounds,
        )
    }

    /**
     * Stable identity for a node across two captures of the same screen.
     *
     * Deliberately excludes exact bounds — a row that shifts down when an item is
     * inserted above it is still the same control — but keeps a coarse position
     * bucket so two identically-labelled buttons in different places stay
     * distinct.
     */
    private fun nodeFingerprint(
        role: String,
        text: String?,
        contentDescription: String?,
        resourceId: String?,
        bounds: Rect,
    ): String {
        val label = (text ?: contentDescription ?: "").trim().lowercase()
        val id = resourceId?.substringAfterLast('/') ?: ""
        // A control with a stable id is identified by that id alone. Folding its
        // label in would make "Add" and "Added" two different nodes, so a button
        // that reacted to being pressed would read as one control vanishing and
        // another appearing — destroying the very signal that says which control
        // was pressed.
        if (id.isNotEmpty()) return hash("$role|$id").take(12)
        // ~10% buckets: tolerant of layout shift, intolerant of a different slot.
        val bucketX = if (bounds.width() > 0) bounds.centerX() / 108 else 0
        val bucketY = if (bounds.height() > 0) bounds.centerY() / 240 else 0
        return hash("$role|$label|$bucketX,$bucketY").take(12)
    }

    private fun extractTestId(node: AccessibilityNodeInfo): String? {
        // testTag surfaces as a resource id suffix such as `app:id/testId=foo`
        // when apps use Compose's `Modifier.testTag`. Fall back to the tail of
        // the resource ID when no explicit testTag is present.
        val res = node.viewIdResourceName ?: return null
        return res.substringAfter('/', missingDelimiterValue = res).takeIf { it.isNotBlank() }
    }

    private fun classifyRole(node: AccessibilityNodeInfo): String {
        val cls = node.className?.toString().orEmpty()
        return when {
            cls.endsWith("Button") -> "button"
            cls.endsWith("EditText") -> if (node.isPassword) "passwordField" else "textField"
            cls.endsWith("TextView") -> "text"
            cls.endsWith("ImageView") -> "image"
            cls.endsWith("CheckBox") -> "checkbox"
            cls.endsWith("Switch") -> "switch"
            cls.endsWith("Toolbar") -> "appBar"
            node.isCheckable -> "checkbox"
            node.isClickable -> "button"
            else -> "container"
        }
    }

    private fun hash(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-1").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }.take(16)
    }

    /**
     * Splice a screenshot content:// URI into an already-emitted state payload.
     * We keep the tree traversal and screenshot capture separate so the tree
     * can still be persisted if the screenshot fails.
     */
    fun mergeScreenshotUri(payload: String, uri: String): String {
        val obj = kotlinx.serialization.json.Json.parseToJsonElement(payload) as JsonObject
        val next = JsonObject(obj + ("screenshotDataUri" to JsonPrimitive(uri)))
        return next.toString()
    }

    // Utility used by tests to build a JsonElement quickly.
    @Suppress("unused")
    fun asPrimitive(value: Any?): JsonElement = when (value) {
        null -> JsonPrimitive(null as String?)
        is Boolean -> JsonPrimitive(value)
        is Int -> JsonPrimitive(value)
        is Long -> JsonPrimitive(value)
        is Double -> JsonPrimitive(value)
        is String -> JsonPrimitive(value)
        is List<*> -> JsonArray(value.mapNotNull { asPrimitive(it) })
        else -> JsonPrimitive(value.toString())
    }
}
