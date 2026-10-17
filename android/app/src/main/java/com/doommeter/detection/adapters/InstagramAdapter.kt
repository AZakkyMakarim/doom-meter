package com.doommeter.detection.adapters

import com.doommeter.detection.NodeSnapshot
import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.SurfaceObservation

/**
 * Instagram Reels. Every Instagram-specific selector lives in this file, so an app update that
 * breaks detection is fixed here and nowhere else.
 *
 * Every route into the Reels feed (Reels tab, Explore, DMs, a feed post opened into Reels) lands
 * in the same vertical Reels viewer, so the surface is keyed on that viewer being on screen, not
 * on which tab is selected. Stories use a different viewer (`reel_viewer_*` ids) and are never
 * matched. Comments and a creator profile pause the surface.
 *
 * The adapter only reports what the UI is doing. It has no counting rules (no 5 second
 * threshold, no timers) and keeps nothing: text is matched against fixed labels or hashed into
 * an in-memory token, never stored or sent.
 *
 * The selectors are best-effort and unverified against a live Instagram build; see the manual
 * checks on ticket doom-meter-v9k.5.
 */
class InstagramAdapter : PlatformAdapter {
    override val platform = "instagram"

    override val packageNames = setOf(PACKAGE)

    override fun observe(root: NodeSnapshot): SurfaceObservation {
        val scan = Scan()
        scan.visit(root, inViewer = false)
        if (!scan.viewerVisible || scan.overlayOpen) return SurfaceObservation.INACTIVE
        return SurfaceObservation(surfaceActive = true, videoToken = scan.token())
    }

    /** One pass over the tree, collecting just what the rules above need. */
    private class Scan {
        var viewerVisible = false
        var overlayOpen = false
        private var hash = FNV_OFFSET
        private var hashed = 0

        fun visit(node: NodeSnapshot, inViewer: Boolean) {
            // Off-screen pager pages are not the video in focus.
            if (!node.isVisibleToUser) return

            val name = idName(node.viewId)
            val viewer = inViewer || name in VIEWER_IDS
            if (name in VIEWER_IDS) viewerVisible = true
            if (isOverlay(node, name)) overlayOpen = true
            if (viewer) absorb(node)

            for (child in node.children) visit(child, viewer)
        }

        /** Fold the node's stable, non-numeric text into the video token. */
        private fun absorb(node: NodeSnapshot) {
            if (node.className?.contains("EditText") == true) return
            val text = node.text?.trim() ?: return
            if (text.length < MIN_TOKEN_TEXT || NUMERIC.matches(text)) return
            // The Follow button flips while the same Reel plays; it must not look like a swipe.
            if (BUTTON_LABELS.any { it.equals(text, ignoreCase = true) }) return
            for (ch in text) hash = (hash xor ch.code.toLong()) * FNV_PRIME
            hash = (hash xor SEPARATOR) * FNV_PRIME
            hashed += 1
        }

        fun token(): Long? = if (hashed == 0) null else hash
    }

    companion object {
        const val PACKAGE = "com.instagram.android"

        /** The vertical Reels pager and its page container. Stories use `reel_viewer_*`. */
        private val VIEWER_IDS = setOf("clips_viewer_view_pager", "clips_video_container")

        /** Comments composer and thread, and the creator profile screen header. */
        private val OVERLAY_IDS =
            setOf(
                "layout_comment_thread_edittext",
                "comment_composer_parent",
                "comment_composer_text_view",
                "profile_header_container",
                "profile_tab_layout",
                "profile_header_actions_top_row",
            )

        /**
         * Sheet title and composer hint of the comments sheet (matched on text only). The bare
         * "Add comment..." is not here: the Explore and feed Reels viewers keep it as a persistent
         * bottom bar, so matching it would report those viewers as paused for good.
         */
        private val OVERLAY_TEXTS =
            listOf(
                Regex("^comments$", RegexOption.IGNORE_CASE),
                Regex("^add a comment.*", RegexOption.IGNORE_CASE),
            )

        private val BUTTON_LABELS = listOf("Follow", "Following", "Follow back", "Requested")

        /** Counts and timestamps change while a Reel plays; they must not look like a swipe. */
        private val NUMERIC = Regex("^[\\d.,:\\s]+[KMB]?$")

        private const val MIN_TOKEN_TEXT = 2
        private const val FNV_OFFSET = -3750763034362895579L
        private const val FNV_PRIME = 1099511628211L
        private const val SEPARATOR = 0x1FL

        /** `com.instagram.android:id/name` -> `name`; tolerates ids without a package prefix. */
        private fun idName(viewId: String?): String? = viewId?.substringAfterLast('/')

        private fun isOverlay(node: NodeSnapshot, name: String?): Boolean {
            if (name != null && name in OVERLAY_IDS) return true
            val text = node.text?.trim() ?: return false
            return OVERLAY_TEXTS.any { it.matches(text) }
        }
    }
}
