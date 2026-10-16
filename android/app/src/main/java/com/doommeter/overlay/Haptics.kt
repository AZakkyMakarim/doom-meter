package com.doommeter.overlay

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Haptic on entering a Tier (MASTER 2.2): none, light, medium, heavy, heavy x2. */
object Haptics {
    fun fire(context: Context, kind: String) {
        val vibrator = vibratorFor(context) ?: return
        if (!vibrator.hasVibrator()) return
        when (kind) {
            "light" -> oneShot(vibrator, 15, 80)
            "medium" -> oneShot(vibrator, 30, 160)
            "heavy" -> oneShot(vibrator, 50, 255)
            "heavyDouble" -> waveform(vibrator, longArrayOf(0, 50, 90, 50), intArrayOf(0, 255, 0, 255))
        }
    }

    private fun vibratorFor(context: Context): Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)
                ?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

    private fun oneShot(vibrator: Vibrator, ms: Long, amplitude: Int) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(ms, amplitude))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(ms)
        }
    }

    private fun waveform(vibrator: Vibrator, timings: LongArray, amplitudes: IntArray) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(timings, -1)
        }
    }
}
