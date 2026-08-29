package com.techphantoms.pocketqa.demobank

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.techphantoms.pocketqa.demobank.data.Fixtures
import com.techphantoms.pocketqa.demobank.ui.screens.*
import com.techphantoms.pocketqa.demobank.ui.theme.DemoBankTheme

class MainActivity : ComponentActivity() {
    @OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        setContent {
            DemoBankTheme {
                // Compose keeps test tags out of the accessibility tree unless
                // this is set, and without ids PocketQA falls back to its
                // weakest selector. Every control below carries a tag, so this
                // one line is what makes them addressable at 0.98 instead.
                Box(modifier = Modifier.semantics { testTagsAsResourceId = true }) {
                    DemoBankApp()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.host == "reset") Fixtures.apply(uri.getQueryParameter("fixture"))
    }
}

@Composable
fun DemoBankApp() {
    val nav = rememberNavController()
    var receipt by remember { mutableStateOf("") }

    NavHost(navController = nav, startDestination = "login") {
        composable("login") {
            LoginScreen(onUnlock = {
                nav.navigate("accounts") { popUpTo("login") { inclusive = true } }
            })
        }
        composable("accounts") {
            AccountsScreen(
                onTransfer = { nav.navigate("transfer") },
                onHistory = { nav.navigate("history") },
            )
        }
        composable("transfer") {
            TransferScreen(
                onBack = { nav.popBackStack() },
                onDone = { summary -> receipt = summary; nav.navigate("receipt") },
            )
        }
        composable("history") { HistoryScreen(onBack = { nav.popBackStack() }) }
        composable("receipt") {
            ReceiptScreen(summary = receipt, onDone = {
                nav.navigate("accounts") { popUpTo("accounts") { inclusive = true } }
            })
        }
    }
}
