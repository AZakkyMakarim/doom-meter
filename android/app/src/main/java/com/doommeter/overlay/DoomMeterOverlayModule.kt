package com.doommeter.overlay

import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Thin JS bridge for the Overlay pill. JavaScript owns every rule (the Counting engine and the
 * pill view model); this only forwards a JSON view model to the native view.
 */
class DoomMeterOverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val main = Handler(Looper.getMainLooper())
    private val pill = OverlayPill(reactContext.applicationContext)

    override fun getName(): String = NAME

    @ReactMethod
    fun hasPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun requestPermission() {
        val intent =
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactContext.packageName}"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    /** Draws the pill, or updates it when already shown. Without the permission it draws nothing. */
    @ReactMethod
    fun render(pillJson: String) {
        main.post {
            try {
                pill.render(PillModel.parse(pillJson))
            } catch (e: Exception) {
                // A bad payload or a refused window must never take the app down.
                Log.w(NAME, "Could not render the pill", e)
            }
        }
    }

    @ReactMethod
    fun hide() {
        main.post { pill.hide() }
    }

    override fun invalidate() {
        main.post { pill.hide() }
        super.invalidate()
    }

    companion object {
        const val NAME = "DoomMeterOverlay"
    }
}
