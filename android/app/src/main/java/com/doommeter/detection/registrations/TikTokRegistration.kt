package com.doommeter.detection.registrations

import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.adapters.TikTokAdapter

/** Registration point for TikTok (For You and Following). */
object TikTokRegistration {
    fun adapter(): PlatformAdapter? = TikTokAdapter()
}
