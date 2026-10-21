package com.doommeter.widget

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Thin JS bridge for the Home widget: keeps the widget view model and redraws the widget. */
class DoomMeterWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun update(widgetJson: String) {
        try {
            val context = reactContext.applicationContext
            WidgetStore.save(context, widgetJson)
            DoomMeterWidgetProvider.refreshAll(context)
        } catch (e: Exception) {
            // A bad payload or a launcher hiccup must never take the app down.
            Log.w(NAME, "Could not update the widget", e)
        }
    }

    companion object {
        const val NAME = "DoomMeterWidget"
    }
}
