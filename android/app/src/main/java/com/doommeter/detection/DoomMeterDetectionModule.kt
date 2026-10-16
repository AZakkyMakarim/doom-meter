package com.doommeter.detection

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Thin JS bridge for detection. Raw events flow native to JavaScript through [DetectionHub];
 * this module only exposes the permission, lifecycle and ready handshake.
 */
class DoomMeterDetectionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val usageSource by lazy {
        UsageForegroundSource(reactContext, AdapterRegistry.platformByPackage)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        val enabled =
            Settings.Secure.getInt(
                reactContext.contentResolver,
                Settings.Secure.ACCESSIBILITY_ENABLED,
                0,
            ) == 1
        val list =
            Settings.Secure.getString(
                reactContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ) ?: ""
        val ours = ComponentName(reactContext, DoomMeterAccessibilityService::class.java)
        val listed =
            list.split(':').any {
                ComponentName.unflattenFromString(it) == ours
            }
        promise.resolve(enabled && listed)
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        reactContext.startActivity(
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** JavaScript is listening for raw events; flush what arrived while it was starting. */
    @ReactMethod
    fun ready() {
        DetectionHub.markReady(reactContext)
    }

    /**
     * Foreground changes of the Platform apps since the last call, as raw event JSON, oldest
     * first. Empty unless Usage Access is granted. JavaScript polls this; the engine uses the
     * time only while video detection is failing.
     */
    @ReactMethod
    fun pollUsageEvents(promise: Promise) {
        val events = Arguments.createArray()
        try {
            usageSource.poll().forEach { events.pushString(it.toJson()) }
        } catch (e: Exception) {
            // A failed read is just a quiet poll; the next one tries again.
            Log.w(NAME, "Could not read UsageStats", e)
        }
        promise.resolve(events)
    }

    @ReactMethod
    fun startForegroundService() {
        try {
            val intent = Intent(reactContext, DetectionForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= 26) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            // The system can refuse a start from the background; detection still works without it.
            Log.w(NAME, "Could not start the foreground service", e)
        }
    }

    @ReactMethod
    fun stopForegroundService() {
        reactContext.stopService(Intent(reactContext, DetectionForegroundService::class.java))
    }

    override fun invalidate() {
        DetectionHub.detach(reactContext)
        super.invalidate()
    }

    companion object {
        const val NAME = "DoomMeterDetection"
    }
}
