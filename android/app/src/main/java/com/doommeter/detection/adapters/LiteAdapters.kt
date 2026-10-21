package com.doommeter.detection.adapters

import com.doommeter.detection.NodeSnapshot
import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.SurfaceObservation

/**
 * Instagram Lite, Facebook Lite and TikTok Lite. A Lite app counts as its parent Platform
 * (CONTEXT.md), so each adapter reports the parent's engine id and no separate "Lite" row exists.
 * Every Lite-specific selector lives in this file.
 *
 * All Lite selectors are best effort and unverified on a device: no Lite app could be inspected
 * when this was written (see docs/qa/doommeter-v1/lite-apps.md). A wrong selector fails closed:
 * nothing is recognised, nothing is counted, and the silent-service rule of ADR 0005 flags the
 * Platform if the app produces no accessibility events at all.
 */
object LiteAdapters {
    const val INSTAGRAM_LITE = "com.instagram.lite"
    const val FACEBOOK_LITE = "com.facebook.lite"
    const val TIKTOK_LITE_GLOBAL = "com.zhiliaoapp.musically.go"
    const val TIKTOK_LITE_ASIA = "com.ss.android.ugc.trill.go"

    fun all(): List<PlatformAdapter> =
        listOf(
            ViewerIdAdapter(
                platform = "instagram",
                packageNames = setOf(INSTAGRAM_LITE),
                viewerIdPrefixes = listOf("clips_viewer", "reels_viewer", "clips_video"),
                storyIdPrefixes = listOf("reel_viewer", "story_viewer"),
                profileIds = setOf("profile_header", "profile_header_container", "profile_tab_layout"),
                buttonLabels = listOf("Follow", "Following", "Follow back", "Requested"),
            ),
            ViewerIdAdapter(
                platform = "facebook",
                packageNames = setOf(FACEBOOK_LITE),
                viewerIdPrefixes = listOf("reels_viewer", "reel_viewer", "fb_reels_viewer"),
                storyIdPrefixes = listOf("story_viewer", "stories_viewer"),
                profileIds = setOf("profile_header_container", "timeline_header"),
                buttonLabels = listOf("Follow", "Following", "Join", "Joined"),
            ),
            // TikTok Lite is a trimmed build of the same app, so it keeps the For You / Following
            // label selectors; only the package differs.
            TikTokAdapter(setOf(TIKTOK_LITE_GLOBAL, TIKTOK_LITE_ASIA)),
        )
}

/**
 * A Reels surface recognised by a vertical viewer view id, as in the main Instagram and Facebook
 * adapters: the surface is on while a viewer is visible and no Story viewer or creator profile is.
 * Reports what the UI is doing; no counting rules, nothing kept (text is only hashed in memory).
 */
class ViewerIdAdapter(
    override val platform: String,
    override val packageNames: Set<String>,
    private val viewerIdPrefixes: List<String>,
    private val storyIdPrefixes: List<String>,
    private val profileIds: Set<String>,
    private val buttonLabels: List<String>,
) : PlatformAdapter {
    override fun observe(root: NodeSnapshot): SurfaceObservation {
        val scan = Scan()
        scan.visit(root, inViewer = false)
        if (!scan.viewerVisible || scan.profileOpen || scan.storyOpen) return SurfaceObservation.INACTIVE
        return SurfaceObservation(surfaceActive = true, videoToken = scan.token())
    }

    private inner class Scan {
        var viewerVisible = false
        var profileOpen = false
        var storyOpen = false
        private var hash = FNV_OFFSET
        private var hashed = 0

        fun visit(node: NodeSnapshot, inViewer: Boolean) {
            // Off-screen pager pages are not the video in focus.
            if (!node.isVisibleToUser) return
            val name = node.viewId?.substringAfterLast('/')
            val isViewer = name != null && viewerIdPrefixes.any { name.startsWith(it) }
            val viewer = inViewer || isViewer
            if (isViewer) viewerVisible = true
            if (name != null && name in profileIds) profileOpen = true
            if (name != null && storyIdPrefixes.any { name.startsWith(it) }) storyOpen = true
            if (viewer) absorb(node)
            for (child in node.children) visit(child, viewer)
        }

        private fun absorb(node: NodeSnapshot) {
            if (node.className?.contains("EditText") == true) return
            val text = node.text?.trim() ?: return
            if (text.length < MIN_TOKEN_TEXT || NUMERIC.matches(text)) return
            // The Follow button flips while the same Reel plays; it must not look like a swipe.
            if (buttonLabels.any { it.equals(text, ignoreCase = true) }) return
            for (ch in text) hash = (hash xor ch.code.toLong()) * FNV_PRIME
            hash = (hash xor SEPARATOR) * FNV_PRIME
            hashed += 1
        }

        fun token(): Long? = if (hashed == 0) null else hash
    }

    private companion object {
        val NUMERIC = Regex("^[\\d.,:\\s]+[KMB]?$")
        const val MIN_TOKEN_TEXT = 2
        const val FNV_OFFSET = -3750763034362895579L
        const val FNV_PRIME = 1099511628211L
        const val SEPARATOR = 0x1FL
    }
}
