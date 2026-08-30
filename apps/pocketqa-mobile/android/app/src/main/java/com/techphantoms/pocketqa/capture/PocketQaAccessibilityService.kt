package com.techphantoms.pocketqa.capture

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
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
    private val handler = Handler(Looper.getMainLooper())
    private val debounce = Runnable { publishStableState() }
    private val policy = PolicyEngine()
    @Volatile private var latestPackage: String? = null
    @Volatile private var latestScreen: String? = null

    override fun onServiceConnected() {
        CaptureCoordinator.attach(this)
        configurePassiveInputObservation()
    }

    /**
     * Keep touchscreen input owned by the target app.
     *
     * Android 14's AccessibilityService.onMotionEvent API is not a passive tap
     * observer: events from sources registered with setMotionEventSources are
     * withheld from the rest of the system. Registering SOURCE_TOUCHSCREEN made
     * the service consume every physical gesture on Android 16/iQOO.
     *
     * Explicitly clear both the source mask and the related flag. Clearing at
     * connection time also repairs an already-enabled service after an APK
     * upgrade where the previous process had installed the unsafe runtime
     * configuration. Tap attribution continues through AccessibilityEvent
     * sources plus before/after UI-tree inference in CaptureCoordinator.
     */
    private fun configurePassiveInputObservation() {
        if (android.os.Build.VERSION.SDK_INT < 34) return
        runCatching {
            serviceInfo = serviceInfo?.apply {
                flags = PassiveInputPolicy.sanitizeFlags(flags)
                setMotionEventSources(PassiveInputPolicy.MOTION_EVENT_SOURCES)
            }
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
        val pkg = latestPackage ?: return
        val screen = latestScreen ?: "screen"
        // Snapshot the *target's* window, not whichever one is active.
        //
        // This read rootInActiveWindow and stamped it with the session package,
        // so during the switch into the target — while the previous app still
        // owned the active window — that app's tree was recorded as the
        // target's. A Demo Shop test came out with `add_task_fab`, a Demo Tasks
        // control, as its first step. Observing through CaptureCoordinator
        // yields Ok only when the target's own window is readable; anything
        // else is skipped, and the next debounce tries again.
        val baseline = when (
            val obs = CaptureCoordinator.observe(pkg, screen)
        ) {
            is CaptureCoordinator.Observation.Ok -> obs.snapshot
            else -> return
        }
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

/** Pure policy kept separate so the no-input-interception invariant is unit tested. */
internal object PassiveInputPolicy {
    const val MOTION_EVENT_SOURCES = 0

    fun sanitizeFlags(flags: Int): Int =
        flags and AccessibilityServiceInfo.FLAG_SEND_MOTION_EVENTS.inv()
}
