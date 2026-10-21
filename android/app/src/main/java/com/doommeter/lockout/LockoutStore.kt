package com.doommeter.lockout

import android.content.Context

/**
 * The device copy of the Lockout: the block screen view model JavaScript last sent, plus its end
 * time on its own so the AccessibilityService can check it cheaply on every window change. It
 * survives a restart, so a Lockout keeps blocking with the app closed.
 */
object LockoutStore {
    private const val FILE = "doommeter_lockout"
    private const val KEY_JSON = "viewModel"
    private const val KEY_ENDS_AT = "endsAt"

    fun save(context: Context, json: String, endsAt: Long) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_JSON, json)
            .putLong(KEY_ENDS_AT, endsAt)
            .apply()
    }

    fun endsAt(context: Context): Long =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getLong(KEY_ENDS_AT, LockoutGate.NONE)

    fun load(context: Context): String? =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_JSON, null)
}
