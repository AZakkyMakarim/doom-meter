package com.doommeter.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SurfaceTrackerForegroundTest {
    private class FakeAdapter(
        override val platform: String,
        pkg: String,
    ) : PlatformAdapter {
        override val packageNames = setOf(pkg)
        var next = SurfaceObservation.INACTIVE

        override fun observe(root: NodeSnapshot) = next
    }

    private val tiktok = FakeAdapter("tiktok", "tt")
    private val tracker = SurfaceTracker(listOf(tiktok), { 1_000L }, setOf("ignored")) {}

    @Test
    fun `knows nothing before any window is seen`() {
        assertNull(tracker.foregroundPlatform)
    }

    @Test
    fun `names the Platform app in the foreground even when its feed is not showing`() {
        tracker.onWindow("tt") { NodeSnapshot() }
        assertEquals("tiktok", tracker.foregroundPlatform)
    }

    @Test
    fun `forgets it once another app is in the foreground, but not for ignored windows`() {
        tracker.onWindow("tt") { NodeSnapshot() }
        tracker.onWindow("ignored") { NodeSnapshot() }
        assertEquals("tiktok", tracker.foregroundPlatform)

        tracker.onWindow("com.maps") { NodeSnapshot() }
        assertNull(tracker.foregroundPlatform)
    }
}
