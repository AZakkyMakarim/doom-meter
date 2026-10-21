package com.doommeter.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetDayTest {
    @Test
    fun `the saved numbers hold until the Day ends`() {
        assertFalse(WidgetDay.isOver(dayEndsAt = 1_000, now = 999))
        assertTrue(WidgetDay.isOver(dayEndsAt = 1_000, now = 1_000))
    }

    @Test
    fun `a Day that ended while the app was not running shows the empty state`() {
        assertTrue(WidgetDay.isOver(dayEndsAt = 1_000, now = 5_000))
    }

    @Test
    fun `the widget wakes up at the end of the Day, and not for a Day already over`() {
        assertEquals(1_000L, WidgetDay.nextRefreshAt(dayEndsAt = 1_000, now = 999))
        assertNull(WidgetDay.nextRefreshAt(dayEndsAt = 1_000, now = 1_000))
    }
}
