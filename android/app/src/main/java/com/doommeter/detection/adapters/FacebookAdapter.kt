package com.doommeter.detection.adapters

import com.doommeter.detection.NodeSnapshot
import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.SurfaceObservation

/**
 * Facebook Reels. Every Facebook-specific selector lives in this file, so an app update that
 * breaks detection is fixed here and nowhere else.
 *
 * Every route into the Reels feed (Reels tab, a Reels card in the home feed opened into the
 * viewer) lands in the same vertical Reels viewer, so the surface is keyed on that viewer being on
 * screen, not on which tab is selected. Stories, long videos and the Watch tab never match a
 * viewer id; a Story viewer on screen also forces the surface inactive. A creator profile pauses
 * the surface; the comments sheet does not.
 *
 * The adapter only reports what the UI is doing. It has no counting rules and keeps nothing:
 * text is matched against fixed labels or hashed into an in-memory token, never stored or sent.
 *
 * The selectors are best-effort and unverified against a live Facebook build (the app obfuscates
 * many ids); see the device checks on ticket doom-meter-0fn.4.
 */
class FacebookAdapter : PlatformAdapter {
    override val platform = "facebook"

    override val packageNames = setOf(PACKAGE)

    override fun observe(root: NodeSnapshot): SurfaceObservation {
        val scan = Scan()
        scan.visit(root, inViewer = false)
        if (!scan.viewerVisible || scan.profileOpen || scan.storyOpen) return SurfaceObservation.INACTIVE
        return SurfaceObservation(surfaceActive = true, videoToken = scan.token())
    }

    /** One pass over the tree, collecting just what the rules above need. */
    private class Scan {
        var viewerVisible = false
        var profileOpen = false
        var storyOpen = false
        private var hash = FNV_OFFSET
        private var hashed = 0

        fun visit(node: NodeSnapshot, inViewer: Boolean) {
            // Off-screen pager pages are not the video in focus.
            if (!node.isVisibleToUser) return

            val name = idName(node.viewId)
            val isViewer = name != null && VIEWER_ID_PREFIXES.any { name.startsWith(it) }
            val viewer = inViewer || isViewer
            if (isViewer) viewerVisible = true
            if (name != null && name in PROFILE_IDS) profileOpen = true
            if (name != null && STORY_ID_PREFIXES.any { name.startsWith(it) }) storyOpen = true
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
        const val PACKAGE = "com.facebook.katana"

        /** The vertical Reels pager and its pages. */
        private val VIEWER_ID_PREFIXES = listOf("reels_viewer", "fb_reels_viewer")

        /** Story viewers; a Story on top of a mounted Reels pager is not a Reels surface. */
        private val STORY_ID_PREFIXES = listOf("story_viewer", "stories_viewer")

        /** The creator profile screen header. */
        private val PROFILE_IDS = setOf("profile_header_container", "timeline_header")

        private val BUTTON_LABELS = listOf("Follow", "Following", "Join", "Joined")

        /** Counts and timestamps change while a Reel plays; they must not look like a swipe. */
        private val NUMERIC = Regex("^[\\d.,:\\s]+[KMB]?$")

        private const val MIN_TOKEN_TEXT = 2
        private const val FNV_OFFSET = -3750763034362895579L
        private const val FNV_PRIME = 1099511628211L
        private const val SEPARATOR = 0x1FL

        /** `com.facebook.katana:id/name` -> `name`; tolerates ids without a package prefix. */
        private fun idName(viewId: String?): String? = viewId?.substringAfterLast('/')
    }
}
