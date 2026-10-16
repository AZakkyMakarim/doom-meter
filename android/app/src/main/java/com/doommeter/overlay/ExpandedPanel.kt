package com.doommeter.overlay

import android.content.Context
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.RectF
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The expanded panel (MASTER 6.2): large Mood avatar and Tier name, totals, one row per
 * Platform with a proportion bar and a numeric label, the Day context, and an explicit close
 * button. Draws what [PanelModel] says; holds no domain or design rules.
 *
 * Main thread only. [onClose] fires for the close button and for a swipe up.
 */
class ExpandedPanel(
    private val context: Context,
    private val monoBold: Typeface,
    private val monoMedium: Typeface,
    private val onClose: () -> Unit,
) {
    private val density = context.resources.displayMetrics.density

    private val labelFace = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    private val bodyFace = Typeface.create("sans-serif", Typeface.NORMAL)
    private val displayFace = Typeface.create("sans-serif", Typeface.BOLD)

    private val card = GradientDrawable().apply { cornerRadius = dp(16f).toFloat() }
    private val avatar = ImageView(context).apply { scaleType = ImageView.ScaleType.FIT_CENTER }
    private val tierName = text(displayFace, 40f).apply {
        gravity = Gravity.CENTER
        maxLines = 2
        isSingleLine = false
    }
    private val count = text(monoBold, 26f).apply { fontFeatureSettings = "tnum" }
    private val unit = text(bodyFace, 16f)
    private val time = text(monoMedium, 16f).apply { fontFeatureSettings = "tnum" }
    private val day = text(bodyFace, 13f).apply { gravity = Gravity.CENTER }
    private val header = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        // Read as one summary; the pieces are not announced one by one.
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        isFocusable = true
    }
    private val rowsHolder = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    private val rowViews = mutableListOf<RowViews>()
    private val close = CloseButton(context)
    private val scroll = CappedScrollView(context)

    private var lastAvatar: String? = null
    private var model: PillModel? = null

    private class RowViews(
        val root: LinearLayout,
        val chip: TextView,
        val count: TextView,
        val time: TextView,
        val bar: BarView,
        val percent: TextView,
        val background: GradientDrawable,
        val chipBackground: GradientDrawable,
    )

    /** The view to add to the overlay window. */
    val view: View

    init {
        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16f), dp(16f), dp(16f), dp(16f))
        }
        header.addView(avatar, LinearLayout.LayoutParams(0, 0))
        header.addView(
            tierName,
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12f) },
        )
        // Count and unit stay together; the time drops below them when the row is too wide
        // at a large font scale, so neither is ever truncated (MASTER 8).
        val countGroup = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        countGroup.addView(count, LinearLayout.LayoutParams(-2, -2))
        countGroup.addView(unit, LinearLayout.LayoutParams(-2, -2).apply { marginStart = dp(4f) })
        val totals = WrapRow(context, hGap = dp(16f), vGap = dp(4f), stackedGravity = Gravity.CENTER_HORIZONTAL)
        totals.addView(countGroup, LinearLayout.LayoutParams(-2, -2))
        totals.addView(time, LinearLayout.LayoutParams(-2, -2))
        header.addView(
            totals,
            LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(8f) },
        )
        header.addView(day, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(4f) })
        content.addView(header, LinearLayout.LayoutParams(-1, -2))
        content.addView(
            rowsHolder,
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(16f) },
        )
        scroll.isVerticalScrollBarEnabled = false
        scroll.overScrollMode = View.OVER_SCROLL_NEVER
        scroll.addView(content, FrameLayout.LayoutParams(-1, -2))

        close.setOnClickListener { onClose() }

        val frame = SwipeUpFrame(context, scroll, onClose)
        frame.background = card
        frame.addView(scroll, FrameLayout.LayoutParams(-1, -2))
        frame.addView(
            close,
            FrameLayout.LayoutParams(dp(48f), dp(48f), Gravity.TOP or Gravity.END)
                .apply { setMargins(0, dp(4f), dp(4f), 0) },
        )
        view = frame
    }

    fun update(model: PillModel, animate: Boolean) {
        this.model = model
        val p = model.panel
        card.setColor(p.surfaceColor)
        val strokePx = max(1, (model.borderWidthDp * density).roundToInt())
        card.setStroke(strokePx, model.borderColor)

        (avatar.layoutParams as LinearLayout.LayoutParams).apply {
            width = dp(p.avatarSizeDp)
            height = dp(p.avatarSizeDp)
        }
        if (p.avatar != lastAvatar) {
            val id = context.resources.getIdentifier(p.avatar, "drawable", context.packageName)
            if (id != 0) avatar.setImageDrawable(context.getDrawable(id))
            if (lastAvatar != null && animate) pop(avatar)
            lastAvatar = p.avatar
        }
        avatar.requestLayout()

        tierName.text = p.tierName
        tierName.setTextColor(p.accentColor)
        count.text = p.countText
        count.setTextColor(p.textColor)
        unit.text = p.unitText
        unit.setTextColor(p.mutedTextColor)
        time.text = p.timeText
        time.setTextColor(p.textColor)
        day.text = p.dayText
        day.setTextColor(p.mutedTextColor)
        header.contentDescription = p.contentDescription

        close.contentDescription = p.closeLabel
        close.setColors(p.textColor, p.rowColor)

        ensureRows(p)
        p.rows.forEachIndexed { i, row ->
            val r = rowViews[i]
            r.background.setColor(p.rowColor)
            r.chip.text = row.label
            r.chip.setTextColor(p.chipTextColor)
            r.chipBackground.setColor(row.color)
            r.count.text = "${row.countText} ${row.unitText}"
            r.count.setTextColor(p.textColor)
            r.time.text = row.timeText
            r.time.setTextColor(p.textColor)
            r.bar.set(row.percent, row.color, p.surfaceColor)
            r.percent.text = row.percentText
            r.percent.setTextColor(p.textColor)
            r.root.contentDescription = row.contentDescription
        }
        applySizing()
    }

    /** Width and, in landscape, the 60% height cap (MASTER 8). Call again on rotation. */
    fun applySizing() {
        val m = model ?: return
        val metrics = context.resources.displayMetrics
        val width = min(dp(m.panel.widthDp), metrics.widthPixels - dp(32f))
        val lp = view.layoutParams
        if (lp != null && lp.width != width) {
            lp.width = width
            view.layoutParams = lp
        }
        val landscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        // Landscape: at most 60% of the height. Any orientation: never past the bottom of the
        // screen, which large fonts or a pill dragged down could otherwise cause. Then scroll.
        var cap = Int.MAX_VALUE
        if (landscape) cap = (metrics.heightPixels * m.panel.landscapeMaxHeightFraction).roundToInt()
        if (roomPx > 0) cap = min(cap, max(roomPx, dp(MIN_PANEL_HEIGHT_DP)))
        scroll.maxHeightPx = if (cap == Int.MAX_VALUE) 0 else cap
        scroll.requestLayout()
    }

    /** Space below the panel's top edge that is still on screen; set by the pill window. */
    var roomPx = 0
        set(value) {
            if (field == value) return
            field = value
            applySizing()
        }

    /** Lets screen readers know a new pane appeared; the title is read once on opening. */
    fun announceOpened() {
        val m = model ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            view.accessibilityPaneTitle = m.panel.tierName
        }
    }

    private fun ensureRows(p: PanelModel) {
        if (rowViews.size == p.rows.size) return
        rowsHolder.removeAllViews()
        rowViews.clear()
        p.rows.forEachIndexed { i, _ ->
            val background = GradientDrawable().apply { cornerRadius = dp(8f).toFloat() }
            val chipBackground = GradientDrawable().apply { cornerRadius = dp(8f).toFloat() }
            val root = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                this.background = background
                setPadding(dp(12f), dp(12f), dp(12f), dp(12f))
                // One label per row, with the numbers in words; the visuals are decorative.
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
                isFocusable = true
            }
            val chip = text(labelFace, 13f).apply {
                this.background = chipBackground
                setPadding(dp(8f), dp(4f), dp(8f), dp(4f))
            }
            val rowCount = text(monoBold, 16f).apply { fontFeatureSettings = "tnum" }
            val rowTime = text(monoMedium, 14f).apply { fontFeatureSettings = "tnum" }
            // Chip on the left, numbers on the right; the numbers drop below the chip when the
            // row is too wide at a large font scale, so none of them truncates (MASTER 8).
            val stats = WrapRow(context, hGap = dp(12f), vGap = dp(2f))
            stats.addView(rowCount, LinearLayout.LayoutParams(-2, -2))
            stats.addView(rowTime, LinearLayout.LayoutParams(-2, -2))
            val spacer = View(context)
            val line = WrapRow(context, hGap = dp(8f), vGap = dp(8f), spacer = spacer)
            line.addView(chip, LinearLayout.LayoutParams(-2, -2))
            line.addView(spacer, LinearLayout.LayoutParams(0, 1, 1f))
            line.addView(stats, LinearLayout.LayoutParams(-2, -2))
            val bar = BarView(context, density)
            val percent = text(monoMedium, 13f).apply {
                fontFeatureSettings = "tnum"
                gravity = Gravity.END
                minWidth = dp(40f)
            }
            val barLine = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            barLine.addView(bar, LinearLayout.LayoutParams(0, dp(8f), 1f))
            barLine.addView(
                percent,
                LinearLayout.LayoutParams(-2, -2).apply { marginStart = dp(8f) },
            )
            root.addView(line, LinearLayout.LayoutParams(-1, -2))
            root.addView(
                barLine,
                LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8f) },
            )
            hideChildrenFromAccessibility(root)
            rowsHolder.addView(
                root,
                LinearLayout.LayoutParams(-1, -2).apply { if (i > 0) topMargin = dp(8f) },
            )
            rowViews += RowViews(root, chip, rowCount, rowTime, bar, percent, background, chipBackground)
        }
    }

    private fun hideChildrenFromAccessibility(group: LinearLayout) {
        for (i in 0 until group.childCount) {
            group.getChildAt(i).importantForAccessibility =
                View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        }
    }

    private fun pop(target: View) {
        target.animate().cancel()
        target.scaleX = 0.9f
        target.scaleY = 0.9f
        target.animate().scaleX(1.1f).scaleY(1.1f).setDuration(100).withEndAction {
            target.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
        }.start()
    }

    private fun text(face: Typeface, sizeSp: Float) =
        TextView(context).apply {
            typeface = face
            includeFontPadding = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        }

    private fun dp(value: Float): Int = (value * density + 0.5f).toInt()

    private companion object {
        const val MIN_PANEL_HEIGHT_DP = 160f
    }

    /** Scroll view that never grows past [maxHeightPx] (0 means no cap). */
    private class CappedScrollView(context: Context) : ScrollView(context) {
        var maxHeightPx = 0

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val spec =
                if (maxHeightPx > 0) {
                    val size = MeasureSpec.getSize(heightMeasureSpec)
                    val cap = if (size > 0) min(size, maxHeightPx) else maxHeightPx
                    MeasureSpec.makeMeasureSpec(cap, MeasureSpec.AT_MOST)
                } else {
                    heightMeasureSpec
                }
            super.onMeasure(widthMeasureSpec, spec)
        }
    }

    /**
     * Collapses on a swipe up, but only once the content cannot scroll any further down, so a
     * tall landscape panel still scrolls normally.
     */
    private class SwipeUpFrame(
        context: Context,
        private val scroll: ScrollView,
        private val onSwipeUp: () -> Unit,
    ) : FrameLayout(context) {
        private val slop = ViewConfiguration.get(context).scaledTouchSlop
        private var downX = 0f
        private var downY = 0f
        private var swiping = false

        override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = ev.rawX
                    downY = ev.rawY
                    swiping = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dy = ev.rawY - downY
                    val dx = ev.rawX - downX
                    if (dy < -slop && abs(dy) > abs(dx) && !scroll.canScrollVertically(1)) {
                        swiping = true
                    }
                }
            }
            return swiping
        }

        override fun onTouchEvent(ev: MotionEvent): Boolean {
            when (ev.actionMasked) {
                MotionEvent.ACTION_UP -> {
                    if (swiping && ev.rawY - downY < -slop * 2) onSwipeUp()
                    swiping = false
                }
                MotionEvent.ACTION_CANCEL -> swiping = false
            }
            return true
        }
    }

    /** Proportion bar: a filled share of a track. The numeric label sits next to it. */
    private class BarView(context: Context, private val density: Float) : View(context) {
        private val track = Paint(Paint.ANTI_ALIAS_FLAG)
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        private val rect = RectF()
        private var percent = 0

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        fun set(percent: Int, fillColor: Int, trackColor: Int) {
            this.percent = percent.coerceIn(0, 100)
            fill.color = fillColor
            track.color = trackColor
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            val r = height / 2f
            rect.set(0f, 0f, width.toFloat(), height.toFloat())
            canvas.drawRoundRect(rect, r, r, track)
            if (percent > 0) {
                // At least a dot, so a small but non-zero share stays visible.
                val w = max(height.toFloat(), width * percent / 100f)
                rect.set(0f, 0f, w, height.toFloat())
                canvas.drawRoundRect(rect, r, r, fill)
            }
        }
    }

    /** Close button: a 48dp target with a 2dp bold X (one icon style, MASTER 9). */
    private class CloseButton(context: Context) : View(context) {
        private val d = context.resources.displayMetrics.density
        private val glyph =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = 2.5f * d
                strokeCap = Paint.Cap.ROUND
            }
        private val disc = Paint(Paint.ANTI_ALIAS_FLAG)

        init {
            isClickable = true
            isFocusable = true
            accessibilityDelegate =
                object : AccessibilityDelegate() {
                    override fun onInitializeAccessibilityNodeInfo(
                        host: View,
                        info: AccessibilityNodeInfo,
                    ) {
                        super.onInitializeAccessibilityNodeInfo(host, info)
                        info.className = "android.widget.Button"
                    }
                }
        }

        fun setColors(glyphColor: Int, discColor: Int) {
            glyph.color = glyphColor
            disc.color = discColor
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            canvas.drawCircle(cx, cy, 20f * d, disc)
            val a = 6f * d
            canvas.drawLine(cx - a, cy - a, cx + a, cy + a, glyph)
            canvas.drawLine(cx - a, cy + a, cx + a, cy - a, glyph)
        }
    }
}
