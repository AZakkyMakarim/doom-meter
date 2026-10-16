package com.doommeter.insets

import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Reports the system window insets (status bar, camera cutout, navigation or gesture bar)
 * in dp so the edge-to-edge screens can keep content clear of them (MASTER 8). It only
 * reads; how the numbers are used lives in src/design/safeArea.ts.
 */
class DoomMeterInsetsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getInsets(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val decor = reactContext.currentActivity?.window?.decorView
                val compat = decor?.let { ViewCompat.getRootWindowInsets(it) }
                val map = Arguments.createMap()
                if (compat == null) {
                    // Not attached yet; zeros tell JavaScript to fall back to the status bar height.
                    listOf("top", "bottom", "left", "right").forEach { map.putDouble(it, 0.0) }
                } else {
                    val insets =
                        compat.getInsetsIgnoringVisibility(
                            WindowInsetsCompat.Type.systemBars() or
                                WindowInsetsCompat.Type.displayCutout(),
                        )
                    val density = reactContext.resources.displayMetrics.density
                    map.putDouble("top", insets.top / density.toDouble())
                    map.putDouble("bottom", insets.bottom / density.toDouble())
                    map.putDouble("left", insets.left / density.toDouble())
                    map.putDouble("right", insets.right / density.toDouble())
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("INSETS_UNAVAILABLE", e)
            }
        }
    }

    companion object {
        const val NAME = "DoomMeterInsets"
    }
}
