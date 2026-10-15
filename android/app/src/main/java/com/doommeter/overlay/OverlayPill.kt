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
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The Overlay pill: a small opaque pill drawn over other apps, centered below the status bar
 * and cutout. Follows design-system/doommeter/MASTER.md sections 2, 3, 4, 6.1 and 7.
 *
 * Main thread only. The window is sized to the pill, so touches outside it fall through to the
 * app underneath (FLAG_NOT_TOUCH_MODAL).
 */
class OverlayPill(context: Context) {
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

    private val configCallbacks =
        object : ComponentCallbacks {
            override fun onConfigurationChanged(newConfig: Configuration) {
                root?.post { positionWindow() }
            }

            override fun onLowMemory() = Unit
        }

    private class Views(
        val pill: PillLayout,
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
        apply(model, v, animate = !firstDraw)
        if (!firstDraw && model.tierChange != "none") {
            root?.announceForAccessibility(model.tierAnnouncement)
        }
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
        pill.collapsible = unit

        val container = FrameLayout(appContext)
        container.minimumHeight = dp(MIN_TOUCH_TARGET_DP)
        container.addView(
            pill,
            FrameLayout.LayoutParams(-2, -2, Gravity.CENTER),
        )
        container.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        container.accessibilityDelegate =
            object : View.AccessibilityDelegate() {
                override fun onInitializeAccessibilityNodeInfo(
                    host: View,
                    info: AccessibilityNodeInfo,
                ) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.className = "android.widget.Button"
                }
            }

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
                y = topInsetPx() + dp(8f)
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
        views = Views(pill, background, avatarHolder, avatar, count, unit, dot, time, label)
        appContext.registerComponentCallbacks(configCallbacks)
        return true
    }

    private fun apply(model: PillModel, v: Views, animate: Boolean) {
        val motion = animate && !reducedMotion()
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
        root?.contentDescription = model.contentDescription

        // Count: a 120ms roll on change (opacity and translate only), nothing for time.
        if (v.count.text.toString() != model.countText) {
            if (motion) rollCount(v.count, model.countText) else setCountNow(v.count, model.countText)
        }

        // Border: 200ms crossfade on a Tier change, instant otherwise.
        val widthPx = max(1, (model.borderWidthDp * density).roundToInt())
        borderAnimator?.cancel()
        if (motion && model.tierChange != "none" && currentBorderColor != 0) {
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
            if (motion) popAvatar(v.avatar) else resetAvatar(v.avatar)
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
        val period = if (reducedMotion()) null else model.pulseMs
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

    private fun positionWindow() {
        val lp = params ?: return
        val r = root ?: return
        lp.y = topInsetPx() + dp(8f)
        try {
            windowManager.updateViewLayout(r, lp)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Pill was already removed", e)
        }
    }

    /** Status bar or camera cutout height, whichever is larger, so the pill is never hidden. */
    private fun topInsetPx(): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val insets =
                windowManager.currentWindowMetrics.windowInsets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.statusBars() or WindowInsets.Type.displayCutout(),
                )
            return insets.top
        }
        val res = appContext.resources
        val id = res.getIdentifier("status_bar_height", "dimen", "android")
        return if (id > 0) res.getDimensionPixelSize(id) else 0
    }

    private fun reducedMotion(): Boolean =
        Settings.Global.getFloat(
            appContext.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f

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
     * "videos" unit first so the count, time and face are never truncated.
     */
    private class PillLayout(context: Context) : LinearLayout(context) {
        var collapsible: View? = null

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            collapsible?.visibility = View.VISIBLE
            super.onMeasure(widthMeasureSpec, heightMeasureSpec)
            val available = MeasureSpec.getSize(widthMeasureSpec)
            if (MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.UNSPECIFIED &&
                measuredWidth > available
            ) {
                collapsible?.visibility = View.GONE
                super.onMeasure(widthMeasureSpec, heightMeasureSpec)
            }
        }
    }

    private companion object {
        const val TAG = "DoomMeterOverlay"
        const val MIN_TOUCH_TARGET_DP = 48f
        const val DUR_FAST = 120L
        const val DUR_BASE = 200L
    }
}
