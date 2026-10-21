package com.doommeter.widget

import android.content.Context

/**
 * The device copy of today's numbers: the widget view model JavaScript last sent, kept as
 * JSON in SharedPreferences. It survives a restart, and any native surface that needs today's
 * totals (the widget now, the lock screen later) reads it from here.
 */
object WidgetStore {
    private const val FILE = "doommeter_widget"
    private const val KEY = "viewModel"

    fun save(context: Context, json: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    fun load(context: Context): String? =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null)
}
