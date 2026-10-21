package com.doommeter.lockout

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LockoutGateTest {
    private val now = 10_000L
    private val later = 20_000L

    @Test
    fun `every Platform app is blocked while the Lockout runs`() {
        for (pkg in listOf(
            "com.instagram.android",
            "com.google.android.youtube",
            "com.zhiliaoapp.musically",
            "com.facebook.katana",
        )) {
            assertTrue(pkg, LockoutGate.shouldBlock(pkg, later, now))
        }
    }

    @Test
    fun `the Lite apps are blocked too`() {
        assertTrue(LockoutGate.shouldBlock("com.instagram.lite", later, now))
        assertTrue(LockoutGate.shouldBlock("com.facebook.lite", later, now))
    }

    @Test
    fun `an app that is not a Platform is left alone`() {
        assertFalse(LockoutGate.shouldBlock("com.android.settings", later, now))
        assertFalse(LockoutGate.shouldBlock("com.doommeter", later, now))
        assertFalse(LockoutGate.shouldBlock(null, later, now))
    }

    @Test
    fun `apps open normally from the moment the Lockout ends`() {
        assertTrue(LockoutGate.shouldBlock("com.instagram.android", endsAt = now + 1, now = now))
        assertFalse(LockoutGate.shouldBlock("com.instagram.android", endsAt = now, now = now))
        assertFalse(LockoutGate.shouldBlock("com.instagram.android", endsAt = now - 1, now = now))
    }

    @Test
    fun `no saved Lockout blocks nothing`() {
        assertFalse(LockoutGate.shouldBlock("com.instagram.android", LockoutGate.NONE, now))
    }
}
