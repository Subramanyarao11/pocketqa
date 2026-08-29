package com.techphantoms.pocketqa.capture

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

/**
 * PocketQaAccessibilityService — the only privileged component that can read
 * the UI tree and request per-window screenshots.
 *
 * Boundary rules:
 *  1. When no capture session is active, all events are ignored.  We do not
 *     retain a background trace.
 *  2. Only events whose package matches the active session package are
 *     forwarded to [CaptureCoordinator].  All others are dropped.
 *  3. Screenshot capture is per-window and gated on a stable state; we never
 *     take a screenshot on a permission dialog, launcher, or another app.
 *  4. Node text is redacted client-side (see Redaction) before it leaves
 *     this service.
 */
class PocketQaAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        // Register with the coordinator so it can dispatch commands (e.g. take
        // a screenshot) back into this privileged process.
        CaptureCoordinator.attach(this)
    }

    override fun onDestroy() {
        CaptureCoordinator.detach(this)
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString() ?: return
        val activeSessionPackage = CaptureCoordinator.activePackage() ?: return
        if (pkg != activeSessionPackage) return
        CaptureCoordinator.onEvent(event, rootInActiveWindow)
    }

    override fun onInterrupt() { /* required override, no-op */ }
}
