package com.doommeter.detection

import com.doommeter.detection.adapters.LiteAdapters
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixture tests for the Lite adapters (best-effort selectors; no device, no Android classes). */
class LiteAdaptersTest {
    private val byPackage = LiteAdapters.all().flatMap { a -> a.packageNames.map { it to a } }.toMap()

    private fun text(
        value: String,
        viewId: String? = null,
        selected: Boolean = false,
        className: String = "android.widget.TextView",
    ) = NodeSnapshot(viewId = viewId, className = className, text = value, isSelected = selected)

    // --- registration -------------------------------------------------------------------------

    @Test
    fun `Lite packages map to their parent Platform in the service registry`() {
        assertEquals("instagram", AdapterRegistry.platformByPackage["com.instagram.lite"])
        assertEquals("facebook", AdapterRegistry.platformByPackage["com.facebook.lite"])
        assertEquals("tiktok", AdapterRegistry.platformByPackage["com.zhiliaoapp.musically.go"])
        assertEquals("tiktok", AdapterRegistry.platformByPackage["com.ss.android.ugc.trill.go"])
    }

    @Test
    fun `main app packages still map to their own adapters`() {
        assertEquals("instagram", AdapterRegistry.platformByPackage["com.instagram.android"])
        assertEquals("facebook", AdapterRegistry.platformByPackage["com.facebook.katana"])
        assertEquals("tiktok", AdapterRegistry.platformByPackage["com.zhiliaoapp.musically"])
        assertEquals("tiktok", AdapterRegistry.platformByPackage["com.ss.android.ugc.trill"])
    }

    @Test
    fun `no package is claimed by two adapters`() {
        val all = AdapterRegistry.adapters.flatMap { it.packageNames }
        assertEquals(all.size, all.toSet().size)
    }

    // --- Instagram Lite and Facebook Lite (viewer ids) ----------------------------------------

    /** Package, viewer id, Story viewer id, creator profile id. */
    private data class Case(val pkg: String, val viewer: String, val story: String, val profile: String)

    private val cases =
        listOf(
            Case(LiteAdapters.INSTAGRAM_LITE, "clips_viewer_pager", "story_viewer_root", "profile_header_container"),
            Case(LiteAdapters.FACEBOOK_LITE, "reels_viewer_pager", "story_viewer_root", "timeline_header"),
        )

    private fun reel(c: Case, author: String, caption: String, likes: String = "1.2K") =
        NodeSnapshot(
            viewId = "${c.pkg}:id/${c.viewer}",
            children = listOf(text(author), text(caption), text(likes), text("Follow")),
        )

    @Test
    fun `a Reel in the viewer is an active surface with a token`() {
        for (c in cases) {
            val obs = byPackage.getValue(c.pkg).observe(NodeSnapshot(children = listOf(reel(c, "alice", "dance"))))
            assertTrue(c.pkg, obs.surfaceActive)
            assertNotNull(c.pkg, obs.videoToken)
        }
    }

    @Test
    fun `the home feed is not a surface`() {
        for (c in cases) {
            val feed = NodeSnapshot(children = listOf(text("alice", "${c.pkg}:id/feed_header"), text("Like")))
            assertFalse(c.pkg, byPackage.getValue(c.pkg).observe(feed).surfaceActive)
        }
    }

    @Test
    fun `a Story viewer or creator profile pauses the surface`() {
        for (c in cases) {
            val adapter = byPackage.getValue(c.pkg)
            val story = NodeSnapshot(children = listOf(reel(c, "a", "bb"), NodeSnapshot(viewId = "${c.pkg}:id/${c.story}")))
            assertFalse(c.pkg, adapter.observe(story).surfaceActive)
            val profile = NodeSnapshot(children = listOf(reel(c, "a", "bb"), NodeSnapshot(viewId = "${c.pkg}:id/${c.profile}")))
            assertFalse(c.pkg, adapter.observe(profile).surfaceActive)
        }
    }

    @Test
    fun `the token changes with the video but not with counts or the Follow button`() {
        for (c in cases) {
            val adapter = byPackage.getValue(c.pkg)

            fun tok(r: NodeSnapshot) = adapter.observe(NodeSnapshot(children = listOf(r))).videoToken
            assertNotEquals(c.pkg, tok(reel(c, "alice", "dance")), tok(reel(c, "bob", "cats")))
            assertEquals(c.pkg, tok(reel(c, "alice", "dance", "1.2K")), tok(reel(c, "alice", "dance", "1.3K")))
        }
    }

    @Test
    fun `invisible viewers, off-screen pages and typed text are ignored`() {
        for (c in cases) {
            val adapter = byPackage.getValue(c.pkg)
            val hidden = NodeSnapshot(viewId = "${c.pkg}:id/${c.viewer}", isVisibleToUser = false)
            assertFalse(c.pkg, adapter.observe(NodeSnapshot(children = listOf(hidden))).surfaceActive)
            val clean = NodeSnapshot(children = listOf(reel(c, "alice", "dance")))
            val noisy =
                NodeSnapshot(
                    viewId = "${c.pkg}:id/${c.viewer}",
                    children =
                        listOf(
                            text("alice"),
                            text("dance"),
                            NodeSnapshot(isVisibleToUser = false, children = listOf(text("@next"))),
                            text("private", className = "android.widget.EditText"),
                        ),
                )
            assertEquals(c.pkg, adapter.observe(clean).videoToken, adapter.observe(NodeSnapshot(children = listOf(noisy))).videoToken)
        }
    }

    @Test
    fun `a viewer with no readable text has no token`() {
        for (c in cases) {
            val bare = NodeSnapshot(children = listOf(NodeSnapshot(viewId = "${c.pkg}:id/${c.viewer}")))
            val obs = byPackage.getValue(c.pkg).observe(bare)
            assertTrue(c.pkg, obs.surfaceActive)
            assertNull(c.pkg, obs.videoToken)
        }
    }

    // --- TikTok Lite (labels) ------------------------------------------------------------------

    private fun tiktokFeed(vararg body: String) =
        NodeSnapshot(children = listOf(text("Following"), text("For You", selected = true)) + body.map { text(it) })

    @Test
    fun `TikTok Lite shows a surface in the For You feed and none elsewhere`() {
        for (pkg in listOf(LiteAdapters.TIKTOK_LITE_GLOBAL, LiteAdapters.TIKTOK_LITE_ASIA)) {
            val adapter = byPackage.getValue(pkg)
            assertEquals("tiktok", adapter.platform)
            val a = adapter.observe(tiktokFeed("alice", "dance"))
            assertTrue(a.surfaceActive)
            assertNotEquals(a.videoToken, adapter.observe(tiktokFeed("bob", "cats")).videoToken)
            assertFalse(adapter.observe(NodeSnapshot(children = listOf(text("Rewards"), text("Home")))).surfaceActive)
        }
    }
}
