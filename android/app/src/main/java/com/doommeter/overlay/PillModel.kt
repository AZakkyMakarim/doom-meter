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
    val avatar: String,
    val accentColor: Int,
    val borderColor: Int,
    val borderWidthDp: Float,
    val heightDp: Float,
    val countSizeSp: Float,
    val avatarSizeDp: Float,
    val pulseMs: Long?,
    val surfaceColor: Int,
    val textColor: Int,
    val mutedTextColor: Int,
    val contentDescription: String,
    val tierAnnouncement: String,
    val tierChange: String,
    val haptic: String,
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
                avatar = o.getString("avatar"),
                accentColor = Color.parseColor(o.getString("accentColor")),
                borderColor = Color.parseColor(o.getString("borderColor")),
                borderWidthDp = o.getDouble("borderWidthDp").toFloat(),
                heightDp = o.getDouble("heightDp").toFloat(),
                countSizeSp = o.getDouble("countSizeSp").toFloat(),
                avatarSizeDp = o.getDouble("avatarSizeDp").toFloat(),
                pulseMs = if (o.isNull("pulseMs")) null else o.getLong("pulseMs"),
                surfaceColor = Color.parseColor(o.getString("surfaceColor")),
                textColor = Color.parseColor(o.getString("textColor")),
                mutedTextColor = Color.parseColor(o.getString("mutedTextColor")),
                contentDescription = o.getString("contentDescription"),
                tierAnnouncement = o.getString("tierAnnouncement"),
                tierChange = o.getString("tierChange"),
                haptic = o.getString("haptic"),
            )
        }
    }
}
