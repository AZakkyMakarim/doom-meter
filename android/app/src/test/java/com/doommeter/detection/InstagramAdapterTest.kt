package com.doommeter.detection

import com.doommeter.detection.adapters.InstagramAdapter
import com.doommeter.detection.registrations.InstagramRegistration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixture-based tests for the pure Instagram selector logic (no device, no Android classes). */
class InstagramAdapterTest {
    private val adapter = InstagramAdapter()

    private fun id(name: String) = "com.instagram.android:id/$name"

    private fun text(
        value: String,
        viewId: String? = null,
        visible: Boolean = true,
        className: String = "android.widget.TextView",
    ) = NodeSnapshot(viewId = viewId, className = className, text = value, isVisibleToUser = visible)

    /** One Reel page inside the vertical pager: author, caption and a ticking like count. */
    private fun reelPage(author: String, caption: String, likes: String = "12.3K") =
        NodeSnapshot(
            viewId = id("clips_video_container"),
            children =
                listOf(
                    text(author, id("clips_author_username")),
                    text(caption, id("clips_caption_component")),
                    text(likes, id("like_count")),
                    text("Follow", id("clips_follow_button")),
                ),
        )

    private fun pager(vararg pages: NodeSnapshot) =
        NodeSnapshot(viewId = id("clips_viewer_view_pager"), children = pages.toList())

    private fun tabBar(selected: String = "Reels") =
        NodeSnapshot(
            viewId = id("tab_bar"),
            children =
                listOf("Home", "Reels", "Messages", "Search and explore", "Profile").map {
                    NodeSnapshot(contentDescription = it, isSelected = it == selected)
                },
        )

    /** The Reels tab: pager plus the bottom tab bar. */
    private fun reelsTab(page: NodeSnapshot = reelPage("alice", "morning run")) =
        NodeSnapshot(children = listOf(pager(page), tabBar()))

    @Test
    fun `identifies the Instagram package and the engine platform`() {
        assertEquals("instagram", adapter.platform)
        assertTrue("com.instagram.android" in adapter.packageNames)
    }

    @Test
    fun `is registered for the Instagram platform`() {
        assertEquals("instagram", InstagramRegistration.adapter()?.platform)
    }

    @Test
    fun `Reels tab is an active surface`() {
        val obs = adapter.observe(reelsTab())
        assertTrue(obs.surfaceActive)
        assertNotNull(obs.videoToken)
    }

    @Test
    fun `Reels opened from Explore, a DM or a feed post count the same`() {
        // These routes show the same viewer; DMs and Explore hide the bottom tab bar.
        val withoutTabBar = NodeSnapshot(children = listOf(pager(reelPage("a", "b"))))
        assertTrue(adapter.observe(withoutTabBar).surfaceActive)
        // Feed post opened into the Reels feed keeps the Home tab selected.
        val fromFeed = NodeSnapshot(children = listOf(pager(reelPage("a", "b")), tabBar("Home")))
        assertTrue(adapter.observe(fromFeed).surfaceActive)
        val fromExplore =
            NodeSnapshot(children = listOf(pager(reelPage("a", "b")), tabBar("Search and explore")))
        assertTrue(adapter.observe(fromExplore).surfaceActive)
    }

    @Test
    fun `the viewer id is matched even when the app prefixes differ`() {
        val node = NodeSnapshot(viewId = "clips_viewer_view_pager", children = listOf(reelPage("a", "b")))
        assertTrue(adapter.observe(node).surfaceActive)
    }

    @Test
    fun `Home feed, Explore grid and DM inbox are not surfaces`() {
        val feed =
            NodeSnapshot(
                children =
                    listOf(
                        text("alice", id("row_feed_photo_profile_name")),
                        text("Liked by bob", id("row_feed_textview_likes")),
                        tabBar("Home"),
                    ),
            )
        assertFalse(adapter.observe(feed).surfaceActive)
        // Reel thumbnails in the grid mention "Reel by ..." but are not the swipe feed.
        val explore =
            NodeSnapshot(
                children =
                    listOf(
                        NodeSnapshot(
                            viewId = id("image_button"),
                            contentDescription = "Reel by alice at row 1, column 2",
                        ),
                        tabBar("Search and explore"),
                    ),
            )
        assertFalse(adapter.observe(explore).surfaceActive)
        val dm = NodeSnapshot(children = listOf(text("Messages", id("title_text")), text("bob")))
        assertFalse(adapter.observe(dm).surfaceActive)
    }

    @Test
    fun `Stories are not a surface even with the Reels tab bar around`() {
        val stories =
            NodeSnapshot(
                children =
                    listOf(
                        NodeSnapshot(viewId = id("reel_viewer_texture_view")),
                        text("alice", id("reel_viewer_title")),
                        NodeSnapshot(viewId = id("reel_viewer_progress_bar")),
                    ),
            )
        assertFalse(adapter.observe(stories).surfaceActive)
    }

