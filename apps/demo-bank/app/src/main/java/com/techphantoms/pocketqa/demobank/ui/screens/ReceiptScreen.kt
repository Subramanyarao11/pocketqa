package com.techphantoms.pocketqa.demobank.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable
fun ReceiptScreen(summary: String, onDone: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp).testTag("receipt_screen"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Transfer complete", style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.testTag("receipt_title"))
        Spacer(Modifier.height(12.dp))
        Text(summary, modifier = Modifier.testTag("receipt_summary"))
        Spacer(Modifier.height(24.dp))
        Button(onClick = onDone, modifier = Modifier.testTag("receipt_done_button")) { Text("Done") }
    }
}
