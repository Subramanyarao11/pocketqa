package com.techphantoms.pocketqa.capture

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
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
        val clickable: Boolean,
        val enabled: Boolean,
        val visible: Boolean,
        val checkable: Boolean,
        val checked: Boolean?,
        val selected: Boolean,
    )

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
            NodeRef(
                nodeId = n["nodeId"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                fingerprint = n["fingerprint"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                role = n["role"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                label = (text ?: cd ?: "").trim(),
                clickable = n["clickable"]?.jsonPrimitive?.booleanOrNull ?: false,
                enabled = n["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
                visible = n["visible"]?.jsonPrimitive?.booleanOrNull ?: true,
                checkable = n["checkable"]?.jsonPrimitive?.booleanOrNull ?: false,
                checked = n["checked"]?.jsonPrimitive?.booleanOrNull,
                selected = n["selected"]?.jsonPrimitive?.booleanOrNull ?: false,
            )
        }

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
        val union = (b.map { it.fingerprint } + a.map { it.fingerprint }).toSet().size
        val churn = added.size + removed.size
        return Result(
            added = added,
            removed = removed,
            changed = changed,
            beforeScreen = beforeScreen,
            afterScreen = afterScreen,
            screenChanged = beforeScreen != afterScreen,
            distance = if (union == 0) 0.0 else (churn.toDouble() / union).coerceIn(0.0, 1.0),
        )
    }
}
