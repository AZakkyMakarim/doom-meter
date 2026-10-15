package com.doommeter.detection

/**
 * A simplified, Android-free copy of an accessibility node tree. Adapters read this instead of
 * AccessibilityNodeInfo, so their selector logic is a pure function that unit tests can feed
 * with fixtures.
 *
 * The snapshot is transient: it is built, inspected and dropped within one evaluation. Text and
 * descriptions are only ever matched against fixed labels or hashed; they are never stored,
 * logged or sent anywhere (ADR 0002: only aggregates are kept).
 */
data class NodeSnapshot(
    /** Resource id such as `com.app:id/title`, when the app exposes one. */
    val viewId: String? = null,
    val className: String? = null,
    val text: String? = null,
    val contentDescription: String? = null,
    val isSelected: Boolean = false,
    val isVisibleToUser: Boolean = true,
    val children: List<NodeSnapshot> = emptyList(),
)
