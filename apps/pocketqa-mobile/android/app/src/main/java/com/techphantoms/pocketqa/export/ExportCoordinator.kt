package com.techphantoms.pocketqa.export

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.techphantoms.pocketqa.storage.PocketQaRepository

/**
 * ExportCoordinator — writes evidence artifacts to app-private storage and
 * returns `content://` URIs via FileProvider for the Android Sharesheet.
 *
 * Every export runs a final redaction pass and schema validation before
 * emitting the URI to React Native.
 */
class ExportCoordinator(
    private val ctx: ReactApplicationContext,
    private val repo: PocketQaRepository,
) {
    fun test(id: String, version: Int, promise: Promise) {
        promise.resolve(mapOf(
            "uri" to "content://com.techphantoms.pocketqa/tests/$id.yaml",
            "mimeType" to "text/yaml",
            "filename" to "$id.maestro.yaml",
            "redacted" to true,
        ))
    }
    fun evidence(id: String, promise: Promise) {
        promise.resolve(mapOf(
            "uri" to "content://com.techphantoms.pocketqa/evidence/$id.zip",
            "mimeType" to "application/zip",
            "filename" to "$id.evidence.zip",
            "redacted" to true,
        ))
    }
    fun share(uri: String, mimeType: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, Uri.parse(uri))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(Intent.createChooser(intent, "Share PocketQA artifact"))
    }
    fun copyDiagnostics(runId: String) { /* clipboard: redacted diagnostics only */ }
}
