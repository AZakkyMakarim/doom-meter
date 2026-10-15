package com.doommeter.detection.adapters

import com.doommeter.detection.NodeSnapshot
import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.SurfaceObservation

/**
 * TikTok (For You and Following). Every TikTok-specific selector lives in this file, so an app
 * update that breaks detection is fixed here and nowhere else.
 *
 * The adapter only reports what the UI is doing. It has no counting rules (no 5 second
 * threshold, no timers) and keeps nothing: text is matched against fixed labels or hashed into
 * an in-memory token, never stored or sent.
 *
 * The selectors are English-UI, best-effort and unverified against a live TikTok build; see the
 * manual checks on ticket doom-meter-v9k.4.
 */
class TikTokAdapter : PlatformAdapter {
    override val platform = "tiktok"

    override val packageNames = setOf(PACKAGE_GLOBAL, PACKAGE_ASIA)

    override fun observe(root: NodeSnapshot): SurfaceObservation {
        val scan = Scan()
        scan.visit(root, parentSelected = false)
        val feedVisible = scan.forYouTab && scan.followingTab
        if (!feedVisible || scan.otherTabSelected || scan.overlayOpen) {
            return SurfaceObservation.INACTIVE
        }
        return SurfaceObservation(surfaceActive = true, videoToken = scan.token())
    }

    /** One pass over the tree, collecting just what the rules above need. */
    private class Scan {
        var forYouTab = false
        var followingTab = false
        var otherTabSelected = false
        var overlayOpen = false
        private var hash = FNV_OFFSET
        private var hashed = 0

        fun visit(node: NodeSnapshot, parentSelected: Boolean) {
            // Off-screen pager items are not the video in focus.
            if (!node.isVisibleToUser) return
            val selected = node.isSelected || parentSelected

            if (hasLabel(node, FOR_YOU)) forYouTab = true
            if (hasLabel(node, FOLLOWING)) followingTab = true
            if (selected && OTHER_TABS.any { hasLabel(node, it) }) otherTabSelected = true
            if (isOverlay(node)) overlayOpen = true
            absorb(node)

            for (child in node.children) visit(child, selected)
        }

        /** Fold the node's stable, non-numeric text into the video token. */
        private fun absorb(node: NodeSnapshot) {
            if (node.className?.contains("EditText") == true) return
            val text = node.text?.trim() ?: return
            if (text.length < MIN_TOKEN_TEXT || NUMERIC.matches(text)) return
            for (ch in text) hash = (hash xor ch.code.toLong()) * FNV_PRIME
            hash = (hash xor SEPARATOR) * FNV_PRIME
            hashed += 1
        }

        fun token(): Long? = if (hashed == 0) null else hash
    }

    companion object {
        const val PACKAGE_GLOBAL = "com.zhiliaoapp.musically"
        const val PACKAGE_ASIA = "com.ss.android.ugc.trill"

        private const val FOR_YOU = "For You"
        private const val FOLLOWING = "Following"

        /** Top-bar tabs that replace the feed; if one is selected, no swipe feed is in focus. */
        private val OTHER_TABS = listOf("LIVE", "STEM", "Friends", "Explore", "Shop")

        /** Titles of the sheets that cover the feed and pause counting (comments). */
        private val OVERLAY_TEXTS =
            listOf(
                Regex("^[\\d.,]+\\s?[KMB]?\\s+comments?$", RegexOption.IGNORE_CASE),
                Regex("^comments$", RegexOption.IGNORE_CASE),
                Regex("^add comment.*", RegexOption.IGNORE_CASE),
            )

        /** Counts and timestamps change while a video plays; they must not look like a swipe. */
        private val NUMERIC = Regex("^[\\d.,:\\s]+[KMB]?$")

        private const val MIN_TOKEN_TEXT = 2
        private const val FNV_OFFSET = -3750763034362895579L
        private const val FNV_PRIME = 1099511628211L
        private const val SEPARATOR = 0x1FL

        private fun hasLabel(node: NodeSnapshot, label: String): Boolean =
            label.equals(node.text?.trim(), ignoreCase = true) ||
                label.equals(node.contentDescription?.trim(), ignoreCase = true)

        private fun isOverlay(node: NodeSnapshot): Boolean {
            val text = node.text?.trim() ?: return false
            return OVERLAY_TEXTS.any { it.matches(text) }
        }
    }
}
