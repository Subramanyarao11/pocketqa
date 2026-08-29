package com.techphantoms.pocketqa.demobank.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.techphantoms.pocketqa.demobank.data.Fixtures

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsScreen(onTransfer: () -> Unit, onHistory: () -> Unit) {
    Scaffold(
        topBar = { TopAppBar(title = { Text("Accounts") }, modifier = Modifier.testTag("accounts_appbar")) },
        modifier = Modifier.testTag("accounts_screen"),
    ) { padding ->
        LazyColumn(contentPadding = padding, modifier = Modifier.testTag("accounts_list")) {
            items(Fixtures.accounts) { account ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .testTag("account_card_${account.id}")
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(account.name, style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.testTag("account_name_${account.id}"))
                        Text(account.masked, style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.testTag("account_mask_${account.id}"))
                        Spacer(Modifier.height(8.dp))
                        Text(
                            Fixtures.rupees(account.balancePaise),
                            style = MaterialTheme.typography.headlineSmall,
                            modifier = Modifier.testTag("account_balance_${account.id}"),
                        )
                    }
                }
            }
            item {
                Row(
                    Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Button(onClick = onTransfer, modifier = Modifier.weight(1f).testTag("transfer_button")) {
                        Text("Transfer")
                    }
                    OutlinedButton(onClick = onHistory, modifier = Modifier.weight(1f).testTag("history_button")) {
                        Text("History")
                    }
                }
            }
        }
    }
}
