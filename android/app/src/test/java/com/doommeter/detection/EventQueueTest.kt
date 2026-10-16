package com.doommeter.detection

import org.junit.Assert.assertEquals
import org.junit.Test

class EventQueueTest {
    private val delivered = mutableListOf<String>()
    private var accepting = true
    private val queue =
        EventQueue(maxBuffered = 3) { json ->
            if (accepting) delivered.add(json)
            accepting
        }

    @Test
    fun `events are delivered at once when the receiver accepts them`() {
        queue.offer("a")
        queue.offer("b")
        assertEquals(listOf("a", "b"), delivered)
        assertEquals(0, queue.pending)
    }

    @Test
    fun `events wait while the receiver refuses them, and then arrive in order`() {
        accepting = false
        queue.offer("a")
        queue.offer("b")
        assertEquals(emptyList<String>(), delivered)
        accepting = true
        queue.flush()
        assertEquals(listOf("a", "b"), delivered)
    }

    @Test
    fun `a later event never overtakes one that failed to send`() {
        accepting = false
        queue.offer("a")
        // The receiver is back before the next event arrives: "a" still goes first.
        accepting = true
        queue.offer("b")
        assertEquals(listOf("a", "b"), delivered)
    }

    @Test
    fun `a failure part way through keeps the rest in order for the next flush`() {
        var budget = 1
        val flaky =
            EventQueue(maxBuffered = 3) { json ->
                if (budget > 0) {
                    budget -= 1
                    delivered.add(json)
                    true
                } else {
                    false
                }
            }
        flaky.offer("x")
        flaky.offer("y")
        flaky.offer("z")
        assertEquals(listOf("x"), delivered)
        assertEquals(2, flaky.pending)
        budget = 5
        flaky.flush()
        assertEquals(listOf("x", "y", "z"), delivered)
    }

    @Test
    fun `the oldest events are dropped when the buffer is full`() {
        accepting = false
        listOf("a", "b", "c", "d").forEach(queue::offer)
        accepting = true
        queue.flush()
        assertEquals(listOf("b", "c", "d"), delivered)
    }
}
