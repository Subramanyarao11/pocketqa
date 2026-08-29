package com.techphantoms.pocketqa.demosettings

data class Toggle(val id: String, val title: String, val group: String, var on: Boolean)

/**
 * The searchable settings corpus.
 *
 * Sized so a search narrows twenty-odd rows down to two or three. That is the
 * case this app exists to produce: most of the ids on screen disappear and no
 * navigation has happened. A rule that reads "the tree changed a lot, so we
 * moved to a new screen" gets this wrong, and getting it wrong means a filter
 * chip can be blamed for a tap that landed somewhere else entirely.
 */
object SettingsStore {

    var mode: String = "reset"
        private set

    private fun seed() = mutableListOf(
        Toggle("wifi", "Wi-Fi", "Network", true),
        Toggle("bluetooth", "Bluetooth", "Network", false),
        Toggle("hotspot", "Mobile hotspot", "Network", false),
        Toggle("airplane", "Airplane mode", "Network", false),
        Toggle("data_saver", "Data saver", "Network", false),
        Toggle("notifications", "Notifications", "Alerts", true),
        Toggle("sounds", "Sounds", "Alerts", true),
        Toggle("vibrate", "Vibrate on ring", "Alerts", false),
        Toggle("badges", "App badges", "Alerts", true),
        Toggle("location", "Location", "Privacy", true),
        Toggle("camera_access", "Camera access", "Privacy", true),
        Toggle("mic_access", "Microphone access", "Privacy", false),
        Toggle("analytics", "Share analytics", "Privacy", false),
        Toggle("crash_reports", "Send crash reports", "Privacy", true),
        Toggle("autofill", "Autofill", "Privacy", true),
        Toggle("dark_mode", "Dark mode", "Display", false),
        Toggle("large_text", "Large text", "Display", false),
        Toggle("reduce_motion", "Reduce motion", "Display", false),
        Toggle("auto_rotate", "Auto-rotate", "Display", true),
        Toggle("battery_saver", "Battery saver", "System", false),
        Toggle("auto_update", "Auto-update apps", "System", true),
        Toggle("backup", "Back up to cloud", "System", true),
    )

    var items: MutableList<Toggle> = seed()
        private set

    fun apply(fixture: String?) {
        mode = fixture ?: "reset"
        items = seed()
        when (mode) {
            "all-enabled" -> items.forEach { it.on = true }
            "restricted-profile" -> items.forEach { it.on = it.group == "System" }
        }
    }

    fun set(id: String, on: Boolean) {
        items.find { it.id == id }?.on = on
    }

    fun groups(): List<String> = items.map { it.group }.distinct()
}
