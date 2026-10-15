# Detection via AccessibilityService

Instagram, YouTube, and TikTok offer no official API to learn which video is being watched. We use an AccessibilityService to read UI events and derive Watched videos and the active Short-form surface. UsageStats is used only as a Watch time fallback when detection fails.

Accepted trade-offs: the permission is highly sensitive, Google Play restricts AccessibilityService use, and UI selectors can break whenever a target app updates. To limit the exposure, only aggregates are stored (no content or video titles), no data ever leaves the device, and days with failed detection are marked "incomplete" in History.

Rejected alternatives: manual input (makes no sense for this product) and UsageStats alone (cannot count videos).
