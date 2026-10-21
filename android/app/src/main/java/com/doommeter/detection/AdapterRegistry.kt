package com.doommeter.detection

import com.doommeter.detection.registrations.FacebookRegistration
import com.doommeter.detection.registrations.InstagramRegistration
import com.doommeter.detection.registrations.TikTokRegistration
import com.doommeter.detection.registrations.YouTubeRegistration

/**
 * Every Platform adapter the service listens for. Each Platform has its own one-line file in
 * `registrations/`, so tickets that add Platforms edit different files and never conflict here.
 * This file does not change when a Platform is added.
 */
object AdapterRegistry {
    /** Android package name to engine Platform id, for every registered adapter. */
    val platformByPackage: Map<String, String> by lazy {
        adapters.flatMap { adapter -> adapter.packageNames.map { it to adapter.platform } }.toMap()
    }

    val adapters: List<PlatformAdapter> by lazy {
        listOfNotNull(
            TikTokRegistration.adapter(),
            InstagramRegistration.adapter(),
            YouTubeRegistration.adapter(),
            FacebookRegistration.adapter(),
        )
    }
}
