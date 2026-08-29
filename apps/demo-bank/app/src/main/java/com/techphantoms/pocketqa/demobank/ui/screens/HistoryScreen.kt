package com.techphantoms.pocketqa.demobank.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.techphantoms.pocketqa.demobank.data.Fixtures

/**
 * A long list plus a filter row.
 *
 * Two things here are aimed squarely at PocketQA. The list is longer than one
 * screen, so a demonstration has to scroll — and a scroll must not be recorded
 * as a tap. The filter chips remove most of the rows without leaving the
 * screen, which is the case that a naive "the tree changed a lot, so we
 * navigated" rule gets wrong.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(onBack: () -> Unit) {
    var filter by remember { mutableStateOf("All") }
    val categories = listOf("All", "Food", "Bills", "Transport", "Shopping", "Health")
    val rows = Fixtures.transactions.filter { filter == "All" || it.category == filter }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("History") },
                navigationIcon = {
                    TextButton(onClick = onBack, modifier = Modifier.testTag("history_back")) { Text("Back") }
                },
                modifier = Modifier.testTag("history_appbar"),
            )
        },
        modifier = Modifier.testTag("history_screen"),
    ) { padding ->
        Column(Modifier.padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                categories.take(3).forEach { c ->
                    FilterChip(
                        selected = filter == c,
                        onClick = { filter = c },
                        label = { Text(c) },
                        modifier = Modifier.testTag("filter_${c.lowercase()}"),
                    )
                }
            }
            Text(
                "${rows.size} transactions",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(horizontal = 16.dp).testTag("history_count"),
            )
            LazyColumn(modifier = Modifier.testTag("history_list")) {
                items(rows) { t ->
                    ListItem(
                        headlineContent = {
                            Text(t.label, modifier = Modifier.testTag("txn_label_${t.id}"))
                        },
                        supportingContent = {
                            Text("${t.category} · ${t.daysAgo}d ago",
                                modifier = Modifier.testTag("txn_meta_${t.id}"))
                        },
                        trailingContent = {
                            Text("-" + Fixtures.rupees(t.amountPaise),
                                modifier = Modifier.testTag("txn_amount_${t.id}"))
                        },
                        modifier = Modifier.testTag("txn_row_${t.id}"),
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}
