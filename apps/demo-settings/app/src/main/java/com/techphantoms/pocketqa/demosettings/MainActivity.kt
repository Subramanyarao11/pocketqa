package com.techphantoms.pocketqa.demosettings

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.techphantoms.pocketqa.demosettings.ui.*

class MainActivity : ComponentActivity() {
    @OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        setContent {
            var dark by remember { mutableStateOf(false) }
            MaterialTheme(colorScheme = if (dark) darkColorScheme() else lightColorScheme()) {
                Box(modifier = Modifier.semantics { testTagsAsResourceId = true }) {
                    DemoSettingsApp(dark = dark, onDarkChange = { dark = it })
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
        if (uri.host == "reset") SettingsStore.apply(uri.getQueryParameter("fixture"))
    }
}

@Composable
fun DemoSettingsApp(dark: Boolean, onDarkChange: (Boolean) -> Unit) {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = "root") {
        composable("root") {
            RootSettingsScreen(
                onOpenGroup = { group -> nav.navigate("group/$group") },
                onOpenAbout = { nav.navigate("about") },
            )
        }
        composable("group/{group}") { entry ->
            val group = entry.arguments?.getString("group").orEmpty()
            GroupScreen(
                group = group,
                dark = dark,
                onDarkChange = onDarkChange,
                onBack = { nav.popBackStack() },
                onOpenAdvanced = { nav.navigate("advanced/$group") },
            )
        }
        composable("advanced/{group}") { entry ->
            AdvancedScreen(
                group = entry.arguments?.getString("group").orEmpty(),
                onBack = { nav.popBackStack() },
            )
        }
        composable("about") { AboutScreen(onBack = { nav.popBackStack() }) }
    }
}
