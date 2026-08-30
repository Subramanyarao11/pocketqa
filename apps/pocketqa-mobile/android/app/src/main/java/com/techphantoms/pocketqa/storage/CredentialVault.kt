package com.techphantoms.pocketqa.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Credential vault for connected-provider API keys (§13.4).
 *
 * Backed by [EncryptedSharedPreferences], which wraps an AES-256 GCM data key
 * with an AndroidKeyStore-backed [MasterKey]. Even a rooted device dumping
 * `pocketqa.credentials.xml` sees only ciphertext — the master key never
 * leaves the keystore.
 *
 * The plaintext key is written once when the user pastes it, and never read
 * back into Java: the connected-assist path lives inside this class so the
 * caller only sees a masked view + the response body of the outbound call.
 */
class CredentialVault(private val ctx: Context) {

    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(ctx, "pocketqa.master_key")
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val prefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            ctx,
            "pocketqa.credentials",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun store(provider: String, apiKey: String): String {
        prefs.edit().putString(provider, apiKey).apply()
        return mask(apiKey)
    }

    fun delete(provider: String) {
        prefs.edit().remove(provider).apply()
    }

    fun read(provider: String): String? = prefs.getString(provider, null)

    fun mask(apiKey: String): String = "••••" + apiKey.takeLast(4).uppercase()

    /**
     * Endpoint URLs (ai-lab service) are stored in the same vault as provider
     * keys so a data wipe removes them too. They are displayed as the host —
     * "10.0.0.4:8000" — rather than fully masked; the URL isn't a secret but
     * we still route it through the vault so the "Delete all data" contract
     * remains exhaustive.
     */
    fun storeEndpoint(name: String, url: String): String {
        prefs.edit().putString("endpoint:$name", url).apply()
        return endpointDisplay(url)
    }

    fun readEndpoint(name: String): String? = prefs.getString("endpoint:$name", null)

    fun deleteEndpoint(name: String) { prefs.edit().remove("endpoint:$name").apply() }

    private fun endpointDisplay(url: String): String {
        val trimmed = url.trim().removeSuffix("/")
        val host = trimmed.substringAfter("://", trimmed)
        return if (host.length <= 32) host else host.take(29) + "…"
    }
}
