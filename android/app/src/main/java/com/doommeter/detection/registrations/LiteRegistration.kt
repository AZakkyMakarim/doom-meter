package com.doommeter.detection.registrations

import com.doommeter.detection.PlatformAdapter
import com.doommeter.detection.adapters.LiteAdapters

/** Registration point for the Lite apps, each reporting under its parent Platform (doom-meter-0fn.5). */
object LiteRegistration {
    fun adapters(): List<PlatformAdapter> = LiteAdapters.all()
}
