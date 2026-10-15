package com.doommeter.overlay

import android.content.Context
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout

/**
 * Helpers that keep the count and time from truncating at the largest system font scale
 * (MASTER 4, 8). A wrap_content row measured at most as wide as the screen squeezes its
 * children instead of growing past it, so overflow has to be judged from the children's
 * natural widths, not from the row's own measured width.
 *
 * Visibility and orientation are only touched when they must change: changing them inside
 * onMeasure requests a new layout, and doing it on every pass would never settle.
 */

/** The width [child] wants, ignoring the space the parent has to give. */
internal fun naturalWidthOf(child: View): Int {
    val lp = child.layoutParams
    val width =
        if (lp != null && lp.width >= 0) {
            View.MeasureSpec.makeMeasureSpec(lp.width, View.MeasureSpec.EXACTLY)
        } else {
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        }
    child.measure(width, View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
    return child.measuredWidth
}

/** Padding plus the natural width and margins of every child for which [shown] is true. */
internal fun LinearLayout.naturalRowWidth(shown: (View) -> Boolean): Int {
    var total = paddingLeft + paddingRight
    for (i in 0 until childCount) {
        val child = getChildAt(i)
        if (!shown(child)) continue
        val margins = child.layoutParams as? ViewGroup.MarginLayoutParams
        total += naturalWidthOf(child) + (margins?.marginStart ?: 0) + (margins?.marginEnd ?: 0)
    }
    return total
}

/**
 * A row that stacks its children vertically when they no longer fit side by side, like the
 * button bar in an alert dialog. [spacer] is the flexible gap that pushes the last child to
 * the end; it is hidden while stacked. Each child after the first is [hGap] from the one
 * before it in a row and [vGap] below it when stacked.
 */
internal class WrapRow(
    context: Context,
    private val hGap: Int,
    private val vGap: Int,
    private val stackedGravity: Int = Gravity.START,
    private val spacer: View? = null,
) : LinearLayout(context) {
    private var stacked: Boolean? = null

    init {
        gravity = Gravity.CENTER_VERTICAL
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        if (MeasureSpec.getMode(widthMeasureSpec) == MeasureSpec.UNSPECIFIED) {
            // A parent asking for the natural width must not flip the state it settles on.
            if (stacked == null) applyStacked(false)
        } else {
            var total = paddingLeft + paddingRight
            var seen = 0
            for (i in 0 until childCount) {
                val child = getChildAt(i)
                if (child === spacer) continue
                total += naturalWidthOf(child) + if (seen > 0) hGap else 0
                seen += 1
            }
            applyStacked(total > MeasureSpec.getSize(widthMeasureSpec))
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    private fun applyStacked(value: Boolean) {
        if (stacked == value) return
        stacked = value
        orientation = if (value) VERTICAL else HORIZONTAL
        gravity = if (value) stackedGravity else Gravity.CENTER_VERTICAL
        spacer?.visibility = if (value) View.GONE else View.VISIBLE
        var first = true
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child === spacer) continue
            val lp = child.layoutParams as MarginLayoutParams
            lp.marginStart = if (first || value) 0 else hGap
            lp.topMargin = if (first || !value) 0 else vGap
            first = false
        }
    }
}
