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
    fun `the Reels comments sheet composer hint pauses the surface`() {
        val sheet = NodeSnapshot(children = listOf(pager(reelPage("a", "b")), text("What do you think of this?")))
        assertFalse(adapter.observe(sheet).surfaceActive)
        // Closing the sheet removes the hint; the same Reel resumes with the same token.
        val closed = NodeSnapshot(children = listOf(pager(reelPage("a", "b"))))
        assertTrue(adapter.observe(closed).surfaceActive)
        assertEquals(adapter.observe(closed).videoToken, adapter.observe(closed).videoToken)
    }

    /** The quick-reaction row of the comments sheet; the emoji are exposed as text or as descriptions. */
    private fun emojiRow() =
        NodeSnapshot(
            children =
                listOf("❤️", "🙌", "🔥", "👏").map { text(it) } +
                    listOf("😢", "😍", "😮", "😂").map { NodeSnapshot(contentDescription = it) },
        )

    private fun sheetOver(vararg extra: NodeSnapshot) =
        NodeSnapshot(children = listOf(pager(reelPage("a", "b"))) + extra.toList() + tabBar())

    @Test
    fun `the comments sheet with the Join the conversation hint pauses the surface`() {
        assertFalse(adapter.observe(sheetOver(text("Join the conversation..."))).surfaceActive)
        assertFalse(adapter.observe(sheetOver(text("Join the conversation…"))).surfaceActive)
    }

    @Test
    fun `the comments sheet pauses the surface whatever its hint says`() {
        // Hint text varies by build; the emoji reaction row is language-independent.
        val unknownHint = text("Say something nice", className = "android.widget.EditText")
        assertFalse(adapter.observe(sheetOver(emojiRow(), unknownHint)).surfaceActive)
        // ...and the thread rows' ids alone are enough too.
        val rows = NodeSnapshot(viewId = id("row_comment_container"), children = listOf(text("nice reel")))
        assertFalse(adapter.observe(sheetOver(rows)).surfaceActive)
    }

    @Test
    fun `the Reel resumes with the same token once the comments sheet closes`() {
        val open = adapter.observe(sheetOver(emojiRow()))
        val before = adapter.observe(sheetOver())
        assertFalse(open.surfaceActive)
        assertTrue(before.surfaceActive)
        assertEquals(before.videoToken, adapter.observe(sheetOver()).videoToken)
    }

    @Test
    fun `a stray emoji in a caption or the persistent bar is not a comments sheet`() {
        val caption = NodeSnapshot(children = listOf(text("🔥"), NodeSnapshot(contentDescription = "😂")))
        assertTrue(adapter.observe(sheetOver(caption)).surfaceActive)
        val barWithEmoji = NodeSnapshot(children = listOf(standaloneViewer("comment_composer_parent", "android.widget.TextView"), caption))
        assertTrue(adapter.observe(barWithEmoji).surfaceActive)
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

    /** Explore / feed viewer: 'Reels' header with back arrow, pager, and a persistent bottom bar. */
    private fun standaloneViewer(barId: String, barClass: String) =
        NodeSnapshot(
            children =
                listOf(
                    NodeSnapshot(
                        viewId = id("action_bar"),
                        children =
                            listOf(
                                NodeSnapshot(contentDescription = "Back"),
                                text("Reels", id("action_bar_title")),
                            ),
                    ),
                    pager(reelPage("alice", "morning run")),
                    text("Add comment…", id(barId), className = barClass),
                ),
        )

    @Test
    fun `the persistent bar of the Explore and feed viewers is not a comments overlay whatever its id`() {
        for (barId in listOf("comment_composer_parent", "comment_composer_text_view", "layout_comment_thread_edittext")) {
            for (cls in listOf("android.widget.TextView", "android.widget.EditText")) {
                assertTrue("$barId/$cls", adapter.observe(standaloneViewer(barId, cls)).surfaceActive)
            }
        }
    }

    @Test
    fun `the viewer is recognised under any clips_viewer id, not only the pager`() {
        // No known pager or page-container id anywhere: only the prefix identifies the viewer.
        val tree =
            NodeSnapshot(
                viewId = id("clips_viewer_fragment_root"),
                children = listOf(text("alice", id("clips_author_username"))),
            )
        assertTrue(adapter.observe(tree).surfaceActive)
        assertNotNull(adapter.observe(tree).videoToken)
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
