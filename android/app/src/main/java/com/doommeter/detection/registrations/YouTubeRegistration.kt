package com.doommeter.detection.registrations

import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.adapters.YouTubeAdapter

/** Registration point for YouTube Shorts. */
object YouTubeRegistration {
    fun adapter(): PlatformAdapter? = YouTubeAdapter()
}
