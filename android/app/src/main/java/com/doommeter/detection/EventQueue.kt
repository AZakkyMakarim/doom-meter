package com.doommeter.detection

/**
 * Delivers events in the order they were offered. Anything that cannot be delivered waits in a
 * small bounded buffer, and while anything waits, later events join the back of it instead of
 * overtaking it. The oldest is dropped when the buffer is full.
 *
 * [deliver] returns false when the event could not be delivered (no listener yet, or the send
 * failed). Not thread safe: the caller synchronises.
 */
class EventQueue(
    private val maxBuffered: Int,
    private val deliver: (String) -> Boolean,
) {
    private val buffer = ArrayDeque<String>()

    /** Queue [json] behind anything already waiting, then deliver as much as possible. */
    fun offer(json: String) {
        if (buffer.size >= maxBuffered) buffer.removeFirst()
        buffer.addLast(json)
        flush()
    }

    /** Deliver waiting events oldest first, stopping at the first one that cannot be delivered. */
    fun flush() {
        while (buffer.isNotEmpty()) {
            if (!deliver(buffer.first())) return
            buffer.removeFirst()
        }
    }

    val pending: Int
        get() = buffer.size
}
