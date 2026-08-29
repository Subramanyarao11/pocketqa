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
}
