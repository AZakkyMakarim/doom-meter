package com.doommeter.overlay

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.ComponentCallbacks
import android.content.Context
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewPropertyAnimator
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityNodeInfo
import android.view.animation.AccelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The Overlay pill: a small opaque pill drawn over other apps, centered below the status bar
 * and cutout. Follows design-system/doommeter/MASTER.md sections 2, 3, 4, 6.1 and 7.
 *
 * Main thread only. The window is sized to the pill, so touches outside it fall through to the
 * app underneath (FLAG_NOT_TOUCH_MODAL).
 */
class OverlayPill(context: Context, private val onMoved: (Float) -> Unit = {}) {
    private val appContext = context.applicationContext
    private val windowManager = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val density = appContext.resources.displayMetrics.density

    private val monoBold = font("JetBrainsMono-Bold.ttf", Typeface.MONOSPACE)
    private val monoMedium = font("JetBrainsMono-Medium.ttf", Typeface.MONOSPACE)
    private val labelFace = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    private val unitFace = Typeface.create("sans-serif", Typeface.NORMAL)

    private var root: FrameLayout? = null
    private var params: WindowManager.LayoutParams? = null
    private var views: Views? = null
    private var currentBorderColor = 0
    private var borderAnimator: ValueAnimator? = null
    private var pulseAnimator: ObjectAnimator? = null
    private var lastPulseMs: Long? = null
    private var lastAvatar: String? = null
    private var collapsedLabel = "Collapsed"
    private var panelView: ExpandedPanel? = null
    private var expanded = false
    private var swapAnimator: ViewPropertyAnimator? = null

    /** Whether the panel may spring open; JavaScript turns it off under reduced motion. */
    private var panelSpring = true

    /**
     * Vertical offset from the top-edge anchor. JavaScript owns it: Settings sets it through
     * the view model, and a finished drag is reported through [onMoved] to be saved there.
     */
    private var dragOffsetPx = 0

    /** The last position JavaScript sent; the offset follows it only when it changes. */
    private var lastModelPositionDp: Float? = null
    private var dragRangePx = 0
    private var downRawY = 0f
    private var downOffset = 0
    private var dragging = false
    private val touchSlop = ViewConfiguration.get(appContext).scaledTouchSlop

    private val configCallbacks =
        object : ComponentCallbacks {
            override fun onConfigurationChanged(newConfig: Configuration) {
                root?.post {
                    positionWindow()
                    panelView?.applySizing()
                }
            }

            override fun onLowMemory() = Unit
        }

    private class Views(
        val pill: PillLayout,
        val pillHost: FrameLayout,
        val background: GradientDrawable,
        val avatarHolder: FrameLayout,
        val avatar: ImageView,
        val count: TextView,
        val unit: TextView,
        val dot: TextView,
        val time: TextView,
        val label: TextView,
    )

    val isShown: Boolean
        get() = root != null

    fun render(model: PillModel) {
        if (!Settings.canDrawOverlays(appContext)) {
            hide()
            return
        }
        val firstDraw = root == null
        if (firstDraw && !attach()) return
        val v = views ?: return
        collapsedLabel = model.collapsedLabel
        apply(model, v, animate = !firstDraw)
        dragRangePx = dp(model.dragRangeDp)
        // A new position from Settings moves the pill; a drag in progress is never overridden
        // by the same old value arriving on the next redraw.
        if (model.positionDp != lastModelPositionDp) {
            lastModelPositionDp = model.positionDp
            if (!dragging) dragOffsetPx = dp(model.positionDp)
        }
        dragOffsetPx = dragOffsetPx.coerceIn(0, dragRangePx)
        panelSpring = model.motion.panelSpring
        panelView?.update(model, animate = !firstDraw && model.motion.scalePop && !systemReducedMotion())
        // Only a Tier change is spoken; a new video or a time update never is (MASTER 8).
        model.announcement?.let { if (!firstDraw) root?.announceForAccessibility(it) }
        if (model.haptic != "none") Haptics.fire(appContext, model.haptic)
        positionWindow()
    }

