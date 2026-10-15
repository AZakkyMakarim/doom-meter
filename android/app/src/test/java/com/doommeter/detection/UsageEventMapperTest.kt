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
    fun `a first look over a long window reports only the app that is still in the foreground`() {
        val events =
            UsageEventMapper.mapCurrentForeground(
                listOf(
                    UsageRecord("com.tt", true, 1_000),
                    UsageRecord("com.tt", false, 2_000),
                    UsageRecord("com.yt", true, 3_000),
                ),
                platforms,
            )
        assertEquals(
            listOf("usageForegroundStarted:youtube:3000"),
            events.map { "${it.type}:${it.platform}:${it.at}" },
        )
    }

    @Test
    fun `a first look reports the start of an app that has been in the foreground a long time`() {
        val events =
            UsageEventMapper.mapCurrentForeground(
                listOf(UsageRecord("com.tt", true, 5)),
                platforms,
            )
        assertEquals(listOf(5L), events.map { it.at })
        assertEquals(RawEvent.USAGE_FOREGROUND_STARTED, events.single().type)
    }

    @Test
    fun `a first look reports nothing when every Platform app has left, or none was seen`() {
        assertTrue(
            UsageEventMapper.mapCurrentForeground(
                    listOf(UsageRecord("com.tt", true, 1_000), UsageRecord("com.tt", false, 2_000)),
                    platforms,
                )
                .isEmpty(),
        )
        assertTrue(UsageEventMapper.mapCurrentForeground(emptyList(), platforms).isEmpty())
    }

    @Test
    fun `a first look settles records given out of order by their time`() {
        val events =
            UsageEventMapper.mapCurrentForeground(
                listOf(UsageRecord("com.tt", false, 2_000), UsageRecord("com.tt", true, 1_000)),
                platforms,
            )
        assertTrue(events.isEmpty())
    }

    @Test
    fun `the json carries the type, the Platform and the time, nothing else`() {
        val json =
            UsageEventMapper.map(listOf(UsageRecord("com.tt", true, 7)), platforms).single().toJson()
        assertEquals("{\"type\":\"usageForegroundStarted\",\"platform\":\"tiktok\",\"at\":7}", json)
    }
}
