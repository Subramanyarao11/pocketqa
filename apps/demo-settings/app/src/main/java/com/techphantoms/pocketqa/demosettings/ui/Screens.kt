package com.techphantoms.pocketqa.demosettings.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.techphantoms.pocketqa.demosettings.SettingsStore

@OptIn(ExperimentalMaterial3Api::class)
private @Composable
fun Bar(title: String, tag: String, onBack: (() -> Unit)? = null) {
    TopAppBar(
        title = { Text(title, modifier = Modifier.testTag("${tag}_title")) },
        navigationIcon = {
            if (onBack != null) {
                TextButton(onClick = onBack, modifier = Modifier.testTag("${tag}_back")) { Text("Back") }
            }
        },
        modifier = Modifier.testTag("${tag}_appbar"),
    )
}

/**
 * Root list with a live search field.
 *
 * The search is the point: typing "cam" takes twenty-two rows down to one
 * without any navigation. Every id on screen changes, the screen does not.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RootSettingsScreen(onOpenGroup: (String) -> Unit, onOpenAbout: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val matches = SettingsStore.items.filter {
        query.isBlank() || it.title.contains(query, ignoreCase = true)
    }

    Scaffold(
        topBar = { Bar("Settings", "root") },
        modifier = Modifier.testTag("root_screen"),
    ) { padding ->
        Column(Modifier.padding(padding)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search settings") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(16.dp).testTag("search_input"),
            )
            Text(
                "${matches.size} of ${SettingsStore.items.size} settings",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(horizontal = 16.dp).testTag("search_count"),
            )
            LazyColumn(modifier = Modifier.testTag("root_list")) {
                if (query.isBlank()) {
                    items(SettingsStore.groups()) { group ->
                        ListItem(
                            headlineContent = {
                                Text(group, modifier = Modifier.testTag("group_label_$group"))
                            },
                            supportingContent = {
                                Text(
                                    "${SettingsStore.items.count { it.group == group }} settings",
                                    modifier = Modifier.testTag("group_count_$group"),
                                )
                            },
                            modifier = Modifier
                                .selectable(selected = false, onClick = { onOpenGroup(group) })
                                .testTag("group_row_$group"),
                        )
                        HorizontalDivider()
                    }
                    item {
                        ListItem(
                            headlineContent = { Text("About", modifier = Modifier.testTag("about_label")) },
                            modifier = Modifier
                                .selectable(selected = false, onClick = onOpenAbout)
                                .testTag("about_row"),
                        )
                    }
                } else {
                    items(matches) { t ->
                        SettingRow(id = t.id, title = t.title, subtitle = t.group, on = t.on)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingRow(id: String, title: String, subtitle: String, on: Boolean) {
    var checked by remember(id) { mutableStateOf(on) }
    ListItem(
        headlineContent = { Text(title, modifier = Modifier.testTag("setting_label_$id")) },
        supportingContent = { Text(subtitle, modifier = Modifier.testTag("setting_group_$id")) },
        trailingContent = {
            Switch(
                checked = checked,
                onCheckedChange = { checked = it; SettingsStore.set(id, it) },
                modifier = Modifier.testTag("switch_$id"),
            )
        },
        modifier = Modifier.testTag("setting_row_$id"),
    )
    HorizontalDivider()
}

/** Switches, a radio group, and a slider — the control types a Compose shop app never shows. */
@Composable
fun GroupScreen(
    group: String,
    dark: Boolean,
    onDarkChange: (Boolean) -> Unit,
    onBack: () -> Unit,
    onOpenAdvanced: () -> Unit,
) {
    val rows = SettingsStore.items.filter { it.group == group }
    var refresh by remember { mutableStateOf("Every 15 minutes") }
    var volume by remember { mutableFloatStateOf(0.4f) }

    Scaffold(
        topBar = { Bar(group, "group", onBack) },
        modifier = Modifier.testTag("group_screen"),
    ) { padding ->
        LazyColumn(contentPadding = padding, modifier = Modifier.testTag("group_list")) {
            items(rows) { t ->
                SettingRow(id = t.id, title = t.title, subtitle = t.group, on = t.on)
            }
            item {
                // A theme switch repaints every node on the screen while the
                // structure stays identical — the mirror image of the search
                // case, and just as easy to misread as navigation.
                ListItem(
                    headlineContent = { Text("Dark theme", modifier = Modifier.testTag("dark_label")) },
                    trailingContent = {
                        Switch(
                            checked = dark,
                            onCheckedChange = onDarkChange,
                            modifier = Modifier.testTag("switch_dark_theme"),
                        )
                    },
                    modifier = Modifier.testTag("dark_row"),
                )
                HorizontalDivider()
            }
            item {
                Column(Modifier.padding(16.dp)) {
                    Text("Refresh interval", style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.testTag("refresh_heading"))
                    listOf("Every 15 minutes", "Hourly", "Manually").forEach { option ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .selectable(selected = refresh == option, onClick = { refresh = option })
                                .padding(vertical = 4.dp)
                                .testTag("refresh_row_${option.substringBefore(' ').lowercase()}"),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = refresh == option,
                                onClick = { refresh = option },
                                modifier = Modifier.testTag(
                                    "refresh_radio_${option.substringBefore(' ').lowercase()}"
                                ),
                            )
                            Text(option, modifier = Modifier.testTag(
                                "refresh_label_${option.substringBefore(' ').lowercase()}"
                            ))
                        }
                    }
                }
            }
            item {
                Column(Modifier.padding(16.dp)) {
                    Text("Alert volume", style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.testTag("volume_heading"))
                    // A continuous control: there is no single "correct" value to
                    // replay, so a selector that leans on the rendered number is
                    // guaranteed to drift.
                    Slider(
                        value = volume,
                        onValueChange = { volume = it },
                        modifier = Modifier.testTag("volume_slider"),
                    )
                    Text("${(volume * 100).toInt()}%", modifier = Modifier.testTag("volume_value"))
                }
            }
            item {
                Button(
                    onClick = onOpenAdvanced,
                    modifier = Modifier.fillMaxWidth().padding(16.dp).testTag("advanced_button"),
                ) { Text("Advanced") }
            }
        }
    }
}

