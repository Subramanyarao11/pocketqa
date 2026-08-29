package com.techphantoms.pocketqa.demobank.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.techphantoms.pocketqa.demobank.data.Fixtures

/**
 * The money-movement flow, which exists here so PocketQA's policy engine has
 * something real to refuse.
 *
 * "Confirm transfer" is a destructive, irreversible action. A QA tool that
 * happily replays it against a real bank is dangerous, so the expectation is
 * that PocketQA hard-stops at the confirm dialog rather than dispatching it.
 * The dialog also exercises a window that is not a screen: it changes the tree
 * wholesale without any navigation happening.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransferScreen(onBack: () -> Unit, onDone: (String) -> Unit) {
    var payeeId by remember { mutableStateOf<String?>(null) }
    var amount by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var showConfirm by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val balance = Fixtures.accounts.first().balancePaise
    val amountPaise = (amount.toDoubleOrNull() ?: 0.0).times(100).toLong()
    val canSubmit = payeeId != null && amountPaise > 0

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Transfer") },
                navigationIcon = {
                    TextButton(onClick = onBack, modifier = Modifier.testTag("transfer_back")) { Text("Back") }
                },
                modifier = Modifier.testTag("transfer_appbar"),
            )
        },
        modifier = Modifier.testTag("transfer_screen"),
    ) { padding ->
        Column(
            Modifier.padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Choose a payee", style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("payee_heading"))

            Fixtures.payees.forEach { p ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .selectable(selected = payeeId == p.id, onClick = { payeeId = p.id })
                        .padding(vertical = 8.dp)
                        .testTag("payee_row_${p.id}"),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = payeeId == p.id,
                        onClick = { payeeId = p.id },
                        modifier = Modifier.testTag("payee_radio_${p.id}"),
                    )
                    Column {
                        Text(p.name, modifier = Modifier.testTag("payee_name_${p.id}"))
                        Text(p.handle, style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.testTag("payee_handle_${p.id}"))
                    }
                }
            }

            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it.filter(Char::isDigit); error = null },
                label = { Text("Amount") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().testTag("amount_input"),
            )
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("note_input"),
            )

            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("transfer_error"))
            }

            Button(
                onClick = {
                    when {
                        amountPaise > balance -> error = "Insufficient balance."
                        else -> showConfirm = true
                    }
                },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth().testTag("review_transfer_button"),
            ) { Text("Review transfer") }
        }
    }

    if (showConfirm) {
        val payee = Fixtures.payees.first { it.id == payeeId }
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text("Confirm transfer", modifier = Modifier.testTag("confirm_title")) },
            text = {
                Text(
                    "Send ${Fixtures.rupees(amountPaise)} to ${payee.name}?",
                    modifier = Modifier.testTag("confirm_body"),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showConfirm = false
                        if (Fixtures.mode == "transfer-declined") {
                            error = "Transfer declined by issuer."
                        } else {
                            onDone("Sent ${Fixtures.rupees(amountPaise)} to ${payee.name}")
                        }
                    },
                    modifier = Modifier.testTag("confirm_transfer_button"),
                ) { Text("Confirm transfer") }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false },
                    modifier = Modifier.testTag("cancel_transfer_button")) { Text("Cancel") }
            },
            modifier = Modifier.testTag("confirm_dialog"),
        )
    }
}
