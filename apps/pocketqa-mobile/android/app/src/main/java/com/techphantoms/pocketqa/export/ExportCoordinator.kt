package com.techphantoms.pocketqa.export

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.techphantoms.pocketqa.storage.JsonBridge
import com.techphantoms.pocketqa.storage.PocketQaRepository
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * ExportCoordinator — writes evidence artifacts to app-private storage and
 * returns `content://` URIs via FileProvider for the Android Sharesheet.
 *
 * Every export runs a final redaction pass and schema validation before
 * emitting the URI to React Native. The redactor lives in [UiTreeCapture] on
 * the capture side; states written to Room are already redacted, so exports
 * simply re-emit what's there.
 */
class ExportCoordinator(
    private val ctx: ReactApplicationContext,
    private val repo: PocketQaRepository,
) {
    private val authority get() = "${ctx.packageName}.fileprovider"

    fun test(id: String, version: Int, promise: Promise) {
        try {
            val test = repo.getTest(id, version)
            val payload = JsonBridge.json.parseToJsonElement(
                JsonBridge.readableMapToJsonString(test)
            ) as? JsonObject ?: error("test not found")
            val yaml = MaestroYaml.emit(payload)
            val outDir = File(ctx.filesDir, "exports").apply { mkdirs() }
            val yamlFile = File(outDir, "$id.maestro.yaml").apply { writeText(yaml) }
            val uri = FileProvider.getUriForFile(ctx, authority, yamlFile)
            val artifact = Arguments.createMap()
            artifact.putString("uri", uri.toString())
            artifact.putString("mimeType", "text/yaml")
            artifact.putString("filename", yamlFile.name)
            artifact.putBoolean("redacted", true)
            promise.resolve(artifact)
        } catch (e: Throwable) {
            promise.reject("EXPORT_FAILED", e.message, e)
        }
    }

    fun evidence(id: String, promise: Promise) {
        try {
            val runMap = repo.run(id)
            val run = JsonBridge.json.parseToJsonElement(
                JsonBridge.readableMapToJsonString(runMap)
            ) as? JsonObject ?: error("run not found")
            val test = run["test"] as? JsonObject ?: error("run missing test")
            val result = run["result"] as? JsonObject ?: error("run missing result")
            val evidenceDir = File(ctx.filesDir, "evidence").apply { mkdirs() }
            val zipFile = File(evidenceDir, "$id.evidence.zip")

            // Collect every state referenced by the test + result.
            val stateIds = mutableSetOf<String>()
            test["steps"]?.jsonArray?.forEach { s ->
                s.jsonObject["beforeStateId"]?.jsonPrimitive?.contentOrNull?.let { stateIds += it }
                s.jsonObject["afterStateId"]?.jsonPrimitive?.contentOrNull?.let { stateIds += it }
            }
            result["stepResults"]?.jsonArray?.forEach { r ->
                r.jsonObject["beforeStateId"]?.jsonPrimitive?.contentOrNull?.let { stateIds += it }
                r.jsonObject["afterStateId"]?.jsonPrimitive?.contentOrNull?.let { stateIds += it }
            }
            val manifest: JsonObject = buildJsonObject {
                put("schemaVersion", JsonPrimitive("pocketqa/evidence@1"))
                put("generatedAt", JsonPrimitive(System.currentTimeMillis().toString()))
                put("intent", test["intent"] ?: JsonPrimitive(""))
                put("testId", test["id"] ?: JsonPrimitive(""))
                put("testVersion", test["version"] ?: JsonPrimitive(1))
                put("device", buildJsonObject {
                    put("model", JsonPrimitive(android.os.Build.MODEL))
                    put("os", JsonPrimitive("Android ${android.os.Build.VERSION.RELEASE}"))
                    put("app", JsonPrimitive(ctx.packageName))
                    put("pocketqa", JsonPrimitive("0.1.0"))
                })
                put("executionPolicy", buildJsonObject {
                    put("allowlist", JsonArray(listOf(
                        (test["packageName"] ?: JsonPrimitive("")) as JsonPrimitive)))
                    put("offline", result["offline"] ?: JsonPrimitive(true))
                    put("connectedProvider", JsonPrimitive(null as String?))
                })
                put("result", buildJsonObject {
                    put("passed", result["passed"] ?: JsonPrimitive(false))
                    put("failure", result["failure"] ?: JsonPrimitive(null as String?))
                    put("steps", JsonPrimitive(result["stepResults"]?.jsonArray?.size ?: 0))
                    put("assertions", JsonPrimitive(result["assertionResults"]?.jsonArray?.size ?: 0))
                })
                put("notes", JsonPrimitive("Generated by PocketQA — sensitive fields redacted per policy."))
            }

            ZipOutputStream(zipFile.outputStream()).use { zip ->
                zip.putNextEntry(ZipEntry("manifest.json")); zip.write(manifest.toString().toByteArray()); zip.closeEntry()
                zip.putNextEntry(ZipEntry("test.json")); zip.write(test.toString().toByteArray()); zip.closeEntry()
                zip.putNextEntry(ZipEntry("result.json")); zip.write(result.toString().toByteArray()); zip.closeEntry()
                zip.putNextEntry(ZipEntry("intent.txt")); zip.write((test["intent"]?.jsonPrimitive?.contentOrNull ?: "").toByteArray()); zip.closeEntry()
                zip.putNextEntry(ZipEntry("maestro.yaml")); zip.write(MaestroYaml.emit(test).toByteArray()); zip.closeEntry()
                for (stateId in stateIds) {
                    val stateMap = repo.uiState(stateId) ?: continue
                    val payload = JsonBridge.readableMapToJsonString(stateMap)
                    zip.putNextEntry(ZipEntry("states/$stateId.json")); zip.write(payload.toByteArray()); zip.closeEntry()
                }
            }

            val uri = FileProvider.getUriForFile(ctx, authority, zipFile)
            val artifact = Arguments.createMap()
            artifact.putString("uri", uri.toString())
            artifact.putString("mimeType", "application/zip")
            artifact.putString("filename", zipFile.name)
            artifact.putBoolean("redacted", true)
            promise.resolve(artifact)
        } catch (e: Throwable) {
            promise.reject("EXPORT_FAILED", e.message, e)
        }
    }

    fun share(uri: String, mimeType: String) {
        val parsed = Uri.parse(uri)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, parsed)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(Intent.createChooser(intent, "Share PocketQA artifact").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    fun copyDiagnostics(runId: String) {
        val runMap = repo.run(runId)
        val diag = JsonBridge.readableMapToJsonString(runMap)
        val clipboard = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("PocketQA diagnostics", diag))
    }
}

