package com.doommeter.detection

/**
 * Turns adapter observations into raw events. Shared by every Platform; pure Kotlin so it can be
 * unit tested with fake adapters and a fake clock.
 *
 * It reports what happened (focus gained or lost, the video changed) and never decides what
 * counts: the Counting engine does. The one hint it gives is `sameVideo`, when the feed comes back
 * to the video it left inside the same app (a creator profile), so that video is not counted twice.
 *
 * A single "inactive" observation inside the same app is only tentative (a tree caught
 * mid-transition looks inactive), so focus is lost only when the next evaluation agrees. The
 * event is timestamped at the first inactive observation.
 */
class SurfaceTracker(
    private val adapters: List<PlatformAdapter>,
    private val now: () -> Long,
    /** Packages whose windows say nothing about the foreground app (system UI, our own pill). */
    private val ignoredPackages: Set<String>,
    private val emit: (RawEvent) -> Unit,
) {
    private var activePlatform: String? = null

    /**
     * The Platform whose app was last seen in the foreground, whether or not its feed is showing.
     * Lets the service say which Platform it lost when it is switched off mid-scroll.
     */
    var foregroundPlatform: String? = null
        private set
    private var lastToken: Long? = null

    /** Platform and video left when the surface went inactive inside its own app. */
    private var leftPlatform: String? = null
    private var leftToken: Long? = null
    private var inactiveSince: Long? = null

    /**
     * Evaluate the active window. [snapshot] is only called for a Platform app, so other apps'
     * UI is never read.
     *
     * @return true when the caller should evaluate again shortly to confirm a tentative loss.
     */
    fun onWindow(packageName: String?, snapshot: () -> NodeSnapshot?): Boolean {
        if (packageName == null || packageName in ignoredPackages) return false
        val adapter = adapters.firstOrNull { packageName in it.packageNames }
        if (adapter == null) {
            // Another app is in the foreground: the surface is gone for certain.
            foregroundPlatform = null
            leftPlatform = null
            loseFocus(now())
            return false
        }
        foregroundPlatform = adapter.platform
        if (leftPlatform != adapter.platform) leftPlatform = null
        val root = snapshot() ?: return false
        val observation = adapter.observe(root)
        val at = now()

        if (!observation.surfaceActive) {
            if (activePlatform != adapter.platform) return false
            val since = inactiveSince
            if (since == null) {
                inactiveSince = at
                return true
            }
            val token = lastToken
            loseFocus(since)
            leftPlatform = adapter.platform
            leftToken = token
            return false
        }

        inactiveSince = null
        if (activePlatform != adapter.platform) {
            loseFocus(at)
            val same = leftPlatform == adapter.platform && leftToken != null && leftToken == observation.videoToken
            leftPlatform = null
            activePlatform = adapter.platform
            lastToken = observation.videoToken
            emit(RawEvent(RawEvent.SURFACE_FOCUS_GAINED, adapter.platform, at, sameVideo = same))
            return false
        }
        val token = observation.videoToken
        val previous = lastToken
        if (token != null) {
            if (previous != null && token != previous) {
                emit(RawEvent(RawEvent.VIDEO_CHANGED, adapter.platform, at))
            }
            lastToken = token
        }
        return false
    }

    /** The service stopped or was interrupted: nothing can be watched any more. */
    fun reset() {
        leftPlatform = null
        loseFocus(now())
    }

    private fun loseFocus(at: Long) {
        val platform = activePlatform
        activePlatform = null
        lastToken = null
        inactiveSince = null
        if (platform != null) emit(RawEvent(RawEvent.SURFACE_FOCUS_LOST, platform, at))
    }
}
