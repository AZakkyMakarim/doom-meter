package com.doommeter.detection

import android.app.Application
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactContext

/**
 * Carries raw events from the AccessibilityService to JavaScript, where the Counting engine
 * lives. Events raised before JavaScript is listening (the service woke a cold app process) wait
 * in a small bounded buffer and are flushed when JavaScript calls ready().
 */
object DetectionHub {
    const val EVENT_NAME = "DoomMeterRawEvent"
    private const val TAG = "DoomMeterDetection"
    private const val MAX_BUFFERED = 200

    private val lock = Any()
    private val buffer = ArrayDeque<String>()
    private var context: ReactContext? = null

    fun emit(event: RawEvent) {
        val json = event.toJson()
        synchronized(lock) {
            val target = context
            if (target == null || !send(target, json)) {
                if (buffer.size >= MAX_BUFFERED) buffer.removeFirst()
                buffer.addLast(json)
            }
        }
    }

    /** JavaScript is listening: flush anything that arrived earlier and send the rest live. */
    fun markReady(reactContext: ReactContext) {
        synchronized(lock) {
            context = reactContext
            while (buffer.isNotEmpty()) {
                if (!send(reactContext, buffer.first())) break
                buffer.removeFirst()
            }
        }
    }

    /** The React context is going away (reload or shutdown); events buffer until the next ready(). */
    fun detach(reactContext: ReactContext) {
        synchronized(lock) {
            if (context === reactContext) context = null
        }
    }

    /** Starts the React runtime if the process was woken without a screen, so JS can listen. */
    fun ensureReact(application: Application) {
        val host = (application as? ReactApplication)?.reactHost ?: return
        if (host.currentReactContext == null) host.start()
    }

    private fun send(target: ReactContext, json: String): Boolean =
        try {
            target.emitDeviceEvent(EVENT_NAME, json)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Could not deliver a raw event", e)
            false
        }
}
