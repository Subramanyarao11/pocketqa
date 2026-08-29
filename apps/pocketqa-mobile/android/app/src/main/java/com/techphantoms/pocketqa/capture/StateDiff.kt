package com.techphantoms.pocketqa.capture

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Structural diff between two captured UI states — CAP-02.
 *
 * Deliberately free of Android types so it runs on the JVM under plain JUnit.
 * Nodes are matched across trees by their `fingerprint` (CAP-01), never by
 * `nodeId`: path ids like `n_0_0_1` shift the moment a sibling is inserted, so
 * matching on them reports a screen full of changes when one row was added.
 */
object StateDiff {

    data class NodeRef(
        val nodeId: String,
        val fingerprint: String,
        val role: String,
        val label: String,
        val testId: String?,
        val clickable: Boolean,
        val enabled: Boolean,
        val visible: Boolean,
        val checkable: Boolean,
        val checked: Boolean?,
        val selected: Boolean,
        /** Screen bounds, so a touch point can be hit-tested against the tree. */
        val x: Int = 0,
        val y: Int = 0,
        val w: Int = 0,
        val h: Int = 0,
    ) {
        fun contains(px: Int, py: Int): Boolean =
            w > 0 && h > 0 && px >= x && px < x + w && py >= y && py < y + h

        val area: Long get() = w.toLong() * h.toLong()
    }

    data class FieldChange(val field: String, val from: String?, val to: String?)

    data class ChangedNode(val before: NodeRef, val after: NodeRef, val fields: List<FieldChange>)

    data class Result(
        val added: List<NodeRef>,
        val removed: List<NodeRef>,
        val changed: List<ChangedNode>,
        val beforeScreen: String,
        val afterScreen: String,
        val screenChanged: Boolean,
        /** 0.0 identical, 1.0 nothing in common. */
        val distance: Double,
    ) {
        /** Nothing meaningful happened — do not attribute an interaction. */
        val isEmpty: Boolean get() = added.isEmpty() && removed.isEmpty() && changed.isEmpty()
    }

    fun nodesOf(state: JsonObject): List<NodeRef> =
        state["nodes"]?.jsonArray.orEmpty().map { it.jsonObject }.map { n ->
            val text = n["text"]?.jsonPrimitive?.contentOrNull
            val cd = n["contentDescription"]?.jsonPrimitive?.contentOrNull
            // `name` is the label a control inherits from its subtree; a Compose
            // Button has no text of its own (UiTreeCapture.subtreeName).
            val name = n["name"]?.jsonPrimitive?.contentOrNull
            NodeRef(
                nodeId = n["nodeId"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                fingerprint = n["fingerprint"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                role = n["role"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                label = (text ?: cd ?: name ?: "").trim(),
                testId = n["testId"]?.jsonPrimitive?.contentOrNull
                    ?: n["resourceId"]?.jsonPrimitive?.contentOrNull?.substringAfterLast('/'),
                clickable = n["clickable"]?.jsonPrimitive?.booleanOrNull ?: false,
                enabled = n["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
                visible = n["visible"]?.jsonPrimitive?.booleanOrNull ?: true,
                checkable = n["checkable"]?.jsonPrimitive?.booleanOrNull ?: false,
                checked = n["checked"]?.jsonPrimitive?.booleanOrNull,
                selected = n["selected"]?.jsonPrimitive?.booleanOrNull ?: false,
                x = n["bounds"]?.jsonObject?.get("x")?.jsonPrimitive?.intOrNull ?: 0,
                y = n["bounds"]?.jsonObject?.get("y")?.jsonPrimitive?.intOrNull ?: 0,
                w = n["bounds"]?.jsonObject?.get("w")?.jsonPrimitive?.intOrNull ?: 0,
                h = n["bounds"]?.jsonObject?.get("h")?.jsonPrimitive?.intOrNull ?: 0,
            )
        }

    /** Stable identifiers present on a screen — its structural anchors. */
    private fun nodeIds(state: JsonObject): Set<String> =
        state["nodes"]?.jsonArray.orEmpty().map { it.jsonObject }
            .mapNotNull { n ->
                n["testId"]?.jsonPrimitive?.contentOrNull
                    ?: n["resourceId"]?.jsonPrimitive?.contentOrNull?.substringAfterLast('/')
            }
            .filter { it.isNotBlank() }
            .toSet()

    fun diff(before: JsonObject, after: JsonObject): Result {
        val b = nodesOf(before)
        val a = nodesOf(after)

        // Fingerprints can repeat (two identical rows); pair them off in order so
        // one "Add" button does not match a different one.
        val afterByFp = a.groupBy { it.fingerprint }.mapValues { it.value.toMutableList() }
        val added = mutableListOf<NodeRef>()
        val removed = mutableListOf<NodeRef>()
        val changed = mutableListOf<ChangedNode>()

        for (node in b) {
            val match = afterByFp[node.fingerprint]?.removeFirstOrNull()
            if (match == null) {
                removed += node
                continue
            }
            val fields = buildList {
                if (node.label != match.label) add(FieldChange("label", node.label, match.label))
                if (node.enabled != match.enabled) add(FieldChange("enabled", "${node.enabled}", "${match.enabled}"))
                if (node.visible != match.visible) add(FieldChange("visible", "${node.visible}", "${match.visible}"))
                if (node.checked != match.checked) add(FieldChange("checked", "${node.checked}", "${match.checked}"))
                if (node.selected != match.selected) add(FieldChange("selected", "${node.selected}", "${match.selected}"))
            }
            if (fields.isNotEmpty()) changed += ChangedNode(node, match, fields)
        }
        for (leftovers in afterByFp.values) added += leftovers

        val beforeScreen = before["screenName"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val afterScreen = after["screenName"]?.jsonPrimitive?.contentOrNull.orEmpty()

        // You have navigated when most of what identified the previous screen is
        // gone — not merely when something new appeared. Applying a coupon adds a
        // discount row to the cart; that is new content on the same screen, and
        // treating it as navigation let the destination signal fire for controls
        // that had never moved. Arrivals alone cannot distinguish the two; losses
        // can.
        //
        // The accessibility event's class name is "View" on every Compose screen,
        // so it is only a fallback for apps that expose no ids at all.
        val beforeIds = nodeIds(before)
        val afterIds = nodeIds(after)
        val navigated = if (beforeIds.isNotEmpty()) {
            (beforeIds - afterIds).size * 2 > beforeIds.size
        } else beforeScreen != afterScreen
        val union = (b.map { it.fingerprint } + a.map { it.fingerprint }).toSet().size
        val churn = added.size + removed.size
        return Result(
            added = added,
            removed = removed,
            changed = changed,
            beforeScreen = beforeScreen,
            afterScreen = afterScreen,
            screenChanged = navigated,
            distance = if (union == 0) 0.0 else (churn.toDouble() / union).coerceIn(0.0, 1.0),
        )
    }
}
