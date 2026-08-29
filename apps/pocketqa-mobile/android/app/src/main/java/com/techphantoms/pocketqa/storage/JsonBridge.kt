package com.techphantoms.pocketqa.storage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * Bidirectional bridge between JSON payloads (persisted in Room + shared with
 * the JS domain) and React Native's WritableMap/ReadableMap.
 *
 * Every schema payload we hand back to JS goes through [toWritableMap]; every
 * ReadableMap arriving from JS goes through [readableMapToJsonString] before it
 * hits Room. This keeps a single canonical representation on both sides.
 */
object JsonBridge {
    val json: Json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun toWritableMap(payload: String): WritableMap {
        val root = json.parseToJsonElement(payload)
        require(root is JsonObject) { "expected JSON object at top level" }
        return elementToMap(root)
    }

    fun toWritableArray(payloads: List<String>): WritableArray {
        val out = Arguments.createArray()
        for (p in payloads) {
            val el = json.parseToJsonElement(p)
            if (el is JsonObject) out.pushMap(elementToMap(el))
        }
        return out
    }

    fun readableMapToJsonString(map: ReadableMap): String =
        readableMapToElement(map).toString()

    private fun elementToMap(obj: JsonObject): WritableMap {
        val out = Arguments.createMap()
        for ((k, v) in obj) {
            when (v) {
                is JsonNull -> out.putNull(k)
                is JsonPrimitive -> putPrimitive(out, k, v)
                is JsonObject -> out.putMap(k, elementToMap(v))
                is JsonArray -> out.putArray(k, elementToArray(v))
            }
        }
        return out
    }

    private fun elementToArray(arr: JsonArray): WritableArray {
        val out = Arguments.createArray()
        for (v in arr) {
            when (v) {
                is JsonNull -> out.pushNull()
                is JsonPrimitive -> pushPrimitive(out, v)
                is JsonObject -> out.pushMap(elementToMap(v))
                is JsonArray -> out.pushArray(elementToArray(v))
            }
        }
        return out
    }

    private fun putPrimitive(out: WritableMap, k: String, v: JsonPrimitive) {
        // A quoted JSON value stays a string. kotlinx's intOrNull/doubleOrNull
        // parse the *content* regardless of how it was encoded, so without this
        // check the string "7" crossed the bridge as a number and came back
        // "7.0" — which made every numeric label unmatchable on replay, and
        // would equally corrupt a coupon code, a quantity or an OTP.
        if (v.isString) { out.putString(k, v.content); return }
        val b = v.booleanOrNull; if (b != null) { out.putBoolean(k, b); return }
        val i = v.intOrNull;     if (i != null) { out.putInt(k, i); return }
        val l = v.longOrNull;    if (l != null) { out.putDouble(k, l.toDouble()); return }
        val d = v.doubleOrNull;  if (d != null) { out.putDouble(k, d); return }
        out.putString(k, v.jsonPrimitive.content)
    }

    private fun pushPrimitive(out: WritableArray, v: JsonPrimitive) {
        if (v.isString) { out.pushString(v.content); return }
        val b = v.booleanOrNull; if (b != null) { out.pushBoolean(b); return }
        val i = v.intOrNull;     if (i != null) { out.pushInt(i); return }
        val l = v.longOrNull;    if (l != null) { out.pushDouble(l.toDouble()); return }
        val d = v.doubleOrNull;  if (d != null) { out.pushDouble(d); return }
        out.pushString(v.jsonPrimitive.content)
    }

    private fun readableMapToElement(map: ReadableMap): JsonElement {
        val obj = mutableMapOf<String, JsonElement>()
        val iter = map.keySetIterator()
        while (iter.hasNextKey()) {
            val k = iter.nextKey()
            obj[k] = readableToElement(map, k)
        }
        return JsonObject(obj)
    }

    private fun readableArrayToElement(arr: ReadableArray): JsonElement {
        val list = mutableListOf<JsonElement>()
        for (i in 0 until arr.size()) {
            list += when (arr.getType(i)) {
                ReadableType.Null    -> JsonNull
                ReadableType.Boolean -> JsonPrimitive(arr.getBoolean(i))
                ReadableType.Number  -> JsonPrimitive(arr.getDouble(i))
                ReadableType.String  -> JsonPrimitive(arr.getString(i))
                // getMap/getArray are nullable in current RN; a null entry is
                // JSON null, not a crash.
                ReadableType.Map     ->
                    arr.getMap(i)?.let { readableMapToElement(it) } ?: JsonNull
                ReadableType.Array   ->
                    arr.getArray(i)?.let { readableArrayToElement(it) } ?: JsonNull
            }
        }
        return JsonArray(list)
    }

    private fun readableToElement(map: ReadableMap, k: String): JsonElement =
        when (map.getType(k)) {
            ReadableType.Null    -> JsonNull
            ReadableType.Boolean -> JsonPrimitive(map.getBoolean(k))
            ReadableType.Number  -> JsonPrimitive(map.getDouble(k))
            ReadableType.String  -> JsonPrimitive(map.getString(k))
            ReadableType.Map     -> readableMapToElement(map.getMap(k)!!)
            ReadableType.Array   -> readableArrayToElement(map.getArray(k)!!)
        }
}
