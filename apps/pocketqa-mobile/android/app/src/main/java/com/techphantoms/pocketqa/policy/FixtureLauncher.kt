package com.techphantoms.pocketqa.policy

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

/**
 * Builds an explicit launch intent for a target app's declared PocketQA fixture.
 *
 * A target that exposes fixtures declares both the ids (`pocketqa.fixtures`) and
 * a URI template such as `demoshop://reset?fixture={fixture}`. Keeping the URI
 * app-owned avoids hardcoding Demo Shop knowledge into the capture/replay
 * engine, while setPackage prevents another app from claiming the deep link.
 */
object FixtureLauncher {
    const val URI_TEMPLATE_META_DATA = "pocketqa.fixtureUriTemplate"
    private const val PLACEHOLDER = "{fixture}"
    private val fixtureId = Regex("[a-z0-9][a-z0-9-]{0,63}")

    internal fun expandUri(template: String?, fixture: String?): String? {
        if (template.isNullOrBlank() || fixture.isNullOrBlank()) return null
        if (PLACEHOLDER !in template || !fixtureId.matches(fixture)) return null
        return template.replace(PLACEHOLDER, fixture)
    }

    fun targetIntent(
        context: Context,
        packageName: String,
        fixture: String?,
        resetTask: Boolean,
    ): Intent? {
        val template = runCatching {
            context.packageManager
                .getApplicationInfo(packageName, PackageManager.GET_META_DATA)
                .metaData
                ?.getString(URI_TEMPLATE_META_DATA)
        }.getOrNull()
        val fixtureUri = expandUri(template, fixture)

        val intent = if (fixtureUri != null) {
            Intent(Intent.ACTION_VIEW, Uri.parse(fixtureUri)).setPackage(packageName)
        } else {
            context.packageManager.getLaunchIntentForPackage(packageName) ?: return null
        }

        if (resetTask) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        return intent
    }
}
