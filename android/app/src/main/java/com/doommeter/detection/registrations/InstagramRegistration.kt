package com.doommeter.detection.registrations

import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.adapters.InstagramAdapter

/** Registration point for Instagram Reels (doom-meter-v9k.5). */
object InstagramRegistration {
    fun adapter(): PlatformAdapter? = InstagramAdapter()
}
