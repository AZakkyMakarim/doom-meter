package com.doommeter.detection

import com.doommeter.detection.adapters.FacebookAdapter
import com.doommeter.detection.registrations.FacebookRegistration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixture-based tests for the pure Facebook selector logic (no device, no Android classes). */
class FacebookAdapterTest {
    private val adapter = FacebookAdapter()

    private fun id(name: String) = "com.facebook.katana:id/$name"

    private fun text(
        value: String,
        viewId: String? = null,
        visible: Boolean = true,
        className: String = "android.widget.TextView",
    ) = NodeSnapshot(viewId = viewId, className = className, text = value, isVisibleToUser = visible)

    private fun reelPage(author: String, caption: String, likes: String = "1.2K") =
        NodeSnapshot(
            viewId = id("reels_viewer_page"),
            children =
                listOf(
                    text(author, id("reels_author_name")),
                    text(caption, id("reels_description")),
                    text(likes, id("reels_like_count")),
                    text("Follow", id("reels_follow_button")),
                ),
        )

    private fun pager(vararg pages: NodeSnapshot) =
        NodeSnapshot(viewId = id("reels_viewer_pager"), children = pages.toList())

    private fun tabBar(selected: String) =
        NodeSnapshot(
            viewId = id("tab_bar"),
            children =
                listOf("Home", "Reels", "Marketplace", "Notifications", "Menu").map {
                    NodeSnapshot(contentDescription = it, isSelected = it == selected)
                },
        )

    @Test
    fun `identifies the Facebook package and the engine platform`() {
        assertEquals("facebook", adapter.platform)
        assertTrue("com.facebook.katana" in adapter.packageNames)
        assertEquals("facebook", FacebookRegistration.adapter()?.platform)
    }

    @Test
    fun `is registered with the service`() {
        assertEquals("facebook", AdapterRegistry.platformByPackage["com.facebook.katana"])
    }

    @Test
    fun `the Reels tab is an active surface with a token`() {
        val obs = adapter.observe(NodeSnapshot(children = listOf(pager(reelPage("alice", "dance")), tabBar("Reels"))))
        assertTrue(obs.surfaceActive)
        assertNotNull(obs.videoToken)
    }

    @Test
    fun `a Reel opened from the home feed counts the same even with the Home tab selected`() {
        val fromFeed = NodeSnapshot(children = listOf(pager(reelPage("alice", "dance")), tabBar("Home")))
        assertTrue(adapter.observe(fromFeed).surfaceActive)
        val noTabBar = NodeSnapshot(children = listOf(pager(reelPage("alice", "dance"))))
        assertTrue(adapter.observe(noTabBar).surfaceActive)
    }

    @Test
    fun `home feed, Watch tab and long video are not surfaces`() {
        val feed =
            NodeSnapshot(children = listOf(text("alice", id("feed_story_header")), text("Like"), tabBar("Home")))
        assertFalse(adapter.observe(feed).surfaceActive)
        val watch =
            NodeSnapshot(
                children = listOf(NodeSnapshot(viewId = id("watch_feed_list"), children = listOf(text("A long video")))),
            )
        assertFalse(adapter.observe(watch).surfaceActive)
        val longVideo = NodeSnapshot(children = listOf(NodeSnapshot(viewId = id("video_player_view"))))
        assertFalse(adapter.observe(longVideo).surfaceActive)
    }

    @Test
    fun `Stories are not a surface`() {
        val story =
            NodeSnapshot(
                children =
                    listOf(
                        NodeSnapshot(viewId = id("story_viewer_root"), children = listOf(text("alice"))),
                        tabBar("Home"),
                    ),
            )
        assertFalse(adapter.observe(story).surfaceActive)
        // A Story viewer wins even if a Reels pager is still mounted beneath it.
        val over =
            NodeSnapshot(
                children = listOf(pager(reelPage("a", "b")), NodeSnapshot(viewId = id("story_viewer_root"))),
            )
        assertFalse(adapter.observe(over).surfaceActive)
    }

    @Test
    fun `an invisible viewer does not count`() {
        val hidden = NodeSnapshot(viewId = id("reels_viewer_pager"), isVisibleToUser = false)
        assertFalse(adapter.observe(NodeSnapshot(children = listOf(hidden))).surfaceActive)
    }

    @Test
    fun `an open comments sheet keeps the surface and the token`() {
        val closed = adapter.observe(NodeSnapshot(children = listOf(pager(reelPage("a", "bb")))))
        val sheet =
            NodeSnapshot(
                viewId = id("comments_sheet"),
                children = listOf(text("Comments"), text("Write a comment..."), text("nice one")),
            )
        val open = adapter.observe(NodeSnapshot(children = listOf(pager(reelPage("a", "bb")), sheet)))
        assertTrue(open.surfaceActive)
        assertEquals(closed.videoToken, open.videoToken)
    }

    @Test
    fun `a creator profile pauses the surface`() {
        val profile =
            NodeSnapshot(
                children = listOf(pager(reelPage("a", "b")), NodeSnapshot(viewId = id("profile_header_container"))),
            )
        assertFalse(adapter.observe(profile).surfaceActive)
    }

    @Test
    fun `token changes with the video but not with counts or the Follow button`() {
        fun tok(page: NodeSnapshot) = adapter.observe(NodeSnapshot(children = listOf(pager(page)))).videoToken
        assertNotEquals(tok(reelPage("alice", "dance")), tok(reelPage("bob", "cats")))
        assertEquals(tok(reelPage("alice", "dance", "1.2K")), tok(reelPage("alice", "dance", "1.3K")))
        val following =
            NodeSnapshot(
                viewId = id("reels_viewer_page"),
                children =
                    listOf(
                        text("alice", id("reels_author_name")),
                        text("dance", id("reels_description")),
                        text("Following", id("reels_follow_button")),
                    ),
            )
        assertEquals(tok(reelPage("alice", "dance")), tok(following))
    }

    @Test
    fun `off-screen pages and typed text never feed the token`() {
        val clean = NodeSnapshot(children = listOf(pager(reelPage("alice", "dance"))))
        val noisy =
            NodeSnapshot(
                children =
                    listOf(
                        pager(
                            reelPage("alice", "dance"),
                            NodeSnapshot(isVisibleToUser = false, children = listOf(text("@next"))),
                            text("private", className = "android.widget.EditText"),
                        ),
                        text("Some notification"),
                    ),
            )
        assertEquals(adapter.observe(clean).videoToken, adapter.observe(noisy).videoToken)
    }

    @Test
    fun `token is null when the viewer exposes no readable text`() {
        val obs = adapter.observe(NodeSnapshot(children = listOf(pager())))
        assertTrue(obs.surfaceActive)
        assertNull(obs.videoToken)
    }
}