    @Test
    fun `an invisible viewer does not count`() {
        val hidden = NodeSnapshot(viewId = id("clips_viewer_view_pager"), isVisibleToUser = false)
        assertFalse(adapter.observe(NodeSnapshot(children = listOf(hidden, tabBar()))).surfaceActive)
    }

    @Test
    fun `an open comments sheet pauses the surface`() {
        val byComposer =
            NodeSnapshot(
                children =
                    listOf(
                        pager(reelPage("a", "b")),
                        NodeSnapshot(viewId = id("layout_comment_thread_edittext")),
                    ),
            )
        assertFalse(adapter.observe(byComposer).surfaceActive)
        val byTitle = NodeSnapshot(children = listOf(pager(reelPage("a", "b")), text("Comments")))
        assertFalse(adapter.observe(byTitle).surfaceActive)
        val byHint =
            NodeSnapshot(children = listOf(pager(reelPage("a", "b")), text("Add a comment for alice...")))
        assertFalse(adapter.observe(byHint).surfaceActive)
    }

    @Test
    fun `the persistent Add comment bar of the Explore and feed viewers does not pause the surface`() {
        val bar = text("Add comment…", id("comment_composer_hint"))
        val fromExplore =
            NodeSnapshot(children = listOf(pager(reelPage("a", "b")), bar, tabBar("Search and explore")))
        assertTrue(adapter.observe(fromExplore).surfaceActive)
        val fromFeed = NodeSnapshot(children = listOf(pager(reelPage("a", "b")), bar, tabBar("Home")))
        assertTrue(adapter.observe(fromFeed).surfaceActive)
    }

    @Test
    fun `the Comment button on the rail does not pause the surface`() {
        val rail =
            NodeSnapshot(
                viewId = id("clips_ufi_component"),
                children =
                    listOf(
                        NodeSnapshot(contentDescription = "Comment"),
                        NodeSnapshot(contentDescription = "Comment number is 1,204"),
                        text("1,204", id("comment_count")),
                    ),
            )
        val tree = NodeSnapshot(children = listOf(pager(reelPage("a", "b"), rail), tabBar()))
        assertTrue(adapter.observe(tree).surfaceActive)
    }

    @Test
    fun `a creator profile pauses the surface`() {
        val profileOverViewer =
            NodeSnapshot(
                children =
                    listOf(
                        pager(reelPage("a", "b")),
                        NodeSnapshot(viewId = id("profile_header_container")),
                    ),
            )
        assertFalse(adapter.observe(profileOverViewer).surfaceActive)
        // Without a viewer the profile is simply not a surface.
        val profileOnly =
            NodeSnapshot(
                children = listOf(NodeSnapshot(viewId = id("profile_header_container")), tabBar("Profile")),
            )
        assertFalse(adapter.observe(profileOnly).surfaceActive)
    }

    @Test
    fun `token changes when the video changes`() {
        val first = adapter.observe(reelsTab(reelPage("alice", "morning run"))).videoToken
        val second = adapter.observe(reelsTab(reelPage("bob", "cat video"))).videoToken
        assertNotEquals(first, second)
    }

    @Test
    fun `token is stable while like counts tick and the Follow button flips`() {
        val a = adapter.observe(reelsTab(reelPage("alice", "run", likes = "12.3K"))).videoToken
        val b = adapter.observe(reelsTab(reelPage("alice", "run", likes = "12.4K"))).videoToken
        assertEquals(a, b)
        val followed =
            NodeSnapshot(
                viewId = id("clips_video_container"),
                children =
                    listOf(
                        text("alice", id("clips_author_username")),
                        text("run", id("clips_caption_component")),
                        text("Following", id("clips_follow_button")),
                    ),
            )
        assertEquals(a, adapter.observe(reelsTab(followed)).videoToken)
    }

    @Test
    fun `off-screen pager pages do not affect the token`() {
        val next = NodeSnapshot(isVisibleToUser = false, children = listOf(text("@next")))
        val without = NodeSnapshot(children = listOf(pager(reelPage("alice", "run"))))
        val withNext = NodeSnapshot(children = listOf(pager(reelPage("alice", "run"), next)))
        assertEquals(adapter.observe(without).videoToken, adapter.observe(withNext).videoToken)
    }

    @Test
    fun `text outside the viewer and typed text never feed the token`() {
        val typing = text("private message", className = "android.widget.EditText")
        val clean = NodeSnapshot(children = listOf(pager(reelPage("a", "bb"))))
        val noisy =
            NodeSnapshot(children = listOf(pager(reelPage("a", "bb"), typing), text("Some notification")))
        assertEquals(adapter.observe(clean).videoToken, adapter.observe(noisy).videoToken)
    }

    @Test
    fun `token is null when the viewer exposes no readable text`() {
        val obs = adapter.observe(NodeSnapshot(children = listOf(pager())))
        assertTrue(obs.surfaceActive)
        assertNull(obs.videoToken)
    }

    @Test
    fun `registration returns the same kind of adapter`() {
        assertSame(InstagramRegistration.adapter()?.javaClass, InstagramAdapter::class.java)
    }
}
