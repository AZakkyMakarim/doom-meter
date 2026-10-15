package com.doommeter.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageEventMapperTest {
    private val platforms = mapOf("com.tt" to "tiktok", "com.yt" to "youtube")

    @Test
    fun `a Platform app coming forward and leaving become started and ended events`() {
        val events =
            UsageEventMapper.map(
                listOf(UsageRecord("com.tt", true, 1_000), UsageRecord("com.tt", false, 9_000)),
                platforms,
            )
        assertEquals(
            listOf("usageForegroundStarted:tiktok:1000", "usageForegroundEnded:tiktok:9000"),
            events.map { "${it.type}:${it.platform}:${it.at}" },
        )
    }

    @Test
    fun `apps that are not a Platform are dropped`() {
        val events =
            UsageEventMapper.map(listOf(UsageRecord("com.maps", true, 1_000)), platforms)
        assertTrue(events.isEmpty())
    }

    @Test
    fun `events come out oldest first whatever order they arrive in`() {
        val events =
            UsageEventMapper.map(
                listOf(UsageRecord("com.yt", true, 5_000), UsageRecord("com.tt", false, 4_000)),
                platforms,
            )
        assertEquals(listOf(4_000L, 5_000L), events.map { it.at })
    }

    @Test
    fun `the json carries the type, the Platform and the time, nothing else`() {
        val json =
            UsageEventMapper.map(listOf(UsageRecord("com.tt", true, 7)), platforms).single().toJson()
        assertEquals("{\"type\":\"usageForegroundStarted\",\"platform\":\"tiktok\",\"at\":7}", json)
    }
}
