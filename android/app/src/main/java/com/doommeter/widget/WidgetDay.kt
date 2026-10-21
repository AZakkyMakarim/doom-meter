package com.doommeter.widget

/**
 * The one rule native keeps about the Day: the saved numbers belong to a Day that ends at a
 * known time, and once it has passed with no new numbers from JavaScript (the app was not
 * running, or the phone was off) the widget shows the empty state instead of yesterday.
 */
object WidgetDay {
    fun isOver(dayEndsAt: Long, now: Long): Boolean = now >= dayEndsAt

    /** When to redraw so a new Day shows up without the app; null when the Day is already over. */
    fun nextRefreshAt(dayEndsAt: Long, now: Long): Long? = if (isOver(dayEndsAt, now)) null else dayEndsAt
}
