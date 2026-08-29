package com.techphantoms.pocketqa.demobank.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.techphantoms.pocketqa.demobank.data.Fixtures

/**
 * Deliberately a *sensitive* screen.
 *
 * PocketQA must redact the PIN rather than record it, and must classify this
 * field as sensitive from the input type alone — no app cooperation. An app
 * that only ever shows benign text cannot test that at all.
 */
@Composable
fun LoginScreen(onUnlock: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val lockedOut = Fixtures.mode == "locked-out"

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp).testTag("login_screen"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Demo Bank", style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.testTag("login_title"))
        Spacer(Modifier.height(8.dp))
        Text("Enter your 4-digit PIN", style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.testTag("login_subtitle"))
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = pin,
            onValueChange = { if (it.length <= 4) { pin = it; error = null } },
            label = { Text("PIN") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            isError = error != null,
            modifier = Modifier.fillMaxWidth().testTag("pin_input"),
        )
        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error!!, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.testTag("login_error"))
        }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                when {
                    lockedOut -> error = "Account locked. Contact support."
                    pin == "1234" -> onUnlock()
                    else -> error = "Incorrect PIN. 2 attempts left."
                }
            },
            enabled = pin.length == 4,
            modifier = Modifier.fillMaxWidth().testTag("unlock_button"),
        ) { Text("Unlock") }

        Spacer(Modifier.height(12.dp))
        Text("Demo PIN: 1234", style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.testTag("login_hint"))
    }
}
