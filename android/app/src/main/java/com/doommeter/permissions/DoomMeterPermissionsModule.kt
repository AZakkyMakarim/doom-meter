package com.doommeter.permissions

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.doommeter.detection.DoomMeterAccessibilityService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Thin JS bridge for permission state. It only reads whether each permission is on and opens
 * the matching system settings screen; every rule about what is required lives in JavaScript
 * (src/permissions/permissionState.ts).
 */
class DoomMeterPermissionsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /** The current state of all four permissions in one round trip. */
    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val map = Arguments.createMap()
            map.putBoolean("accessibility", isAccessibilityEnabled())
            map.putBoolean("overlay", Settings.canDrawOverlays(reactContext))
            map.putBoolean("usageAccess", hasUsageAccess())
            map.putBoolean("notifications", NotificationManagerCompat.from(reactContext).areNotificationsEnabled())
            map.putBoolean("notificationsApplicable", Build.VERSION.SDK_INT >= 33)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PERMISSIONS_UNAVAILABLE", e)
        }
    }

    /** Opens the system screen where the user can fix [permission]; falls back to app details. */
    @ReactMethod
    fun openSettings(permission: String) {
        val intent =
            when (permission) {
                "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                "overlay" ->
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${reactContext.packageName}"),
                    )
                "usageAccess" ->
                    Intent(
                        Settings.ACTION_USAGE_ACCESS_SETTINGS,
                        Uri.parse("package:${reactContext.packageName}"),
                    )
                "notifications" ->
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
                else -> appDetails()
            }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            // Some devices lack a specific screen; the app details page always exists.
            Log.w(NAME, "Could not open settings for $permission", e)
            reactContext.startActivity(appDetails().addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    private fun appDetails(): Intent =
        Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${reactContext.packageName}"),
        )

    private fun isAccessibilityEnabled(): Boolean {
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
        return enabled && list.split(':').any { ComponentName.unflattenFromString(it) == ours }
    }

    @Suppress("DEPRECATION")
    private fun hasUsageAccess(): Boolean {
        val ops = reactContext.getSystemService(AppOpsManager::class.java) ?: return false
        val mode =
            if (Build.VERSION.SDK_INT >= 29) {
                ops.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactContext.packageName,
                )
            } else {
                ops.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactContext.packageName,
                )
            }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    companion object {
        const val NAME = "DoomMeterPermissions"
    }
}
