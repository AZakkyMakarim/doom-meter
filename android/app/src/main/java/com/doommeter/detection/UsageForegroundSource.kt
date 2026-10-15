package com.doommeter.detection

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process

/** One foreground change of an app, as UsageStats reports it. */
data class UsageRecord(
    val packageName: String,
    val foreground: Boolean,
    val atMs: Long,
)

/**
 * Turns UsageStats foreground changes into raw events for the Platforms DoomMeter covers.
 * Pure Kotlin so it can be unit tested. It reports when a Platform app came to or left the
 * foreground and nothing else: whether that time counts is decided in the Counting engine,
 * which counts it only while video detection for that Platform is failing (ADR 0005).
 */
object UsageEventMapper {
    fun map(records: List<UsageRecord>, platformByPackage: Map<String, String>): List<RawEvent> =
        records
            .sortedBy { it.atMs }
            .mapNotNull { record ->
                val platform = platformByPackage[record.packageName] ?: return@mapNotNull null
                RawEvent(
                    type =
                        if (record.foreground) RawEvent.USAGE_FOREGROUND_STARTED
                        else RawEvent.USAGE_FOREGROUND_ENDED,
                    platform = platform,
                    at = record.atMs,
                )
            }

    /**
     * For a first look over a long window: the history inside it is not replayed, only the start
     * of each Platform app that is still in the foreground at the end, so an app that has been
     * open for longer than the poll cursor ever reached is not missed.
     */
    fun mapCurrentForeground(
        records: List<UsageRecord>,
        platformByPackage: Map<String, String>,
    ): List<RawEvent> {
        val lastByPackage = HashMap<String, UsageRecord>()
        for (record in records.sortedBy { it.atMs }) {
            if (record.packageName in platformByPackage) lastByPackage[record.packageName] = record
        }
        return map(lastByPackage.values.filter { it.foreground }, platformByPackage)
    }
}

/** Whether the user granted Usage Access to DoomMeter. */
object UsageAccess {
    @Suppress("DEPRECATION")
    fun isGranted(context: Context): Boolean {
        val ops = context.getSystemService(AppOpsManager::class.java) ?: return false
        val mode =
            if (Build.VERSION.SDK_INT >= 29) {
                ops.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName,
                )
            } else {
                ops.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName,
                )
            }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}

/**
 * Reads foreground changes of the Platform apps from UsageStatsManager, only when Usage Access
 * is granted. Each call returns what happened since the previous call. Holds no counting rules.
 */
class UsageForegroundSource(
    private val context: Context,
    private val platformByPackage: Map<String, String>,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private var cursor: Long? = null

    /** New foreground events since the last poll, oldest first; empty without Usage Access. */
    @Suppress("DEPRECATION")
    fun poll(): List<RawEvent> {
        if (!UsageAccess.isGranted(context)) {
            // Start fresh when access is granted later, instead of replaying old history.
            cursor = null
            return emptyList()
        }
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return emptyList()
        val end = now()
        val firstLook = cursor == null
        val begin = cursor ?: (end - FIRST_LOOKBACK_MS)
        val records = ArrayList<UsageRecord>()
        val events = manager.queryEvents(begin, end)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            if (pkg !in platformByPackage) continue
            // MOVE_TO_FOREGROUND and ACTIVITY_RESUMED share a value, as do the background pair.
            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> records.add(UsageRecord(pkg, true, event.timeStamp))
                UsageEvents.Event.MOVE_TO_BACKGROUND -> records.add(UsageRecord(pkg, false, event.timeStamp))
            }
        }
        // The window is [begin, end), so the next poll starts exactly where this one stopped.
        cursor = end
        return if (firstLook) {
            UsageEventMapper.mapCurrentForeground(records, platformByPackage)
        } else {
            UsageEventMapper.map(records, platformByPackage)
        }
    }

    private companion object {
        /**
         * On the first poll (and after the cursor resets), look back far enough to find an app
         * that has been in the foreground for a long time, not only one that just came forward.
         */
        const val FIRST_LOOKBACK_MS = 60 * 60_000L
    }
}
