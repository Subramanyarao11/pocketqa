package com.techphantoms.pocketqa.capture

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.techphantoms.pocketqa.policy.PolicyEngine

/**
 * PocketQaAccessibilityService — the only privileged component that can read
 * the UI tree and request per-window screenshots.
 *
 * Runtime rules (Build Spec §7):
 *  1. When no capture session is active, all events are ignored.  We do not
 *     retain a background trace.
 *  2. Only events whose package matches the active session package are
 *     forwarded to [CaptureCoordinator].  All others are dropped.
 *  3. Screenshot capture is per-window and gated on a stable state; we never
 *     take a screenshot on a permission dialog, launcher, or another app.
 *  4. Node text is redacted client-side (see [UiTreeCapture]) before it leaves
 *     this service.
 *  5. Events are debounced (idle window = 180 ms) so a stream of layout
 *     transitions produces exactly one persisted UIState per stable frame.
 */
class PocketQaAccessibilityService : AccessibilityService() {

    private companion object {
        /** Longer than this and it is a long-press, not a tap. */
        const val TAP_MAX_MS = 600L
    }

    private val handler = Handler(Looper.getMainLooper())
    private val debounce = Runnable { publishStableState() }
    private val policy = PolicyEngine()
    @Volatile private var latestPackage: String? = null
    @Volatile private var latestScreen: String? = null
    private var downX = 0f
    private var downY = 0f
    private var downAt = 0L
    /** Android's own tap threshold, in pixels for this display. */
    private val tapSlopPx: Float by lazy {
        android.view.ViewConfiguration.get(this).scaledTouchSlop.toFloat()
    }

    override fun onServiceConnected() {
        CaptureCoordinator.attach(this)
        requestTouchObservation()
    }

    /**
     * Ask to observe touchscreen motion events (Android 14+).
     *
     * This is not touch exploration: input is not intercepted or re-dispatched,
     * the target app receives every gesture unchanged, and TalkBack-style
     * behaviour is not enabled. We only learn where a tap landed — which on a
     * Compose target is the difference between knowing what was tapped and
     * guessing, since Compose dispatches no click event for a finger tap.
     */
    private fun requestTouchObservation() {
        if (android.os.Build.VERSION.SDK_INT < 34) return
        runCatching {
            serviceInfo = serviceInfo?.apply {
                // Both are required: the flag opts the service into motion
                // events at all, the source mask says which ones.
                flags = flags or
                    android.accessibilityservice.AccessibilityServiceInfo.FLAG_SEND_MOTION_EVENTS
                setMotionEventSources(android.view.InputDevice.SOURCE_TOUCHSCREEN)
            }
        }
    }

    override fun onMotionEvent(event: android.view.MotionEvent) {
        when (event.actionMasked) {
            android.view.MotionEvent.ACTION_DOWN -> {
                downX = event.rawX
                downY = event.rawY
                downAt = event.eventTime
            }
            android.view.MotionEvent.ACTION_UP -> {
                // Only a tap counts. A scroll and a tap both start with a finger
                // going down; reporting a fling as a tap would attribute a whole
                // screen of churn to whatever the finger happened to start on,
                // which is exactly the fabrication the scroll guard exists to
                // prevent.
                val slop = kotlin.math.hypot(
                    (event.rawX - downX).toDouble(), (event.rawY - downY).toDouble(),
                )
                val held = event.eventTime - downAt
                if (slop <= tapSlopPx && held <= TAP_MAX_MS) {
                    CaptureCoordinator.onTap(event.rawX.toInt(), event.rawY.toInt())
                }
            }
            android.view.MotionEvent.ACTION_CANCEL -> downAt = 0L
        }
    }

    override fun onDestroy() {
        CaptureCoordinator.detach(this)
        handler.removeCallbacks(debounce)
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString() ?: return
        val activeSessionPackage = CaptureCoordinator.activePackage() ?: return
        if (pkg != activeSessionPackage) return

        // Package boundary gate — belt-and-braces on top of the config.
        if (!policy.inAllowlist(pkg)) return

        val root = rootInActiveWindow ?: return
        latestPackage = pkg
        latestScreen = event.className?.toString()?.substringAfterLast('.') ?: latestScreen ?: "screen"


        // Also forward the raw event so the coordinator can classify taps /
        // typing / navigation transitions immediately.
        CaptureCoordinator.onEvent(event, root)

        // Debounce a snapshot so we only persist one UIState per stable frame.
        handler.removeCallbacks(debounce)
        handler.postDelayed(debounce, 180)
    }

    private fun publishStableState() {
        val root = rootInActiveWindow ?: return
        val pkg = latestPackage ?: return
        val screen = latestScreen ?: "screen"
        val baseline = UiTreeCapture.snapshot(
            root, pkg, screen, System.currentTimeMillis(), displayMetrics(),
        )
        // Best-effort screenshot; falls back to no URI if the API is unavailable
        // or a permission dialog covers the target window.
        val screenshot = try {
            ScreenshotCapture.takePng(this, applicationContext, baseline.stateId)
        } catch (_: Throwable) { null }
        val enriched = if (screenshot != null) {
            baseline.copy(payload = UiTreeCapture.mergeScreenshotUri(baseline.payload, screenshot.uri))
        } else baseline
        CaptureCoordinator.onStableState(enriched)
    }

    /** Screen geometry for bounds ratios and dp-based rules (CAP-01). */
    private fun displayMetrics(): UiTreeCapture.Display {
        val m = resources.displayMetrics
        return UiTreeCapture.Display(m.widthPixels, m.heightPixels, m.density)
    }

    override fun onInterrupt() { /* required override, no-op */ }
}
