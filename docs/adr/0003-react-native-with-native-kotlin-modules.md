# React Native for UI, native Kotlin modules for overlay and detection

The in-app screens (Today, History, Settings) are written in React Native. The Overlay pill (on top of `WindowManager`) and the AccessibilityService are written in native Kotlin, since neither can run from the JS layer.

Accepted trade-off: an extra bridge layer for an Android-only app, in exchange for the JS ecosystem for fonts, icons (Phosphor), and charts, and an open door should other platforms be considered later (see 0001). Alternatives weighed: full Kotlin + Compose, and Flutter.
