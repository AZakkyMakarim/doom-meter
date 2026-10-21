package com.doommeter.lockout

import com.doommeter.detection.AdapterRegistry

/**
 * The one decision the AccessibilityService makes about a foreground app during a Lockout
 * (ADR 0007): is it a Platform app (Lite apps included), and has the saved end time not passed yet.
 * Plain Kotlin so it can be tested on the JVM.
 */
object LockoutGate {
    /** Saved end time meaning "no Lockout". */
    const val NONE = 0L

    fun shouldBlock(packageName: String?, endsAt: Long, now: Long): Boolean =
        packageName != null &&
            endsAt != NONE &&
            now < endsAt &&
            AdapterRegistry.platformByPackage.containsKey(packageName)
}
