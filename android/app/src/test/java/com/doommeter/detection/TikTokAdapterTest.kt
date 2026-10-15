package com.doommeter.detection

import com.doommeter.detection.adapters.TikTokAdapter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixture-based tests for the pure TikTok selector logic (no device, no Android classes). */
class TikTokAdapterTest {
    private val adapter = TikTokAdapter()

    private fun text(value: String, selected: Boolean = false, visible: Boolean = true) =
        NodeSnapshot(
            className = "android.widget.TextView",
            text = value,
            isSelected = selected,
            isVisibleToUser = visible,
        )

    private fun tabBar(selected: String = "For You", vararg extra: String) =
        NodeSnapshot(
            children =
                (listOf("Following", "For You") + extra).map { text(it, selected = it == selected) },
        )

    private fun videoPage(author: String, caption: String, likes: String = "1.2M") =
        NodeSnapshot(
            children = listOf(text(author), text(caption), text(likes), text("0:12")),
        )

    private fun feed(page: NodeSnapshot, bar: NodeSnapshot = tabBar()) =
        NodeSnapshot(children = listOf(bar, page, text("Home"), text("Profile")))

    @Test
    fun `identifies both TikTok packages and the engine platform`() {
        assertEquals("tiktok", adapter.platform)
        assertTrue("com.zhiliaoapp.musically" in adapter.packageNames)
        assertTrue("com.ss.android.ugc.trill" in adapter.packageNames)
    }

    @Test
    fun `For You feed is an active surface`() {
        val obs = adapter.observe(feed(videoPage("@alice", "morning run")))
        assertTrue(obs.surfaceActive)
        assertNotNull(obs.videoToken)
    }

    @Test
    fun `Following feed is an active surface`() {
        val obs = adapter.observe(feed(videoPage("@bob", "cat"), tabBar(selected = "Following")))
        assertTrue(obs.surfaceActive)
    }

    @Test
    fun `tab labels also match on content description`() {
        val bar =
            NodeSnapshot(
                children =
                    listOf(
                        NodeSnapshot(contentDescription = "Following"),
                        NodeSnapshot(contentDescription = "For you", isSelected = true),
                    ),
            )
        assertTrue(adapter.observe(feed(videoPage("@a", "b"), bar)).surfaceActive)
    }

    @Test
    fun `a profile or inbox screen without the top tabs is not a surface`() {
        val profile = NodeSnapshot(children = listOf(text("@alice"), text("Followers"), text("Home")))
        assertFalse(adapter.observe(profile).surfaceActive)
    }

    @Test
    fun `an open comments sheet pauses the surface`() {
        val withComments =
            NodeSnapshot(
                children =
                    listOf(
                        tabBar(),
                        videoPage("@a", "b"),
                        text("1,204 comments"),
                    ),
            )
        assertFalse(adapter.observe(withComments).surfaceActive)
        val withCommentBox =
            NodeSnapshot(children = listOf(tabBar(), videoPage("@a", "b"), text("Add comment...")))
        assertFalse(adapter.observe(withCommentBox).surfaceActive)
    }

    @Test
    fun `selected LIVE tab is not a swipe feed`() {
        val bar = tabBar(selected = "LIVE", "LIVE")
        assertFalse(adapter.observe(feed(videoPage("@a", "b"), bar)).surfaceActive)
    }

    @Test
    fun `a selected parent counts as selected for its tab label`() {
        val bar =
            NodeSnapshot(
                children =
                    listOf(
                        text("Following"),
                        text("For You"),
                        NodeSnapshot(isSelected = true, children = listOf(text("LIVE"))),
                    ),
            )
        assertFalse(adapter.observe(feed(videoPage("@a", "b"), bar)).surfaceActive)
    }

    @Test
    fun `token changes when the video changes`() {
        val first = adapter.observe(feed(videoPage("@alice", "morning run"))).videoToken
        val second = adapter.observe(feed(videoPage("@bob", "cat video"))).videoToken
        assertNotEquals(first, second)
    }

    @Test
    fun `token is stable while like counts and timestamps tick`() {
        val a = adapter.observe(feed(videoPage("@alice", "run", likes = "1.2M"))).videoToken
        val b = adapter.observe(feed(videoPage("@alice", "run", likes = "1.3M"))).videoToken
        assertEquals(a, b)
    }

    @Test
    fun `off-screen pager items do not affect the token`() {
        val page = videoPage("@alice", "run")
        val offscreen = NodeSnapshot(isVisibleToUser = false, children = listOf(text("@next")))
        val withNext = NodeSnapshot(children = listOf(tabBar(), page, offscreen))
        val without = NodeSnapshot(children = listOf(tabBar(), page))
        assertEquals(adapter.observe(without).videoToken, adapter.observe(withNext).videoToken)
    }

    @Test
    fun `text the user is typing never feeds the token`() {
        val typing =
            NodeSnapshot(className = "android.widget.EditText", text = "private message")
        val withTyping = NodeSnapshot(children = listOf(tabBar(), videoPage("@a", "b"), typing))
        val without = NodeSnapshot(children = listOf(tabBar(), videoPage("@a", "b")))
        assertEquals(adapter.observe(without).videoToken, adapter.observe(withTyping).videoToken)
    }

    @Test
    fun `token is null when the feed has no readable text`() {
        val obs = adapter.observe(NodeSnapshot(children = listOf(tabBar())))
        assertTrue(obs.surfaceActive)
        // Only the constant tab labels are present, so the token is still a stable value.
        assertNotNull(obs.videoToken)
        val bare =
            NodeSnapshot(
                children =
                    listOf(
                        NodeSnapshot(contentDescription = "Following"),
                        NodeSnapshot(contentDescription = "For You"),
                    ),
            )
        assertNull(adapter.observe(bare).videoToken)
    }
}
