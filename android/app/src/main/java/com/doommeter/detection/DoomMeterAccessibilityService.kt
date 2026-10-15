package com.doommeter.detection

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * The one AccessibilityService for every Platform (ADR 0002). It reads the active window, asks
 * the matching [PlatformAdapter] what it sees, and forwards the resulting raw events to
 * JavaScript through [DetectionHub]. It holds no counting rules and keeps no content.
 */
class DoomMeterAccessibilityService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var tracker: SurfaceTracker
    private var evaluationScheduled = false
    private var disconnectedEmitted = false

    private val evaluate = Runnable {
        evaluationScheduled = false
        evaluateActiveWindow()
    }

    private val screenReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    Intent.ACTION_SCREEN_ON -> emitScreen(RawEvent.SCREEN_ON)
                    Intent.ACTION_SCREEN_OFF -> emitScreen(RawEvent.SCREEN_OFF)
                }
            }
        }
    private var receiverRegistered = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        tracker =
            SurfaceTracker(
                adapters = AdapterRegistry.adapters,
                now = System::currentTimeMillis,
                // Our own overlay pill and the system shade must not end a surface.
                ignoredPackages = setOf(packageName, SYSTEM_UI),
                emit = DetectionHub::emit,
            )
        DetectionHub.ensureReact(application)
        disconnectedEmitted = false
        DetectionHub.emit(
            RawEvent(type = RawEvent.ACCESSIBILITY_CONNECTED, at = System.currentTimeMillis()),
        )

        registerReceiver(
            screenReceiver,
            IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_SCREEN_OFF)
            },
        )
        receiverRegistered = true
        val power = getSystemService(Context.POWER_SERVICE) as PowerManager
        emitScreen(if (power.isInteractive) RawEvent.SCREEN_ON else RawEvent.SCREEN_OFF)
        scheduleEvaluation(0)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        when (event?.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> scheduleEvaluation(EVALUATE_DELAY_MS)
        }
    }

    override fun onInterrupt() {
        if (::tracker.isInitialized) tracker.reset()
    }

    override fun onUnbind(intent: Intent?): Boolean {
        // The user switched the service off (or the system stopped it).
        emitDisconnected()
        return super.onUnbind(intent)
    }

    /**
     * Tells JavaScript the service is gone, naming the Platform app that was in the foreground.
     * JavaScript decides what that means for the Day; this only reports the fact, once.
     */
    private fun emitDisconnected() {
        if (disconnectedEmitted) return
        disconnectedEmitted = true
        val platform = if (::tracker.isInitialized) tracker.foregroundPlatform else null
        DetectionHub.emit(
            RawEvent(
                type = RawEvent.ACCESSIBILITY_DISCONNECTED,
                platform = platform,
                at = System.currentTimeMillis(),
            ),
        )
    }

    override fun onDestroy() {
        emitDisconnected()
        handler.removeCallbacks(evaluate)
        if (::tracker.isInitialized) tracker.reset()
        if (receiverRegistered) {
            unregisterReceiver(screenReceiver)
            receiverRegistered = false
        }
        super.onDestroy()
    }

    /** Coalesce bursts of events into one evaluation. */
    private fun scheduleEvaluation(delayMs: Long) {
        if (evaluationScheduled) return
        evaluationScheduled = true
        handler.postDelayed(evaluate, delayMs)
    }

    private fun evaluateActiveWindow() {
        if (!::tracker.isInitialized) return
        val root = rootInActiveWindow ?: return
        try {
            val recheck =
                tracker.onWindow(root.packageName?.toString()) { NodeSnapshots.from(root) }
            if (recheck) scheduleEvaluation(CONFIRM_DELAY_MS)
        } catch (e: Exception) {
            // Detection must never crash the service.
            Log.w(TAG, "Could not evaluate the window", e)
        } finally {
            @Suppress("DEPRECATION") root.recycle()
        }
    }

    private fun emitScreen(type: String) =
        DetectionHub.emit(RawEvent(type = type, at = System.currentTimeMillis()))

    companion object {
        private const val TAG = "DoomMeterDetection"
        private const val SYSTEM_UI = "com.android.systemui"
        private const val EVALUATE_DELAY_MS = 100L
        private const val CONFIRM_DELAY_MS = 300L
    }
}

/** Copies a live AccessibilityNodeInfo tree into a [NodeSnapshot], within a size budget. */
internal object NodeSnapshots {
    private const val MAX_NODES = 600
    private const val MAX_DEPTH = 40
    private const val MAX_TEXT = 160

    fun from(root: AccessibilityNodeInfo): NodeSnapshot {
        val budget = intArrayOf(MAX_NODES)
        return copy(root, 0, budget)
    }

    private fun copy(node: AccessibilityNodeInfo, depth: Int, budget: IntArray): NodeSnapshot {
        budget[0] -= 1
        val children = ArrayList<NodeSnapshot>()
        if (depth < MAX_DEPTH) {
            for (i in 0 until node.childCount) {
                if (budget[0] <= 0) break
                val child = node.getChild(i) ?: continue
                try {
                    children.add(copy(child, depth + 1, budget))
                } finally {
                    @Suppress("DEPRECATION") child.recycle()
                }
            }
        }
        return NodeSnapshot(
            viewId = node.viewIdResourceName,
            className = node.className?.toString(),
            text = node.text?.toString()?.take(MAX_TEXT),
            contentDescription = node.contentDescription?.toString()?.take(MAX_TEXT),
            isSelected = node.isSelected,
            isVisibleToUser = node.isVisibleToUser,
            children = children,
        )
    }
}
