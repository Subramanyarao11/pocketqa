package com.techphantoms.pocketqa.capture

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.HardwareBuffer
import android.os.Build
import android.view.Display
import androidx.core.content.FileProvider
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Per-window screenshot capture (API 30+).
 *
 * The accessibility service `takeScreenshot` API returns a HardwareBuffer that
 * we materialise into a PNG under `filesDir/screenshots/`. The file is exposed
 * via FileProvider so exports / evidence detail can render it without granting
 * broad storage access.
 *
 * On pre-30 devices the call is a no-op and the caller falls back to no
 * screenshot (schema-legal — `screenshotDataUri` is optional).
 */
object ScreenshotCapture {

    private val executor: Executor = Executors.newSingleThreadExecutor()

    data class Result(val uri: String)

    fun takePng(
        service: AccessibilityService,
        ctx: Context,
        stateId: String,
    ): Result? {
        if (Build.VERSION.SDK_INT < 30) return null
        val bitmap = takeBitmap(service) ?: return null
        val dir = File(ctx.filesDir, "screenshots").apply { mkdirs() }
        val file = File(dir, "$stateId.png")
        try {
            file.outputStream().use { out -> bitmap.compress(Bitmap.CompressFormat.PNG, 90, out) }
        } finally {
            bitmap.recycle()
        }
        val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", file)
        return Result(uri.toString())
    }

    @Suppress("DEPRECATION")
    private fun takeBitmap(service: AccessibilityService): Bitmap? {
        if (Build.VERSION.SDK_INT < 30) return null
        val latch = CountDownLatch(1)
        var result: Bitmap? = null
        service.takeScreenshot(
            Display.DEFAULT_DISPLAY,
            executor,
            object : AccessibilityService.TakeScreenshotCallback {
                override fun onSuccess(sr: AccessibilityService.ScreenshotResult) {
                    val hb: HardwareBuffer = sr.hardwareBuffer
                    try {
                        result = Bitmap.wrapHardwareBuffer(hb, sr.colorSpace)?.let { hwBmp ->
                            // Convert to a mutable ARGB_8888 copy so we can compress it.
                            hwBmp.copy(Bitmap.Config.ARGB_8888, false).also { hwBmp.recycle() }
                        }
                    } finally {
                        hb.close()
                        latch.countDown()
                    }
                }

                override fun onFailure(errorCode: Int) {
                    latch.countDown()
                }
            },
        )
        // Cap at 750 ms so a stuck screenshot never blocks the capture pipeline.
        latch.await(750, TimeUnit.MILLISECONDS)
        return result
    }

    /** Kept referenced so the linker doesn't drop PixelFormat pulls on some SDKs. */
    @Suppress("unused")
    private val keepPixelFormat = PixelFormat.RGBA_8888
}
