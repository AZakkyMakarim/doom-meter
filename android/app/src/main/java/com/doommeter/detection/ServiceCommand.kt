package com.doommeter.detection

/** What [DetectionForegroundService] does with a start command. */
enum class ServiceCommand {
    SHOW,
    STOP,
    ;

    companion object {
        fun of(
            action: String?,
            running: Boolean,
        ): ServiceCommand =
            when (action) {
                DetectionForegroundService.ACTION_STOP -> STOP
                // A swipe that lands after Stop must not bring the service back.
                DetectionForegroundService.ACTION_DISMISSED -> if (running) SHOW else STOP
                else -> SHOW
            }
    }
}
