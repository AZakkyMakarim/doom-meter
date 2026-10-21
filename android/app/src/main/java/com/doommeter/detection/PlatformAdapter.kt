package com.doommeter.detection

/**
 * What an adapter saw in one window of its Platform's app.
 *
 * @property surfaceActive the Short-form surface is visible with the main video in focus
 *   (CONTEXT.md: opening a creator profile makes it inactive; opening comments does not).
 * @property videoToken an opaque in-memory fingerprint of the video currently in focus, or null
 *   when it cannot be told. It is compared with the previous token to notice a swipe, never
 *   stored, logged or sent, and must not be reversible to titles or other content.
 */
data class SurfaceObservation(
    val surfaceActive: Boolean,
    val videoToken: Long? = null,
) {
    companion object {
        val INACTIVE = SurfaceObservation(surfaceActive = false)
    }
}

/**
 * One adapter per Platform. It translates a Platform app's UI into observations and knows nothing
 * about counting: no thresholds, no timers. The shared [SurfaceTracker] turns observations into
 * raw events, and the Counting engine (TypeScript) decides what counts.
 *
 * To add a Platform: implement this interface in `adapters/<Platform>Adapter.kt`, then return the
 * instance from that Platform's file in `registrations/` (see [AdapterRegistry]).
 */
interface PlatformAdapter {
    /** The engine Platform id: "instagram", "youtube", "tiktok" or "facebook". */
    val platform: String

    /** Android package names of the Platform's app (a Platform may ship under several). */
    val packageNames: Set<String>

    /** Pure function of the tree: no I/O, no state, no clock. */
    fun observe(root: NodeSnapshot): SurfaceObservation
}