/** Third level, so the back stack is deeper than one hop. */
@Composable
fun AdvancedScreen(group: String, onBack: () -> Unit) {
    var confirmReset by remember { mutableStateOf(false) }
    Scaffold(
        topBar = { Bar("$group · Advanced", "advanced", onBack) },
        modifier = Modifier.testTag("advanced_screen"),
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("These options apply to $group only.",
                modifier = Modifier.testTag("advanced_body"))
            OutlinedButton(
                onClick = { confirmReset = true },
                modifier = Modifier.fillMaxWidth().testTag("reset_group_button"),
            ) { Text("Reset $group settings") }
        }
    }

    if (confirmReset) {
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text("Reset settings", modifier = Modifier.testTag("reset_dialog_title")) },
            text = { Text("This restores defaults for $group.",
                modifier = Modifier.testTag("reset_dialog_body")) },
            confirmButton = {
                TextButton(onClick = { confirmReset = false },
                    modifier = Modifier.testTag("reset_confirm_button")) { Text("Reset") }
            },
            dismissButton = {
                TextButton(onClick = { confirmReset = false },
                    modifier = Modifier.testTag("reset_cancel_button")) { Text("Cancel") }
            },
            modifier = Modifier.testTag("reset_dialog"),
        )
    }
}

@Composable
fun AboutScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = { Bar("About", "about", onBack) },
        modifier = Modifier.testTag("about_screen"),
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            Text("Demo Settings", style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.testTag("about_app_name"))
            Text("Version 1.0 (fixture: ${SettingsStore.mode})",
                modifier = Modifier.testTag("about_version"))
        }
    }
}
