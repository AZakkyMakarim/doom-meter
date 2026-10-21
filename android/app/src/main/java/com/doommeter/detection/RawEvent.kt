package com.doommeter.detection

/**
 * A raw event for the Counting engine. Field names and values match `EngineEvent` in
 * `src/engine/types.ts`; `src/detection/rawEvent.ts` parses the JSON form. Carries timing and
 * Platform only, never content.
 */
data class RawEvent(
    val type: String,
    /** Engine Platform id, or null for screen events. */
    val platform: String? = null,
    /** Epoch milliseconds at which the thing happened. */
    val at: Long,
    /** On a focus gain: the feed is back on the video the user left (comments, creator profile). */
    val sameVideo: Boolean = false,
) {
    fun toJson(): String =
        buildString {
            append("{\"type\":\"").append(type).append('"')
            if (platform != null) append(",\"platform\":\"").append(platform).append('"')
            if (sameVideo) append(",\"sameVideo\":true")
            append(",\"at\":").append(at).append('}')
        }

    companion object {
        const val SURFACE_FOCUS_GAINED = "surfaceFocusGained"
        const val SURFACE_FOCUS_LOST = "surfaceFocusLost"
        const val VIDEO_CHANGED = "videoChanged"
        const val SCREEN_ON = "screenOn"
        const val SCREEN_OFF = "screenOff"
        const val USAGE_FOREGROUND_STARTED = "usageForegroundStarted"
        const val USAGE_FOREGROUND_ENDED = "usageForegroundEnded"
        const val ACCESSIBILITY_CONNECTED = "accessibilityConnected"
        /** The service received accessibility events from the app of [platform] (any events). */
        const val ACCESSIBILITY_ACTIVITY = "accessibilityActivity"
        /** The service went away; [platform] is the Platform app in the foreground, if any. */
        const val ACCESSIBILITY_DISCONNECTED = "accessibilityDisconnected"
    }
}
