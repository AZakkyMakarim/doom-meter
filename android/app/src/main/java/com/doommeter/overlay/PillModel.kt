package com.doommeter.overlay

import android.graphics.Color
import org.json.JSONObject

/**
 * What the pill draws, parsed from the JSON view model that JavaScript derives from the
 * Counting engine. Native holds no domain or design rules; it only renders this.
 */
data class PillModel(
    val tier: Int,
    val countText: String,
    val unitText: String,
    val timeText: String,
    val labelText: String,
    /** Spoken as the pill's state while the panel is closed. */
    val collapsedLabel: String,
    val avatar: String,
    val accentColor: Int,
    val accentDotColor: Int,
    val cornerRadiusDp: Float,
    val verticalPaddingDp: Float,
    val heightDp: Float,
    val countSizeSp: Float,
    val avatarSizeDp: Float,
    val pulseMs: Long?,
    val motion: MotionFlags,
    val surfaceColor: Int,
    val textColor: Int,
    val mutedTextColor: Int,
    val contentDescription: String,
    val tierAnnouncement: String,
    /** Spoken now: only set on a Tier change, never for a new video (MASTER 8). */
    val announcement: String?,
    val tierChange: String,
    val haptic: String,
    val compact: Boolean,
    val dragRangeDp: Float,
    /** Where the pill sits below its top anchor, from Settings (and the last drag, saved by JS). */
    val positionDp: Float,
    val panel: PanelModel,
) {
    companion object {
        fun parse(json: String): PillModel {
            val o = JSONObject(json)
            return PillModel(
                tier = o.getInt("tier"),
                countText = o.getString("countText"),
                unitText = o.getString("unitText"),
                timeText = o.getString("timeText"),
                labelText = o.getString("labelText"),
                collapsedLabel = o.optString("collapsedLabel", "Collapsed"),
                avatar = o.getString("avatar"),
                accentColor = Color.parseColor(o.getString("accentColor")),
                accentDotColor = Color.parseColor(o.getString("accentDotColor")),
                cornerRadiusDp = o.getDouble("cornerRadiusDp").toFloat(),
                verticalPaddingDp = o.getDouble("verticalPaddingDp").toFloat(),
                heightDp = o.getDouble("heightDp").toFloat(),
                countSizeSp = o.getDouble("countSizeSp").toFloat(),
                avatarSizeDp = o.getDouble("avatarSizeDp").toFloat(),
                pulseMs = if (o.isNull("pulseMs")) null else o.getLong("pulseMs"),
                motion = MotionFlags.parse(o.getJSONObject("motion")),
                surfaceColor = Color.parseColor(o.getString("surfaceColor")),
                textColor = Color.parseColor(o.getString("textColor")),
                mutedTextColor = Color.parseColor(o.getString("mutedTextColor")),
                contentDescription = o.getString("contentDescription"),
                tierAnnouncement = o.getString("tierAnnouncement"),
                announcement = if (o.isNull("announcement")) null else o.getString("announcement"),
                tierChange = o.getString("tierChange"),
                haptic = o.getString("haptic"),
                compact = o.getBoolean("compact"),
                dragRangeDp = o.getDouble("dragRangeDp").toFloat(),
                positionDp = o.getDouble("positionDp").toFloat(),
                panel = PanelModel.parse(o.getJSONObject("panel")),
            )
        }
    }
}

/**
 * Which animations may play (MASTER 7). JavaScript turns them all off under reduced motion;
 * the haptic is separate and is kept.
 */
data class MotionFlags(
    val pulse: Boolean,
    val numberRoll: Boolean,
    val scalePop: Boolean,
    val panelGrow: Boolean,
) {
    companion object {
        fun parse(o: JSONObject) =
            MotionFlags(
                pulse = o.getBoolean("pulse"),
                numberRoll = o.getBoolean("numberRoll"),
                scalePop = o.getBoolean("scalePop"),
                panelGrow = o.getBoolean("panelGrow"),
            )
    }
}

/** The expanded panel (MASTER 6.2), parsed from the same JSON. */
data class PanelModel(
    val avatar: String,
    val avatarSizeDp: Float,
    val tierName: String,
    val accentColor: Int,
    val countText: String,
    val unitText: String,
    val timeText: String,
    val dayText: String,
    val closeLabel: String,
    val rows: List<PlatformRow>,
    val surfaceColor: Int,
    val rowColor: Int,
    val chipTextColor: Int,
    val textColor: Int,
    val mutedTextColor: Int,
    val widthDp: Float,
    val landscapeMaxHeightFraction: Float,
    val contentDescription: String,
) {
    data class PlatformRow(
        val label: String,
        val color: Int,
        val countText: String,
        val unitText: String,
        val timeText: String,
        val percent: Int,
        val percentText: String,
        val contentDescription: String,
    )

    companion object {
        fun parse(o: JSONObject): PanelModel {
            val rowsJson = o.getJSONArray("rows")
            val rows =
                List(rowsJson.length()) { i ->
                    val r = rowsJson.getJSONObject(i)
                    PlatformRow(
                        label = r.getString("label"),
                        color = Color.parseColor(r.getString("color")),
                        countText = r.getString("countText"),
                        unitText = r.getString("unitText"),
                        timeText = r.getString("timeText"),
                        percent = r.getInt("percent"),
                        percentText = r.getString("percentText"),
                        contentDescription = r.getString("contentDescription"),
                    )
                }
            return PanelModel(
                avatar = o.getString("avatar"),
                avatarSizeDp = o.getDouble("avatarSizeDp").toFloat(),
                tierName = o.getString("tierName"),
                accentColor = Color.parseColor(o.getString("accentColor")),
                countText = o.getString("countText"),
                unitText = o.getString("unitText"),
                timeText = o.getString("timeText"),
                dayText = o.getString("dayText"),
                closeLabel = o.getString("closeLabel"),
                rows = rows,
                surfaceColor = Color.parseColor(o.getString("surfaceColor")),
                rowColor = Color.parseColor(o.getString("rowColor")),
                chipTextColor = Color.parseColor(o.getString("chipTextColor")),
                textColor = Color.parseColor(o.getString("textColor")),
                mutedTextColor = Color.parseColor(o.getString("mutedTextColor")),
                widthDp = o.getDouble("widthDp").toFloat(),
                landscapeMaxHeightFraction = o.getDouble("landscapeMaxHeightFraction").toFloat(),
                contentDescription = o.getString("contentDescription"),
            )
        }
    }
}
