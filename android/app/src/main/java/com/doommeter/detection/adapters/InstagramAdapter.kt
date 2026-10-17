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
        if (!scan.viewerVisible || scan.overlayOpen()) return SurfaceObservation.INACTIVE
        return SurfaceObservation(surfaceActive = true, videoToken = scan.token())
    }

    /** One pass over the tree, collecting just what the rules above need. */
    private class Scan {
        var viewerVisible = false
        private val emoji = HashSet<String>()
        private var overlay = false
        private var hash = FNV_OFFSET
        private var hashed = 0

        fun overlayOpen() = overlay || emoji.size >= MIN_REACTION_EMOJI

        fun visit(node: NodeSnapshot, inViewer: Boolean) {
            // Off-screen pager pages are not the video in focus.
            if (!node.isVisibleToUser) return

            val name = idName(node.viewId)
            val isViewer = name != null && (name in VIEWER_IDS || name.startsWith(VIEWER_ID_PREFIX))
            val viewer = inViewer || isViewer
            if (isViewer) viewerVisible = true
            if (isOverlay(node, name)) overlay = true
            if (name != null && name.startsWith(THREAD_ID_PREFIX)) overlay = true
            noteEmoji(node.text)
            noteEmoji(node.contentDescription)
            if (viewer) absorb(node)

            for (child in node.children) visit(child, viewer)
        }

        private fun noteEmoji(label: String?) {
            // Cheap length gate first: most node text is far longer than any emoji sequence.
            if (label == null || label.length > MAX_LABEL_CHARS) return
            val t = label.trim()
            if (isSingleEmoji(t)) emoji.add(t)
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

        /** Other hosts of the viewer (Explore, feed) may wrap it under their own `clips_viewer_*` id. */
        private const val VIEWER_ID_PREFIX = "clips_viewer_"

        /** Rows of the comments thread (`row_comment_*`); the Reel's own rail uses other ids. */
        private const val THREAD_ID_PREFIX = "row_comment_"

        /**
         * The comments sheet shows a row of quick-reaction emoji (heart, clap, fire...) above the
         * composer. Its hint text varies by build, so this is the language-independent signal. The
         * Explore and feed viewers' persistent bar has no such row, and a caption rarely has this
         * many separate emoji-only nodes.
         */
        private const val MIN_REACTION_EMOJI = 4

        /**
         * Comments thread composer and the creator profile screen header. The `comment_composer_*`
         * ids are not here: the Explore and feed viewers' persistent bottom bar is probably built
         * from them, and they never paused the real comments sheet anyway.
         */
        private val OVERLAY_IDS =
            setOf(
                "layout_comment_thread_edittext",
                "profile_header_container",
                "profile_tab_layout",
                "profile_header_actions_top_row",
            )

        /**
         * Sheet title and composer hints of the comments sheet (matched on text only). The bare
         * "Add comment..." is not here: the Explore and feed Reels viewers keep it as a persistent
         * bottom bar, so matching it would report those viewers as paused for good.
         */
        private val OVERLAY_TEXTS =
            listOf(
                Regex("^comments$", RegexOption.IGNORE_CASE),
                Regex("^add a comment.*", RegexOption.IGNORE_CASE),
                Regex("^what do you think of this.*", RegexOption.IGNORE_CASE),
                Regex("^join the conversation.*", RegexOption.IGNORE_CASE),
            )

        /** The Explore and feed viewers' always-visible bottom bar, even when it uses an overlay id. */
        private val PASSIVE_BAR = Regex("^add comment.*", RegexOption.IGNORE_CASE)

        private val BUTTON_LABELS = listOf("Follow", "Following", "Follow back", "Requested")

        /** Counts and timestamps change while a Reel plays; they must not look like a swipe. */
        private val NUMERIC = Regex("^[\\d.,:\\s]+[KMB]?$")

        private const val MIN_TOKEN_TEXT = 2
        private const val FNV_OFFSET = -3750763034362895579L
        private const val FNV_PRIME = 1099511628211L
        private const val SEPARATOR = 0x1FL

        /** `com.instagram.android:id/name` -> `name`; tolerates ids without a package prefix. */
        private fun idName(viewId: String?): String? = viewId?.substringAfterLast('/')

        /**
         * Exactly one emoji: a base symbol, optionally a flag pair, variation selector or skin
         * tone, and ZWJ-joined further bases. Rejects multi-emoji strings, text and plain symbols.
         */
        private fun isSingleEmoji(t: String): Boolean {
            if (t.isEmpty()) return false
            var i = 0
            while (true) {
                val cp = t.codePointAt(i)
                if (Character.getType(cp) != Character.OTHER_SYMBOL.toInt() || cp in NOT_EMOJI) return false
                i += Character.charCount(cp)
                if (cp in REGIONAL_INDICATORS && i < t.length && t.codePointAt(i) in REGIONAL_INDICATORS) i += 2
                if (i < t.length && t[i] == VARIATION_SELECTOR_16) i++
                else if (i < t.length && t.codePointAt(i) in SKIN_TONES) i += 2
                if (i == t.length) return true
                if (t[i] != ZWJ) return false
                i++
                if (i == t.length) return false
            }
        }

        /** Longest label (before trimming) worth inspecting; a ZWJ family emoji is 11 chars. */
        private const val MAX_LABEL_CHARS = 32
        private const val ZWJ = '‍'
        private const val VARIATION_SELECTOR_16 = '️'
        private val SKIN_TONES = 0x1F3FB..0x1F3FF
        private val REGIONAL_INDICATORS = 0x1F1E6..0x1F1FF

        /** Symbols (category So) that are text, not emoji. */
        private val NOT_EMOJI = setOf('©'.code, '®'.code, '™'.code, '°'.code)

        private fun isOverlay(node: NodeSnapshot, name: String?): Boolean {
            val text = node.text?.trim()
            // shortcut: English-only exemption for the passive bar; other locales fall back to the id rule.
            if (name != null && name in OVERLAY_IDS) return text == null || !PASSIVE_BAR.matches(text)
            return text != null && OVERLAY_TEXTS.any { it.matches(text) }
        }
    }
}
