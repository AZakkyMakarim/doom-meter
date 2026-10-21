package com.doommeter.detection.adapters

import com.doommeter.detection.NodeSnapshot
import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.SurfaceObservation

/**
 * YouTube Shorts. Every YouTube-specific selector lives in this file, so an app update that
 * breaks detection is fixed here and nowhere else.
 *
 * Only the vertical Shorts pager counts. Regular and long videos (the watch player), the home
 * feed and its Shorts shelf are never matched, so they stay inactive. A channel profile
 * pauses the surface; the comments sheet does not.
 *
 * The adapter only reports what the UI is doing. It has no counting rules (no
 * thresholds, no timers) and keeps nothing: text is matched against fixed labels or hashed into
 * an in-memory token, never stored or sent.
 *
 * The selectors are English-UI, best-effort and unverified against a live YouTube build; see the
 * manual checks on ticket doom-meter-v9k.6.
 */
class YouTubeAdapter : PlatformAdapter {
    override val platform = "youtube"

    override val packageNames = setOf(PACKAGE)

    override fun observe(root: NodeSnapshot): SurfaceObservation {
        val scan = Scan()
        scan.visit(root, inPager = false)
        if (!scan.pagerVisible || scan.profileOpen) return SurfaceObservation.INACTIVE
        return SurfaceObservation(surfaceActive = true, videoToken = scan.token())
    }

    /** One pass over the tree, collecting just what the rules above need. */
    private class Scan {
        var pagerVisible = false
        var profileOpen = false
        private var hash = FNV_OFFSET
        private var hashed = 0

        fun visit(node: NodeSnapshot, inPager: Boolean) {
            // Off-screen pager pages are not the video in focus.
            if (!node.isVisibleToUser) return

            val name = idName(node.viewId)
            val pager = inPager || name in PAGER_IDS
            if (name in PAGER_IDS) pagerVisible = true
            if (name != null && name in PROFILE_IDS) profileOpen = true
            if (pager) absorb(node)

            for (child in node.children) visit(child, pager)
        }

        /** Fold the node's stable, non-numeric text into the video token. */
        private fun absorb(node: NodeSnapshot) {
            if (node.className?.contains("EditText") == true) return
            val text = node.text?.trim() ?: return
            if (text.length < MIN_TOKEN_TEXT || NUMERIC.matches(text)) return
            // These flip or vanish while the same Short plays; they must not look like a swipe.
            if (BUTTON_LABELS.any { it.equals(text, ignoreCase = true) }) return
            for (ch in text) hash = (hash xor ch.code.toLong()) * FNV_PRIME
            hash = (hash xor SEPARATOR) * FNV_PRIME
            hashed += 1
        }

        fun token(): Long? = if (hashed == 0) null else hash
    }

    companion object {
        const val PACKAGE = "com.google.android.youtube"

        /** The vertical Shorts pager and its page container. The watch player is never listed. */
        private val PAGER_IDS = setOf("reel_recycler", "reel_player_page_container")

        /** The channel page header. */
        private val PROFILE_IDS = setOf("channel_header", "channel_page_header", "c4_tabbed_header")

        private val BUTTON_LABELS = listOf("Subscribe", "Subscribed", "Remix", "Shorts")

        /** Counts and timestamps change while a Short plays; they must not look like a swipe. */
        private val NUMERIC = Regex("^[\\d.,:\\s]+[KMB]?$")

        private const val MIN_TOKEN_TEXT = 2
        private const val FNV_OFFSET = -3750763034362895579L
        private const val FNV_PRIME = 1099511628211L
        private const val SEPARATOR = 0x1FL

        /** `com.google.android.youtube:id/name` -> `name`; tolerates ids without a package prefix. */
        private fun idName(viewId: String?): String? = viewId?.substringAfterLast('/')
    }
}
