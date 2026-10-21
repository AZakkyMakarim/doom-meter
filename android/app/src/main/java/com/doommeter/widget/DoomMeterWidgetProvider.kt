package com.doommeter.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import com.doommeter.MainActivity
import com.doommeter.R
import org.json.JSONObject

/**
 * The Home widget. JavaScript owns every rule and text (see src/widget/widgetViewModel.ts);
 * this draws the saved view model, so it is right after a restart without the app running.
 */
class DoomMeterWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) manager.updateAppWidget(id, build(context))
        scheduleDayEnd(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_DAY_END) refreshAll(context)
    }

    companion object {
        private const val TAG = "DoomMeterWidget"
        private const val ACTION_DAY_END = "com.doommeter.widget.DAY_END"

        /** Redraws every placed widget from the saved view model. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, DoomMeterWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val views = build(context)
            for (id in ids) manager.updateAppWidget(id, views)
            scheduleDayEnd(context)
        }

        private fun build(context: Context): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_home)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(
                    context,
                    0,
                    Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ),
            )
            val json = WidgetStore.load(context)
            try {
                if (json != null) {
                    val model = JSONObject(json)
                    val over = WidgetDay.isOver(model.getLong("dayEndsAt"), System.currentTimeMillis())
                    draw(context, views, model.getJSONObject(if (over) "emptyFace" else "face"))
                    return views
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not read the saved widget data", e)
            }
            // Nothing saved yet (just added, before the app ever ran): the layout's own empty state.
            draw(context, views, null)
            return views
        }

        private fun draw(context: Context, views: RemoteViews, face: JSONObject?) {
            val avatar = face?.getString("avatar") ?: "mood_0_vibing"
            views.setImageViewResource(
                R.id.widget_avatar,
                context.resources.getIdentifier(avatar, "drawable", context.packageName),
            )
            views.setTextViewText(
                R.id.widget_title,
                face?.getString("title") ?: context.getString(R.string.widget_empty),
            )
            if (face != null) views.setTextColor(R.id.widget_title, Color.parseColor(face.getString("accentColor")))
            // The empty state has no numbers (null in the JSON).
            val has = face != null && !face.isNull("countText")
            views.setViewVisibility(R.id.widget_stats, if (has) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.widget_time, if (has) View.VISIBLE else View.GONE)
            if (has && face != null) {
                views.setTextViewText(R.id.widget_count, face.getString("countText"))
                views.setTextViewText(R.id.widget_unit, face.getString("unitText"))
                views.setTextViewText(R.id.widget_time, face.getString("timeText"))
            }
            views.setContentDescription(
                R.id.widget_root,
                face?.getString("contentDescription") ?: context.getString(R.string.widget_empty),
            )
        }

        /**
         * Redraws once when the Day ends, so a new Day shows without the app. An inexact alarm
         * is enough: no permission, and a few minutes late is fine.
         */
        private fun scheduleDayEnd(context: Context) {
            val json = WidgetStore.load(context) ?: return
            val dayEndsAt =
                try {
                    JSONObject(json).getLong("dayEndsAt")
                } catch (e: Exception) {
                    return
                }
            val at = WidgetDay.nextRefreshAt(dayEndsAt, System.currentTimeMillis()) ?: return
            val intent =
                Intent(context, DoomMeterWidgetProvider::class.java).setAction(ACTION_DAY_END)
            val pending =
                PendingIntent.getBroadcast(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager)
                .set(AlarmManager.RTC, at, pending)
        }
    }
}
