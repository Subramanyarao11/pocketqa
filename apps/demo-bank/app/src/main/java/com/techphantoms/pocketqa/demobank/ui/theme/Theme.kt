package com.techphantoms.pocketqa.demobank.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val scheme = lightColorScheme(
    primary = Color(0xFF1B4D3E),
    onPrimary = Color.White,
    secondary = Color(0xFF3A7D5C),
    background = Color(0xFFF7F9F8),
    surface = Color.White,
    error = Color(0xFFB3261E),
)

@Composable
fun DemoBankTheme(content: @Composable () -> Unit) =
    MaterialTheme(colorScheme = scheme, content = content)
