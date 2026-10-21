package com.doommeter.lockout

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import com.doommeter.R
import org.json.JSONObject

/**
 * The block screen (ADR 0007): the Tier face, "Blocked until HH:MM" and one button to Home. It
 * draws the saved view model (see src/lockout/lockoutViewModel.ts) and has no way to unlock.
 */
class LockoutBlockActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.lockout_block)
        findViewById<Button>(R.id.lockout_back).setOnClickListener { goHome() }
        bind()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        bind()
    }

    /** Back must not return to the blocked app underneath. */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() = goHome()

    /** Leaving by any other route (Home gesture, Recents) also ends the screen, so it never lingers. */
    override fun onStop() {
        super.onStop()
        finish()
    }

    private fun bind() {
        try {
            val json = LockoutStore.load(this)
            if (json == null || LockoutStore.endsAt(this) <= System.currentTimeMillis()) {
                finish()
                return
            }
            val model = JSONObject(json)
            val title = findViewById<TextView>(R.id.lockout_title)
            title.text = model.getString("title")
            title.setTextColor(Color.parseColor(model.getString("accentColor")))
            // One spoken sentence for the face, the Tier and the end time.
            title.contentDescription = model.getString("contentDescription")
            findViewById<TextView>(R.id.lockout_until).apply {
                text = model.getString("untilText")
                typeface = digitsFont(this@LockoutBlockActivity)
            }
            findViewById<Button>(R.id.lockout_back).text = model.getString("backText")
            findViewById<ImageView>(R.id.lockout_avatar).setImageResource(
                resources.getIdentifier(model.getString("avatar"), "drawable", packageName),
            )
        } catch (e: Exception) {
            // Without a readable copy there is nothing to show; the Lockout still blocks.
            Log.w(TAG, "Could not read the saved Lockout", e)
            goHome()
        }
    }

    private fun goHome() {
        startActivity(
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        finish()
    }

    companion object {
        private const val TAG = "DoomMeterLockout"

        /** The intent the AccessibilityService uses to cover a blocked app. */
        fun intent(context: Context): Intent =
            Intent(context, LockoutBlockActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)

        private fun digitsFont(context: Context): Typeface =
            try {
                Typeface.createFromAsset(context.assets, "fonts/JetBrainsMono-Bold.ttf")
            } catch (e: Exception) {
                Typeface.MONOSPACE
            }
    }
}