    fun hide() {
        borderAnimator?.cancel()
        pulseAnimator?.cancel()
        borderAnimator = null
        pulseAnimator = null
        lastPulseMs = null
        lastAvatar = null
        swapAnimator?.cancel()
        swapAnimator = null
        expanded = false
        panelView = null
        val r = root ?: return
        root = null
        views = null
        appContext.unregisterComponentCallbacks(configCallbacks)
        try {
            windowManager.removeView(r)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Pill was already removed", e)
        }
    }

    private fun attach(): Boolean {
        val pill = PillLayout(appContext)
        val background = GradientDrawable().apply { shape = GradientDrawable.RECTANGLE }
        pill.background = background
        pill.orientation = LinearLayout.HORIZONTAL
        pill.gravity = Gravity.CENTER_VERTICAL
        pill.setPadding(dp(16f), 0, dp(16f), 0)
        // The face and numbers are read through the root's single label, not one by one.
        pill.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS

        val avatar = ImageView(appContext).apply { scaleType = ImageView.ScaleType.FIT_CENTER }
        val avatarHolder = FrameLayout(appContext)
        avatarHolder.addView(avatar, FrameLayout.LayoutParams(-1, -1))

        val count = text(monoBold).apply { fontFeatureSettings = "tnum" }
        val unit = text(unitFace).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f) }
        val dot = text(unitFace).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            text = "·"
        }
        val time = text(monoMedium).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            fontFeatureSettings = "tnum"
        }
        val label = text(labelFace).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            letterSpacing = 0.04f
        }

        pill.addView(avatarHolder, LinearLayout.LayoutParams(0, 0))
        pill.addView(count, gap(8))
        pill.addView(unit, gap(4))
        pill.addView(dot, gap(8))
        pill.addView(time, gap(8))
        pill.addView(label, gap(12))
        pill.collapsibles = listOf(unit, dot, label)

        // The hit area is at least 48dp, larger than the drawn pill (MASTER 6.1).
        val pillHost = FrameLayout(appContext)
        pillHost.minimumHeight = dp(MIN_TOUCH_TARGET_DP)
        pillHost.minimumWidth = dp(MIN_TOUCH_TARGET_DP)
        pillHost.addView(
            pill,
            FrameLayout.LayoutParams(-2, -2, Gravity.CENTER),
        )
        pillHost.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        pillHost.setOnClickListener { setExpanded(true, animate = true) }
        pillHost.setOnTouchListener(::onPillTouch)
        pillHost.accessibilityDelegate =
            object : View.AccessibilityDelegate() {
                override fun onInitializeAccessibilityNodeInfo(
                    host: View,
                    info: AccessibilityNodeInfo,
                ) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.className = "android.widget.Button"
                    info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_EXPAND)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        info.stateDescription = collapsedLabel
                    }
                }

                override fun performAccessibilityAction(
                    host: View,
                    action: Int,
                    args: Bundle?,
                ): Boolean {
                    if (action == AccessibilityNodeInfo.ACTION_EXPAND) {
                        setExpanded(true, animate = true)
                        return true
                    }
                    return super.performAccessibilityAction(host, action, args)
                }
            }

        val panel = ExpandedPanel(appContext, monoBold, monoMedium) {
            setExpanded(false, animate = true)
        }
        panel.view.visibility = View.GONE

        val container = FrameLayout(appContext)
        container.addView(pillHost, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER_HORIZONTAL))
        container.addView(
            panel.view,
            FrameLayout.LayoutParams(dp(360f), -2, Gravity.CENTER_HORIZONTAL),
        )

        val lp =
            WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
                y = topInsetPx() + dp(8f) + dragOffsetPx
            }

        try {
            windowManager.addView(container, lp)
        } catch (e: RuntimeException) {
            // Permission revoked between the check and the add, or the window was refused.
            Log.w(TAG, "Could not draw the pill", e)
            return false
        }
        root = container
        params = lp
        views = Views(pill, pillHost, background, avatarHolder, avatar, count, unit, dot, time, label)
        panelView = panel
        expanded = false
        appContext.registerComponentCallbacks(configCallbacks)
        return true
    }

    private fun apply(model: PillModel, v: Views, animate: Boolean) {
        // Reduced motion: JavaScript clears every flag, and the system setting is honored here
        // too in case the two disagree for a moment. The haptic is not affected.
        val motion = animate && !systemReducedMotion()
        val roll = motion && model.motion.numberRoll
        val crossfade = motion && model.motion.borderCrossfade
        val pop = motion && model.motion.scalePop
        v.pill.minimumHeight = dp(model.heightDp)
        (v.avatarHolder.layoutParams as LinearLayout.LayoutParams).apply {
            width = dp(model.avatarSizeDp)
            height = dp(model.avatarSizeDp)
        }
        v.count.setTextSize(TypedValue.COMPLEX_UNIT_SP, model.countSizeSp)
        v.count.setTextColor(model.textColor)
        v.unit.setTextColor(model.mutedTextColor)
        v.dot.setTextColor(model.mutedTextColor)
        v.time.setTextColor(model.textColor)
        v.label.setTextColor(model.accentColor)
        v.label.text = model.labelText.uppercase()
        v.time.text = model.timeText
        v.unit.text = model.unitText
        v.background.setColor(model.surfaceColor)
        v.pillHost.contentDescription = model.contentDescription

        // Compact mode: the avatar and count only (MASTER 6.1). The count keeps its size.
        val extras = if (model.compact) View.GONE else View.VISIBLE
        v.dot.visibility = extras
        v.time.visibility = extras
        v.label.visibility = extras
        v.pill.compact = model.compact
        if (model.compact) v.unit.visibility = View.GONE
        v.pill.setPadding(dp(if (model.compact) 12f else 16f), 0, dp(if (model.compact) 12f else 16f), 0)

        // Count: a 120ms roll on change (opacity and translate only), nothing for time.
        if (v.count.text.toString() != model.countText) {
            if (roll) rollCount(v.count, model.countText) else setCountNow(v.count, model.countText)
        }

        // Border: 200ms crossfade on a Tier change, instant otherwise.
        val widthPx = max(1, (model.borderWidthDp * density).roundToInt())
        borderAnimator?.cancel()
        if (crossfade && model.tierChange != "none" && currentBorderColor != 0) {
            borderAnimator =
                ValueAnimator.ofArgb(currentBorderColor, model.borderColor).apply {
                    duration = DUR_BASE
                    addUpdateListener {
                        currentBorderColor = it.animatedValue as Int
                        v.background.setStroke(widthPx, currentBorderColor)
                    }
                    start()
                }
        } else {
            currentBorderColor = model.borderColor
            v.background.setStroke(widthPx, model.borderColor)
        }

        // Avatar: swap on Tier change only, with a scale pop 0.9 -> 1.1 -> 1.
        if (model.avatar != lastAvatar) {
            val id = appContext.resources.getIdentifier(model.avatar, "drawable", appContext.packageName)
            if (id != 0) v.avatar.setImageDrawable(appContext.getDrawable(id))
            lastAvatar = model.avatar
            v.avatar.animate().cancel()
            if (pop) popAvatar(v.avatar) else resetAvatar(v.avatar)
        }

        updatePulse(model, v)
        v.avatarHolder.requestLayout()
    }

    private fun setCountNow(view: TextView, text: String) {
        view.animate().cancel()
        view.alpha = 1f
        view.translationY = 0f
        view.text = text
    }

    private fun rollCount(view: TextView, text: String) {
        val shift = dp(6f).toFloat()
        view.animate().cancel()
        view.animate()
            .alpha(0f)
            .translationY(-shift)
            .setDuration(DUR_FAST / 2)
            .withEndAction {
                view.text = text
                view.translationY = shift
                view.animate().alpha(1f).translationY(0f).setDuration(DUR_FAST / 2).start()
            }
            .start()
    }

    private fun popAvatar(avatar: ImageView) {
        avatar.scaleX = 0.9f
        avatar.scaleY = 0.9f
        avatar.animate()
            .scaleX(1.1f)
            .scaleY(1.1f)
            .setDuration(DUR_BASE / 2)
            .withEndAction {
                avatar.animate().scaleX(1f).scaleY(1f).setDuration(DUR_BASE / 2).start()
            }
            .start()
    }

    private fun resetAvatar(avatar: ImageView) {
        avatar.scaleX = 1f
        avatar.scaleY = 1f
    }

    /** One gentle animated element: the avatar pulses on Tier 2 and above. */
    private fun updatePulse(model: PillModel, v: Views) {
        val period = if (systemReducedMotion() || !model.motion.pulse) null else model.pulseMs
        if (period == lastPulseMs) return
        lastPulseMs = period
        pulseAnimator?.cancel()
        pulseAnimator = null
        v.avatarHolder.alpha = 1f
        v.avatarHolder.scaleX = 1f
        v.avatarHolder.scaleY = 1f
        if (period == null) return
        pulseAnimator =
            ObjectAnimator.ofFloat(v.avatarHolder, View.ALPHA, 1f, 0.6f).apply {
                duration = period / 2
                repeatCount = ValueAnimator.INFINITE
                repeatMode = ValueAnimator.REVERSE
                addUpdateListener {
                    val s = 1f + 0.08f * (1f - v.avatarHolder.alpha) / 0.4f
                    v.avatarHolder.scaleX = s
                    v.avatarHolder.scaleY = s
                }
                start()
            }
    }

    /**
     * Swaps the pill for the panel, or back (MASTER 6.2 and 7). Opens with a 220ms spring-like
     * overshoot, closes in 150ms; transform and opacity only, and every animation is
     * interruptible. Reduced motion swaps instantly.
     */
    private fun setExpanded(open: Boolean, animate: Boolean) {
        val v = views ?: return
        val panel = panelView ?: return
        if (open == expanded) return
        expanded = open
        swapAnimator?.cancel()
        swapAnimator = null
        val motion = animate && panelSpring && !systemReducedMotion()
        val pillHost = v.pillHost
        val panelRoot = panel.view

        fun settle() {
            panelRoot.alpha = 1f
            panelRoot.scaleX = 1f
            panelRoot.scaleY = 1f
        }

        if (open) {
            pillHost.visibility = View.GONE
            pillHost.alpha = 1f
            panelRoot.visibility = View.VISIBLE
            panel.applySizing()
            panel.announceOpened()
            settle()
            if (motion) {
                panelRoot.pivotX = (panelRoot.layoutParams?.width ?: 0) / 2f
                panelRoot.pivotY = 0f
                panelRoot.alpha = 0f
                panelRoot.scaleX = 0.94f
                panelRoot.scaleY = 0.85f
                swapAnimator =
                    panelRoot.animate()
                        .alpha(1f)
                        .scaleX(1f)
                        .scaleY(1f)
                        .setDuration(DUR_PANEL_ENTER)
                        .setInterpolator(OvershootInterpolator(1f))
                        .withEndAction { swapAnimator = null }
                        .also { it.start() }
            }
        } else {
            fun finish() {
                if (expanded) return
                panelRoot.visibility = View.GONE
                settle()
                pillHost.alpha = 1f
                pillHost.visibility = View.VISIBLE
                swapAnimator = null
            }
            if (motion) {
                panelRoot.pivotX = (panelRoot.layoutParams?.width ?: 0) / 2f
                panelRoot.pivotY = 0f
                swapAnimator =
                    panelRoot.animate()
                        .alpha(0f)
                        .scaleY(0.9f)
                        .setDuration(DUR_PANEL_EXIT)
                        .setInterpolator(AccelerateInterpolator())
                        .withEndAction { finish() }
                        .also { it.start() }
            } else {
                finish()
            }
        }
    }

    /** Tap opens the panel; a vertical drag moves the pill within the top-edge band. */
    private fun onPillTouch(v: View, ev: MotionEvent): Boolean {
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downRawY = ev.rawY
                downOffset = dragOffsetPx
                dragging = false
                v.alpha = PRESSED_ALPHA
            }
            MotionEvent.ACTION_MOVE -> {
                val dy = ev.rawY - downRawY
                if (!dragging && abs(dy) > touchSlop) dragging = true
                if (dragging) {
                    dragOffsetPx = (downOffset + dy.roundToInt()).coerceIn(0, dragRangePx)
                    positionWindow()
                }
            }
            MotionEvent.ACTION_UP -> {
                v.alpha = 1f
                if (!dragging) v.performClick() else onMoved(dragOffsetPx / density)
                dragging = false
            }
            MotionEvent.ACTION_CANCEL -> {
                v.alpha = 1f
                dragging = false
            }
        }
        return true
    }

    private fun positionWindow() {
        val lp = params ?: return
        val r = root ?: return
        lp.y = topInsetPx() + dp(8f) + dragOffsetPx
        try {
            windowManager.updateViewLayout(r, lp)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Pill was already removed", e)
        }
        panelView?.roomPx = panelRoomPx()
    }

    /** Status bar or camera cutout height, whichever is larger, so the pill is never hidden. */
    private fun topInsetPx(): Int {
        val res = appContext.resources
        val id = res.getIdentifier("status_bar_height", "dimen", "android")
        val statusBar = if (id > 0) res.getDimensionPixelSize(id) else 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val insets =
                windowManager.currentWindowMetrics.windowInsets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.statusBars() or WindowInsets.Type.displayCutout(),
                )
            // An application context may report no insets, so the status bar height is the floor.
            return max(insets.top, statusBar)
        }
        return statusBar
    }

    /** Space below the panel's top edge that the panel may use: the gesture bar stays clear. */
    private fun panelRoomPx(): Int {
        val res = appContext.resources
        val id = res.getIdentifier("navigation_bar_height", "dimen", "android")
        val navBar = if (id > 0) res.getDimensionPixelSize(id) else 0
        val top = params?.y ?: 0
        return res.displayMetrics.heightPixels - top - navBar - dp(16f)
    }

    /** "Remove animations" sets the animator and transition scales to 0 (MASTER 7). */
    private fun systemReducedMotion(): Boolean =
        listOf(Settings.Global.ANIMATOR_DURATION_SCALE, Settings.Global.TRANSITION_ANIMATION_SCALE)
            .any { Settings.Global.getFloat(appContext.contentResolver, it, 1f) == 0f }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private fun text(face: Typeface) =
        TextView(appContext).apply {
            typeface = face
            includeFontPadding = false
            maxLines = 1
            isSingleLine = true
        }

    private fun gap(startDp: Int) =
        LinearLayout.LayoutParams(-2, -2).apply { marginStart = dp(startDp.toFloat()) }

    private fun font(asset: String, fallback: Typeface): Typeface =
        try {
            Typeface.createFromAsset(appContext.assets, "fonts/$asset")
        } catch (e: RuntimeException) {
            Log.w(TAG, "Missing font $asset", e)
            fallback
        }

    private fun dp(value: Float): Int = (value * density + 0.5f).toInt()

    /**
     * Horizontal pill. When the content is wider than the screen (large fonts), drops the
     * least important pieces one by one, so the count, time and face are never truncated:
     * first the "videos" unit, then the separator dot, then the Tier label (the face, the
     * border and the screen reader label still carry the Tier).
     */
    private class PillLayout(context: Context) : LinearLayout(context) {
        /** In the order they are dropped. */
        var collapsibles: List<View> = emptyList()

        /** Compact mode already hides the extras; nothing to collapse then. */
        var compact = false

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            if (!compact && MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.UNSPECIFIED) {
                val available = MeasureSpec.getSize(widthMeasureSpec)
                // A wrap_content row never measures wider than the screen; it squeezes its
                // children, so the fit is judged from their natural widths.
                val hidden = mutableSetOf<View>()
                for (view in collapsibles) {
                    val width =
                        naturalRowWidth { child ->
                            if (child in collapsibles) child !in hidden
                            else child.visibility != View.GONE
                        }
                    if (width <= available) break
                    hidden += view
                }
                collapsibles.forEach {
                    it.visibility = if (it in hidden) View.GONE else View.VISIBLE
                }
            }
            super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        }
    }

    private companion object {
        const val TAG = "DoomMeterOverlay"
        const val MIN_TOUCH_TARGET_DP = 48f
        const val DUR_FAST = 120L
        const val DUR_BASE = 200L
        const val DUR_PANEL_ENTER = 220L
        const val DUR_PANEL_EXIT = 150L
        const val PRESSED_ALPHA = 0.7f
    }
}