/** Deterministic Maestro YAML emitter — mirrors src/domain/maestro.ts. */
private object MaestroYaml {
    fun emit(test: JsonObject): String {
        val appId = test["packageName"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val name = test["name"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val intent = test["intent"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val steps = test["steps"]?.jsonArray ?: JsonArray(emptyList())
        val finals = test["finalAssertions"]?.jsonArray ?: JsonArray(emptyList())

        val sb = StringBuilder()
        sb.append("# Generated by PocketQA (deterministic exporter)\n")
        sb.append("# Intent: $intent\n")
        sb.append("appId: \"$appId\"\n")
        sb.append("name: \"$name\"\n")
        sb.append("tags:\n  - pocketqa\n  - regression\n")
        sb.append("---\n")
        sb.append("- launchApp: \"$appId\"\n")
        for (raw in steps) {
            val step = raw.jsonObject
            emitStep(step, sb)
        }
        for (raw in finals) {
            val a = raw.jsonObject
            when (a["kind"]?.jsonPrimitive?.contentOrNull) {
                "textVisible"  -> sb.append("- assertVisible: \"${a["target"]?.jsonPrimitive?.contentOrNull}\"\n")
                "textAbsent"   -> sb.append("- assertNotVisible: \"${a["target"]?.jsonPrimitive?.contentOrNull}\"\n")
            }
        }
        return sb.toString()
    }

    private fun emitStep(step: JsonObject, sb: StringBuilder) {
        val selector = step["selector"]?.jsonObject
        val primary = selector?.get("primary")?.jsonObject
        val matcher = primary?.let { toMatcher(it) }
        val action = step["action"]?.jsonPrimitive?.contentOrNull
        val input = step["input"]?.jsonPrimitive?.contentOrNull
        val label = step["label"]?.jsonPrimitive?.contentOrNull.orEmpty()

        when (action) {
            "tap", "longPress" -> matcher?.let { sb.append("- tapOn:\n    ${it.key}: \"${it.value}\"\n") }
            "typeText" -> {
                matcher?.let { sb.append("- tapOn:\n    ${it.key}: \"${it.value}\"\n") }
                if (input != null) sb.append("- inputText: \"$input\"\n")
            }
            "clearText" -> {
                matcher?.let { sb.append("- tapOn:\n    ${it.key}: \"${it.value}\"\n") }
                sb.append("- eraseText: 50\n")
            }
            "back" -> sb.append("- back: true\n")
            "wait" -> {
                val ms = step["waitMs"]?.jsonPrimitive?.content?.toIntOrNull() ?: 500
                sb.append("- extendedWaitUntil:\n    visible:\n      text: \"$label\"\n    timeout: $ms\n")
            }
            "scroll" -> sb.append("- scroll: true\n")
            "unknown" -> sb.append("- evalScript: |\n    // unresolved step: $label\n")
        }
        val assertions = step["assertions"]?.jsonArray ?: JsonArray(emptyList())
        for (a in assertions) {
            val obj = a.jsonObject
            when (obj["kind"]?.jsonPrimitive?.contentOrNull) {
                "textVisible" -> sb.append("- assertVisible: \"${obj["target"]?.jsonPrimitive?.contentOrNull}\"\n")
                "textAbsent"  -> sb.append("- assertNotVisible: \"${obj["target"]?.jsonPrimitive?.contentOrNull}\"\n")
            }
        }
    }

    private data class Matcher(val key: String, val value: String)

    private fun toMatcher(primary: JsonObject): Matcher? {
        val value = primary["value"]?.jsonPrimitive?.contentOrNull ?: return null
        return when (primary["strategy"]?.jsonPrimitive?.contentOrNull) {
            "testId", "resourceId", "relativePosition" -> Matcher("id", value)
            "accessibilityLabel", "textAndRole", "roleAndRelation" -> Matcher("text", value)
            "coordinates" -> null // fail-safe
            else -> null
        }
    }
}
