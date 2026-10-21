package com.doommeter.detection

import com.doommeter.detection.adapters.YouTubeAdapter
import com.doommeter.detection.registrations.YouTubeRegistration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixture-based tests for the pure YouTube Shorts selector logic (no device, no Android classes). */
class YouTubeAdapterTest {
    private val adapter = YouTubeAdapter()

    private fun id(name: String) = "com.google.android.youtube:id/$name"

    private fun text(value: String, visible: Boolean = true, viewId: String? = null) =
        NodeSnapshot(
            viewId = viewId,
            className = "android.widget.TextView",
            text = value,
            isVisibleToUser = visible,
        )

    private fun shortsPage(channel: String, caption: String, likes: String = "1.2M") =
        NodeSnapshot(
            viewId = id("reel_player_page_container"),
            children =
                listOf(
                    text(channel),
                    text(caption),
                    text(likes),
                    text("Subscribe"),
                    text("Remix"),
                ),
        )

    private fun pager(vararg pages: NodeSnapshot) =
        NodeSnapshot(viewId = id("reel_recycler"), children = pages.toList())

    private fun shortsFeed(page: NodeSnapshot) =
        NodeSnapshot(children = listOf(pager(page), text("Home"), text("Subscriptions")))

    private fun homeFeed() =
        NodeSnapshot(
            children =
                listOf(
                    NodeSnapshot(
                        viewId = id("results"),
                        children = listOf(text("Some long video title"), text("Shorts")),
                    ),
                    text("Home"),
                ),
        )

    private fun longVideo() =
        NodeSnapshot(
            children =
                listOf(
                    NodeSnapshot(viewId = id("watch_player"), children = listOf(text("0:12 / 14:30"))),
                    text("Some long video title"),
                ),
        )

    @Test
    fun `identifies the YouTube package and the engine platform`() {
        assertEquals("youtube", adapter.platform)
        assertTrue("com.google.android.youtube" in adapter.packageNames)
    }

    @Test
    fun `is registered`() {
        assertTrue(YouTubeRegistration.adapter() is YouTubeAdapter)
    }

    @Test
    fun `the Shorts pager is an active surface`() {
        val obs = adapter.observe(shortsFeed(shortsPage("@alice", "morning run")))
        assertTrue(obs.surfaceActive)
        assertNotNull(obs.videoToken)
    }

    @Test
    fun `the home feed is not a surface`() {
        assertFalse(adapter.observe(homeFeed()).surfaceActive)
    }

    @Test
    fun `a Shorts shelf on the home feed is not a surface`() {
        val shelf =
            NodeSnapshot(
                children =
                    listOf(
                        NodeSnapshot(
                            viewId = id("reel_shelf"),
                            children = listOf(text("Shorts"), text("A clip")),
                        ),
                    ),
            )
        assertFalse(adapter.observe(shelf).surfaceActive)
    }

    @Test
    fun `a regular or long video is not a surface`() {
        val obs = adapter.observe(longVideo())
        assertFalse(obs.surfaceActive)
        assertNull(obs.videoToken)
    }

    @Test
    fun `an off-screen Shorts pager is not a surface`() {
        val hidden =
            NodeSnapshot(
                children =
                    listOf(
                        NodeSnapshot(
                            viewId = id("reel_recycler"),
                            isVisibleToUser = false,
                            children = listOf(shortsPage("@a", "b")),
                        ),
                        longVideo(),
                    ),
            )
        assertFalse(adapter.observe(hidden).surfaceActive)
    }

    @Test
    fun `an open comments sheet does not leave the surface`() {
        val feed = shortsFeed(shortsPage("@a", "b"))
        val closed = adapter.observe(feed)
        for (sheet in listOf(text("Comments"), text("Add a comment..."), NodeSnapshot(viewId = id("engagement_panel_container")))) {
            val open = adapter.observe(NodeSnapshot(children = listOf(feed, sheet)))
            assertTrue(open.surfaceActive)
            assertEquals(closed.videoToken, open.videoToken)
        }
    }

    @Test
    fun `the comment button count does not pause the surface`() {
        val page =
            NodeSnapshot(
                viewId = id("reel_player_page_container"),
                children =
                    listOf(
                        text("@a"),
                        text("a caption"),
                        NodeSnapshot(contentDescription = "View 1.2K comments", text = "1.2K"),
                    ),
            )
        assertTrue(adapter.observe(shortsFeed(page)).surfaceActive)
    }

    @Test
    fun `a channel profile pauses the surface`() {
        val profile = NodeSnapshot(viewId = id("channel_header"))
        val root = NodeSnapshot(children = listOf(shortsFeed(shortsPage("@a", "b")), profile))
        assertFalse(adapter.observe(root).surfaceActive)
    }

    @Test
    fun `token changes when the video changes`() {
        val first = adapter.observe(shortsFeed(shortsPage("@alice", "morning run"))).videoToken
        val second = adapter.observe(shortsFeed(shortsPage("@bob", "cat video"))).videoToken
        assertNotEquals(first, second)
    }

    @Test
    fun `token is stable while counts and the subscribe button change`() {
        val a = adapter.observe(shortsFeed(shortsPage("@alice", "run", likes = "1.2M"))).videoToken
        val subscribed =
            NodeSnapshot(
                viewId = id("reel_player_page_container"),
                children =
                    listOf(
                        text("@alice"),
                        text("run"),
                        text("1.3M"),
                        text("Subscribed"),
                        text("Remix"),
                    ),
            )
        val b = adapter.observe(shortsFeed(subscribed)).videoToken
        assertEquals(a, b)
    }

    @Test
    fun `off-screen pager pages do not affect the token`() {
        val page = shortsPage("@alice", "run")
        val next = NodeSnapshot(isVisibleToUser = false, children = listOf(text("@next")))
        val withNext = NodeSnapshot(children = listOf(pager(page, next)))
        assertEquals(
            adapter.observe(shortsFeed(page)).videoToken,
            adapter.observe(withNext).videoToken,
        )
    }

    @Test
    fun `text outside the pager never feeds the token`() {
        val page = shortsPage("@a", "b")
        val withExtra = NodeSnapshot(children = listOf(pager(page), text("private search text")))
        assertEquals(
            adapter.observe(shortsFeed(page)).videoToken,
            adapter.observe(withExtra).videoToken,
        )
    }

    @Test
    fun `text the user is typing never feeds the token`() {
        val typing = NodeSnapshot(className = "android.widget.EditText", text = "private message")
        val page = shortsPage("@a", "b")
        val withTyping = NodeSnapshot(children = listOf(pager(page, typing)))
        assertEquals(
            adapter.observe(shortsFeed(page)).videoToken,
            adapter.observe(withTyping).videoToken,
        )
    }

    @Test
    fun `token is null when the pager has no readable text`() {
        val bare =
            NodeSnapshot(
                children =
                    listOf(pager(NodeSnapshot(viewId = id("reel_player_page_container")))),
            )
        val obs = adapter.observe(bare)
        assertTrue(obs.surfaceActive)
        assertNull(obs.videoToken)
    }
}
