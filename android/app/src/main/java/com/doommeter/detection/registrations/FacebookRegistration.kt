package com.doommeter.detection.registrations

import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.adapters.FacebookAdapter

/** Registration point for Facebook Reels (doom-meter-0fn.4). */
object FacebookRegistration {
    fun adapter(): PlatformAdapter? = FacebookAdapter()
}
