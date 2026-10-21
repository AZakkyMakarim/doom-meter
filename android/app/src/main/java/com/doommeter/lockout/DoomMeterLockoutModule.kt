package com.doommeter.lockout

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

/** Thin JS bridge for the block screen: keeps the Lockout view model where native can read it. */
class DoomMeterLockoutModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun update(lockoutJson: String) {
        try {
            // An inactive Lockout has no end time, which saves as "no Lockout".
            val endsAt = JSONObject(lockoutJson).optLong("endsAt", LockoutGate.NONE)
            LockoutStore.save(reactContext.applicationContext, lockoutJson, endsAt)
        } catch (e: Exception) {
            // A bad payload must never take the app down; the last good copy stays in force.
            Log.w(NAME, "Could not save the Lockout", e)
        }
    }

    companion object {
        const val NAME = "DoomMeterLockout"
    }
}
