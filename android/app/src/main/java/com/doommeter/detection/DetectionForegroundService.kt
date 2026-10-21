package com.doommeter.detection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import com.doommeter.MainActivity
import com.doommeter.R

/**
 * Keeps the DoomMeter process alive while detection is on, so the Counting engine and the
 * Overlay pill keep running when the app is in the background. It does no detection itself.
 */
class DetectionForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        DetectionHub.ensureReact(application)
        return START_STICKY
    }

    @Suppress("DEPRECATION")
    private fun buildNotification(): Notification {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val builder =
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        getString(R.string.detection_channel_name),
                        NotificationManager.IMPORTANCE_LOW,
                    ),
                )
                Notification.Builder(this, CHANNEL_ID)
            } else {
                Notification.Builder(this)
            }
        val open =
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        return builder
            .setSmallIcon(R.drawable.ic_stat_doommeter)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.detection_notification_text))
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val ACTION_STOP = "com.doommeter.detection.STOP"
        private const val CHANNEL_ID = "detection"
        private const val NOTIFICATION_ID = 1
    }
}
