package com.doommeter.detection

import org.junit.Assert.assertEquals
import org.junit.Test

class ActivityReporterTest {
    private var now = 1_000L
    private val events = mutableListOf<RawEvent>()
    private val reporter = ActivityReporter({ now }, { events.add(it) }, intervalMs = 60_000L)

    @Test
    fun `the first event of a Platform is reported at once, with its time`() {
        reporter.onActivity("youtube")
        assertEquals(1, events.size)
        assertEquals(RawEvent.ACCESSIBILITY_ACTIVITY, events[0].type)
        assertEquals("youtube", events[0].platform)
        assertEquals(1_000L, events[0].at)
    }

    @Test
    fun `a burst of events is reported once per interval`() {
        reporter.onActivity("youtube")
        now = 30_000L
        reporter.onActivity("youtube")
        now = 60_999L
        reporter.onActivity("youtube")
        assertEquals(1, events.size)
        now = 61_000L
        reporter.onActivity("youtube")
        assertEquals(2, events.size)
        assertEquals(61_000L, events[1].at)
    }

    @Test
    fun `each Platform is throttled on its own`() {
        reporter.onActivity("youtube")
        reporter.onActivity("tiktok")
        assertEquals(listOf("youtube", "tiktok"), events.map { it.platform })
    }

    @Test
    fun `the json form is what JavaScript parses`() {
        reporter.onActivity("instagram")
        assertEquals(
            "{\"type\":\"accessibilityActivity\",\"platform\":\"instagram\",\"at\":1000}",
            events[0].toJson(),
        )
    }
}
