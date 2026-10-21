package com.doommeter.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SurfaceTrackerTest {
    /** A fake Platform whose observation the test sets directly. */
    private class FakeAdapter(
        override val platform: String,
        pkg: String,
    ) : PlatformAdapter {
        override val packageNames = setOf(pkg)
        var next = SurfaceObservation.INACTIVE

        override fun observe(root: NodeSnapshot) = next
    }

    private val tiktok = FakeAdapter("tiktok", "tt")
    private val youtube = FakeAdapter("youtube", "yt")
    private var now = 1_000L
    private val events = mutableListOf<RawEvent>()
    private val tracker =
        SurfaceTracker(listOf(tiktok, youtube), { now }, setOf("ignored")) { events.add(it) }

    private val root = NodeSnapshot()

    private fun at(time: Long, pkg: String?, block: () -> Unit = {}): Boolean {
        now = time
        block()
        return tracker.onWindow(pkg) { root }
    }

    private fun types() = events.map { it.type + ":" + it.platform }

    @Test
    fun `focus gained when the feed becomes active, with the observation time`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(2_000, "tt")
        assertEquals(listOf("surfaceFocusGained:tiktok"), types())
        assertEquals(2_000L, events[0].at)
    }

    @Test
    fun `a changed video token is a videoChanged, an unchanged one is not`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        at(2_000, "tt")
        assertEquals(1, events.size)
        tiktok.next = SurfaceObservation(true, 2)
        at(3_000, "tt")
        assertEquals("videoChanged:tiktok", types().last())
        assertEquals(3_000L, events.last().at)
    }

    @Test
    fun `an unreadable token never counts as a video change`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        tiktok.next = SurfaceObservation(true, null)
        at(2_000, "tt")
        tiktok.next = SurfaceObservation(true, 1)
        at(3_000, "tt")
        assertEquals(listOf("surfaceFocusGained:tiktok"), types())
    }

    @Test
    fun `focus is lost only when two inactive observations agree, stamped at the first`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        tiktok.next = SurfaceObservation.INACTIVE
        assertTrue(at(2_000, "tt"))
        assertEquals(1, events.size)
        assertFalse(at(2_300, "tt"))
        assertEquals("surfaceFocusLost:tiktok", types().last())
        assertEquals(2_000L, events.last().at)
    }

    @Test
    fun `a one-off inactive observation is forgiven`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        tiktok.next = SurfaceObservation.INACTIVE
        at(2_000, "tt")
        tiktok.next = SurfaceObservation(true, 1)
        at(2_300, "tt")
        assertEquals(listOf("surfaceFocusGained:tiktok"), types())
    }

    @Test
    fun `leaving for another app loses focus at once`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        assertFalse(at(2_000, "com.whatsapp"))
        assertEquals("surfaceFocusLost:tiktok", types().last())
        assertEquals(2_000L, events.last().at)
    }

    @Test
    fun `ignored windows such as system UI do not change anything`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        at(2_000, "ignored")
        at(3_000, null)
        assertEquals(1, events.size)
    }

    @Test
    fun `switching Platforms loses the old surface before gaining the new one`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        youtube.next = SurfaceObservation(true, 7)
        at(2_000, "yt")
        assertEquals(
            listOf("surfaceFocusGained:tiktok", "surfaceFocusLost:tiktok", "surfaceFocusGained:youtube"),
            types(),
        )
    }

    @Test
    fun `an inactive Platform window that never had focus emits nothing`() {
        assertFalse(at(1_000, "tt"))
        assertTrue(events.isEmpty())
    }

    @Test
    fun `non-Platform apps are never snapshotted`() {
        var read = false
        tracker.onWindow("com.whatsapp") {
            read = true
            root
        }
        assertFalse(read)
    }

    @Test
    fun `reset loses an active surface and is silent otherwise`() {
        tracker.reset()
        assertTrue(events.isEmpty())
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        now = 5_000
        tracker.reset()
        assertEquals("surfaceFocusLost:tiktok", types().last())
    }

    private fun loseThenRegain(token: Long?) {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        tiktok.next = SurfaceObservation.INACTIVE
        at(2_000, "tt")
        at(2_300, "tt")
        tiktok.next = SurfaceObservation(true, token)
        at(9_000, "tt")
    }

    @Test
    fun `returning to the same video after a profile is flagged so it is not counted again`() {
        loseThenRegain(1)
        assertEquals("surfaceFocusGained:tiktok", types().last())
        assertTrue(events.last().sameVideo)
    }

    @Test
    fun `returning to a different or unreadable video is a fresh focus`() {
        loseThenRegain(2)
        assertFalse(events.last().sameVideo)
        events.clear()
        loseThenRegain(null)
        assertFalse(events.last().sameVideo)
    }

    @Test
    fun `coming back from another app is a fresh focus even on the same video`() {
        tiktok.next = SurfaceObservation(true, 1)
        at(1_000, "tt")
        at(2_000, "com.whatsapp")
        at(3_000, "tt")
        assertFalse(events.last().sameVideo)
    }

    @Test
    fun `raw events serialise to the JSON the TypeScript side parses`() {
        assertEquals(
            "{\"type\":\"videoChanged\",\"platform\":\"tiktok\",\"at\":5}",
            RawEvent("videoChanged", "tiktok", 5).toJson(),
        )
        assertEquals("{\"type\":\"screenOff\",\"at\":9}", RawEvent("screenOff", null, 9).toJson())
        assertEquals(
            "{\"type\":\"surfaceFocusGained\",\"platform\":\"tiktok\",\"sameVideo\":true,\"at\":5}",
            RawEvent("surfaceFocusGained", "tiktok", 5, sameVideo = true).toJson(),
        )
    }
}
