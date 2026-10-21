package com.doommeter.detection

import org.junit.Assert.assertEquals
import org.junit.Test

class ServiceCommandTest {
    @Test
    fun `a plain start shows the notification`() {
        assertEquals(ServiceCommand.SHOW, ServiceCommand.of(null, running = false))
        assertEquals(ServiceCommand.SHOW, ServiceCommand.of(null, running = true))
    }

    @Test
    fun `stop stops the service`() {
        assertEquals(ServiceCommand.STOP, ServiceCommand.of(DetectionForegroundService.ACTION_STOP, running = true))
    }

    @Test
    fun `a dismissed notification is shown again while the service is running`() {
        assertEquals(ServiceCommand.SHOW, ServiceCommand.of(DetectionForegroundService.ACTION_DISMISSED, running = true))
    }

    @Test
    fun `a late dismissal after the service was stopped does not bring it back`() {
        assertEquals(ServiceCommand.STOP, ServiceCommand.of(DetectionForegroundService.ACTION_DISMISSED, running = false))
    }
}
