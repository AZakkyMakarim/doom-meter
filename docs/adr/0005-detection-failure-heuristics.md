# Detection failure is decided by two conservative rules, and costs the count, not the time

ADR 0002 says UsageStats covers Watch time when detection fails and that such Days are marked incomplete. This records how a failure is recognised and what the Counting engine does with it.

**Failure rules** (pure TypeScript, `src/detection/detectionHealth.ts`; native only reports facts):

1. *Service lost.* The AccessibilityService went away (switched off, crashed, revoked) while a Platform app was in the foreground, or a Platform app came to the foreground while the service was gone. The service names the Platform app it last saw in the foreground when it is unbound; with Usage Access, the UsageStats foreground fills the gap when the service was already gone. Recovers when the service reconnects or any surface is recognised again.
2. *Blind adapter.* The service is running, but a Platform app stayed in the foreground for 30 minutes with no recognised surface at all in that stretch. Recovers when a surface of that Platform is recognised.

Rejected: flagging on a shorter silence (ordinary browsing of Instagram's home feed or DMs looks identical to a broken adapter, and a false failure would then add non-feed time to Watch time), and probing the adapters for "expected" nodes (needs a per-app definition of healthy, which is the very thing that breaks).

**Engine behaviour while a Platform's detection is failed:** surface events from it are ignored, and the video in progress keeps its time but is not counted, so no count is invented. If Usage Access is granted, the Platform app's foreground time from UsageStats is added as Watch time, with no count. Without Usage Access nothing is counted and only the warning shows. The Day is marked incomplete for that Platform, and stays so after recovery; a new Day starts incomplete only if detection is still down.

Accepted trade-offs: UsageStats cannot tell the feed from the rest of the app, so Watch time added during a failure can include non-feed time in that app; the incomplete mark and the warning say as much. A failure that happens while the app process is dead, or while the service was off before DoomMeter started, is not detected; the missing-permission banner covers that case. UsageStats is polled every few seconds, so a stretch is timed by the system's own event timestamps, not by when it was read.
