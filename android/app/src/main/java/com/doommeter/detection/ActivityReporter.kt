package com.doommeter.detection

/**
 * Tells JavaScript that the AccessibilityService is still receiving events from a Platform app,
 * whatever they are. That is the only signal the health rules need to tell "the service stopped
 * responding" from "the user is watching something that is not a Short". Carries the Platform
 * and a time, never content.
 *
 * Accessibility events can arrive many times a second, so one report per Platform per
 * [intervalMs] is enough: the silence the rules look for is measured in minutes.
 */
class ActivityReporter(
    private val now: () -> Long,
    private val emit: (RawEvent) -> Unit,
    private val intervalMs: Long = DEFAULT_INTERVAL_MS,
) {
    private val lastReportedAt = HashMap<String, Long>()

    /** An accessibility event came from the app of [platform] (an engine Platform id). */
    fun onActivity(platform: String) {
        val at = now()
        val last = lastReportedAt[platform]
        if (last != null && at - last in 0 until intervalMs) return
        lastReportedAt[platform] = at
        emit(RawEvent(RawEvent.ACCESSIBILITY_ACTIVITY, platform, at))
    }

    companion object {
        const val DEFAULT_INTERVAL_MS = 60_000L
    }
}
