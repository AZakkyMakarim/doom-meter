# DoomMeter v1: QA test cases

Source of truth for the suite. Executable versions live in `.maestro/doommeter-v1/TC-xxx.yaml`
(Maestro, Android) and `.maestro/doommeter-v1/detection/` (adb-driven detection cases).
Ticket ids are `doom-meter-v9k.N` (epic `doom-meter-v9k`), written below as `.N`.

Platform: Android only (ADR 0001). TikTok cases are out of scope for this run (the target
emulator cannot run TikTok); they stay listed so the coverage matrix is complete.

## How the suite runs

- `.maestro/doommeter-v1/run-suite.sh [TC-xxx ...]` runs one flow at a time. Each flow starts with a
  header `# setup: a11y=on|off overlay=allow|deny usage=allow|deny font=1.0` that the runner applies
  with adb (Display over other apps, Usage access, Accessibility, font scale).
- **Accessibility under Maestro.** Maestro's driver (UiAutomation) unbinds every other
  AccessibilityService and clears `enabled_accessibility_services` when it connects. The runner
  re-asserts the setting while a flow runs, so the app reads "Accessibility on" and shows the
  correct UI, but the real service is not bound. Therefore **real video detection cannot be
  exercised inside a Maestro flow**. UI cases use the app's debug simulator ("Debug: simulate
  scrolling"), which feeds the same engine and pill as the real service. Detection cases against
  real apps (TC-07x) are driven with adb input events instead and read back with Maestro afterwards.
- Debug build only: the simulator, Metro bundle and `__DEV__` controls are part of the build under test.

## Cases

### TC-001: Fresh install opens on the welcome step with the privacy statement
- Covers: .11 (onboarding, privacy statement)
- Platform: android
- Type: smoke
- Priority: P0
- Preconditions: fresh app data; no permissions granted
- Steps:
  1. Launch the app.
  2. Tap Get started.
- Expected: "Welcome to DoomMeter", "Step 1 of 4" and the sentence "No data leaves your device" are visible; after Get started the Accessibility service step shows; no crash.

### TC-002: Onboarding separates required from optional permissions
- Covers: .11
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: fresh data; Overlay, Accessibility and Usage access all missing
- Steps:
  1. Get started, then walk each permission step with Not now / Skip.
- Expected: Accessibility service and Display over other apps carry "Required" and "Not granted yet"; Usage access carries "Optional" and a Skip button; each step repeats "No data leaves your device. Only counts are kept, on this phone."; each step has a button naming its settings screen.

### TC-003: App opens after skipping every permission and says it is not counting
- Covers: .11 (opens without required permissions, states it is not counting), .7
- Platform: android
- Type: smoke
- Priority: P0
- Preconditions: fresh data; no permissions
- Steps:
  1. Walk the onboarding with Not now / Skip.
- Expected: Today opens with a banner "DoomMeter is not counting. Turn on ..." with a Fix permission button and the empty state "Not counting yet"; History and Settings tabs are reachable.

### TC-004: A permission that is already granted shows Granted and Continue
- Covers: .11
- Platform: android
- Type: edge
- Priority: P2
- Preconditions: fresh data; Overlay and Usage access granted, Accessibility missing
- Steps:
  1. Get started, Not now on Accessibility.
- Expected: the Overlay step reads "Granted" with Continue and no Not now; Usage access step likewise.

### TC-005: Fix permission opens the Accessibility settings
- Covers: .11 (Fix permission opens the correct settings screen)
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: Overlay granted, Accessibility off
- Steps:
  1. Finish onboarding; on Today tap Fix permission in the banner "Turn on Accessibility service."
- Expected: the system Accessibility settings screen opens.

### TC-006: Fix permission opens Display over other apps settings when Overlay is missing
- Covers: .11
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: Accessibility on, Overlay revoked
- Steps:
  1. Open Today; read the banner; tap Fix permission.
- Expected: banner names "Display over other apps"; tapping opens the system overlay permission screen.

### TC-007: Skipping Usage Access leaves the app counting without a warning
- Covers: .11 edge case
- Platform: android
- Type: edge
- Priority: P2
- Preconditions: Accessibility on, Overlay granted, Usage access skipped
- Steps:
  1. Finish onboarding.
- Expected: no "not counting" banner, no Fix permission button on Today.

### TC-008: With every permission granted Today shows no permission warning
- Covers: .11
- Platform: android
- Type: smoke
- Priority: P0
- Preconditions: all three permissions on
- Steps:
  1. Finish onboarding.
- Expected: Today shows "No data yet" (empty state) and no banner or "Not counting yet".

### TC-010: First run with no data shows guidance and an Enable overlay action
- Covers: .7 edge case ("empty-state guidance and an enable-overlay button, not zeros or a blank chart")
- Platform: android
- Type: edge
- Priority: P2
- Preconditions: fresh data; all permissions on
- Steps:
  1. Finish onboarding and look at Today.
- Expected: "No data yet" with guidance and an "Enable overlay" button; no zero totals; the chart card says "No data yet".

### TC-011: Simulated scrolling shows the same numbers on Today and in the debug summary
- Covers: .3, .7 (numbers match the pill)
- Platform: android
- Type: smoke
- Priority: P0
- Preconditions: fresh data; all permissions on
- Steps:
  1. Scroll to "Debug: simulate scrolling", tap +10 videos, End simulated session.
  2. Scroll to the top of Today.
- Expected: debug summary reads "10 videos · <time> · Drifting"; Today shows 10 videos, tier Drifting and a "By platform" card.

### TC-012: Counts are unchanged after the app is force-stopped and reopened
- Covers: .7 (data survives restart)
- Platform: android
- Type: happy
- Priority: P0
- Preconditions: as TC-011
- Steps:
  1. +10 videos, End simulated session.
  2. Force-stop the app and reopen it.
- Expected: Today shows 10 videos and Drifting; not the empty state.

### TC-013: Per-platform breakdown lists Reels, Shorts and TikTok
- Covers: .7, .4
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: fresh data
- Steps:
  1. +10 videos (the simulator uses TikTok), End session, open Today.
- Expected: rows Reels and Shorts with "0 videos · 00:00", TikTok with the count and 100%.

### TC-014: No screen offers a manual reset
- Covers: .2 (no manual reset), glossary "Day"
- Platform: android
- Type: negative
- Priority: P2
- Preconditions: data present
- Steps:
  1. Look through Today, History and Settings.
- Expected: no control or text offering to reset or clear the day's counts.

### TC-020 to TC-023: Count Tier boundaries (videos)
- Covers: .2
- Platform: android
- Type: edge
- Priority: P1
- Preconditions: fresh data, default thresholds 10/30/60/120
- Steps:
  1. Add videos with the simulator to 9, 10 | 29, 30 | 59, 60 | 119, 120 (one case per pair).
- Expected: 9 Fresh, 10 Drifting | 29 Drifting, 30 Doomed | 59 Doomed, 60 Cooked | 119 Cooked, 120 Terminal.

### TC-024: Minutes Tier boundaries
- Covers: .2
- Platform: android
- Type: edge
- Priority: P1
- Preconditions: fresh data
- Steps:
  1. Add minutes to 5, 10, 25, 30, 55, 60, 115, 120 with +5 min / +30 min.
- Expected: Fresh, Drifting, Drifting, Doomed, Doomed, Cooked, Cooked, Terminal.

### TC-025: Tier is the higher of the videos Tier and the minutes Tier
- Covers: .2 edge case
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: fresh data
- Steps:
  1. +1 video, +30 min.
- Expected: Tier Doomed.

### TC-026: Many videos with little time still use the videos Tier
- Covers: .2
- Platform: android
- Type: edge
- Priority: P2
- Preconditions: fresh data
- Steps:
  1. +10 videos, +5 min.
- Expected: Tier Drifting.

### TC-030: Settings lists permission status with Fix permission for what is missing
- Covers: .10
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: Accessibility on, Overlay revoked
- Steps:
  1. Open Settings.
- Expected: Permissions card with Display over other apps (missing, Fix permission) and Accessibility service (On); Overlay, Tier thresholds, Day cards present.

### TC-031: Lowering the Drifting videos threshold to 5 changes the Tier on Today
- Covers: .10 verification step 1
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: fresh data
- Steps:
  1. Settings, set Drifting videos to 5, Save thresholds.
  2. Simulate 5 videos.
- Expected: no error; debug summary and Today show Drifting at 5 videos.

### TC-032: Thresholds that do not ascend are rejected
- Covers: .10 edge case
- Platform: android
- Type: negative
- Priority: P1
- Preconditions: fresh data
- Steps:
  1. Set Drifting videos to 50 (Doomed is 30), Save thresholds.
  2. Simulate 10 videos.
- Expected: message "Error: Tier thresholds for videos must ascend..." ; 10 videos is still Drifting (old values kept).

### TC-033: A rollover hour of 25 or an empty hour is rejected
- Covers: .10 edge case
- Platform: android
- Type: negative
- Priority: P1
- Preconditions: none
- Steps:
  1. Enter 25, Save rollover hour; clear the field, Save.
- Expected: "Error: Day rollover hour must be a whole number from 0 to 23." both times.

### TC-034: A valid rollover hour is saved and survives a restart
- Covers: .10, .2
- Platform: android
- Type: happy
- Priority: P2
- Preconditions: none
- Steps:
  1. Enter 6, Save rollover hour; restart the app; reopen Settings.
- Expected: Day card reads "A new Day starts at 06:00 local time".

### TC-035: Compact mode and Haptics toggles persist after a restart
- Covers: .10 (each setting persists)
- Platform: android
- Type: happy
- Priority: P2
- Preconditions: defaults
- Steps:
  1. Turn Compact mode on and Haptics off; restart; open Settings.
- Expected: Compact mode on, Haptics off, Show overlay pill still on.

### TC-036: Position Move down / Move up stay within the top region
- Covers: .10 (non-gesture position control), .9
- Platform: android
- Type: edge
- Priority: P2
- Preconditions: defaults
- Steps:
  1. Move down once, up once, then down 12 times.
- Expected: value text leaves and returns to "Top"; the control never leaves the allowed range and Move up stays available.

### TC-037: A saved threshold still applies after a restart
- Covers: .10
- Platform: android
- Type: happy
- Priority: P2
- Preconditions: fresh data
- Steps:
  1. Save Drifting videos = 5; restart; simulate 5 videos.
- Expected: Drifting at 5 videos.

### TC-038: After skipping Usage Access, Settings shows its status with Fix permission
- Covers: .10 (permission status shown with Fix permission), .11, .12
- Platform: android
- Type: permission
- Priority: P2
- Preconditions: Accessibility on, Overlay on, Usage access skipped
- Steps:
  1. Open Settings, look at Permissions.
- Expected: a Usage access row with its status and a Fix permission action, so an optional permission can be granted later.

### TC-039: Empty state offers Enable overlay once the pill is switched off
- Covers: .7, .10
- Platform: android
- Type: happy
- Priority: P2
- Preconditions: fresh data, all permissions on
- Steps:
  1. Settings, switch Show overlay pill off; Today.
  2. Tap Enable overlay.
- Expected: button visible with the empty state; after tapping it is gone and Settings shows the pill on.

### TC-040: History with no data says No data yet with guidance
- Covers: .8 edge case
- Platform: android
- Type: edge
- Priority: P1
- Preconditions: fresh data
- Steps:
  1. Open History.
- Expected: "No data yet" and "Days show up here once DoomMeter has counted some scrolling..."; no blank chart.

### TC-041: History lists the current Day with count, time and Tier
- Covers: .8
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: fresh data
- Steps:
  1. Simulate 10 videos, End session, open History.
- Expected: a row "10 videos · <time>" with Tier Drifting; no empty state.

### TC-042: The 7-day chart labels every bar and exposes a text summary
- Covers: .8
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: fresh data, 10 simulated videos
- Steps:
  1. Open Today, scroll to Last 7 days.
- Expected: numeric label on each of the 7 bars; one accessibility summary "Last 7 days. 10 videos, ... in total. ...".

### TC-043: History with 10+ seeded Days scrolls and matches the seed
- Covers: .8 (list stays smooth with many Days; values match seed)
- Platform: android
- Type: happy
- Priority: P2
- Preconditions: seed data for at least 10 Days
- Steps:
  1. Open History and scroll through all Days.
- Expected: values match the seed; no jank or crash.
- Status: **gap**: the debug build has no seeding control and the Day clock cannot be moved by the simulator across Days; seeding AsyncStorage needs app-internal access. Covered by unit tests (`storedDays.test.ts`, `historyViewModel.test.ts`) only.

### TC-050: The pill appears with count, time and Tier during a feed and hides when it ends
- Covers: .3, .4 (pill only while a feed is active)
- Platform: android
- Type: smoke
- Priority: P0
- Preconditions: all permissions on; fresh data
- Steps:
  1. Simulate 10 videos (surface active).
  2. End simulated session.
- Expected: while active, a pill reads "Doom meter. 10 videos, ... Drifting" at the top; after End it is gone.

### TC-051: Tapping the pill opens the panel; Close collapses it
- Covers: .9
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: pill visible
- Steps:
  1. Tap the pill. 2. Tap Close.
- Expected: panel with a Close button opens (avatar, Tier, totals, Platform rows); Close collapses it back to the pill.

### TC-052: Switching the overlay off stops the pill appearing
- Covers: .10 verification step 2
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: all permissions on
- Steps:
  1. Settings, Show overlay pill off. 2. Simulate videos.
- Expected: no pill is drawn.

### TC-053: Compact mode draws the face and count only
- Covers: .9
- Platform: android
- Type: happy
- Priority: P2
- Preconditions: Compact mode on
- Steps:
  1. Simulate videos; look at the pill.
- Expected: pill shows face and count without unit, time or Tier label (checked in the saved screenshot).

### TC-054: Taps outside the pill reach the app underneath
- Covers: .3, .9 edge case
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: pill visible
- Steps:
  1. Tap the +1 video button below the pill.
- Expected: the button works (count 11); the pill does not swallow the tap.

### TC-055: Overlay permission revoked: no pill, no crash
- Covers: .3 edge case, .11
- Platform: android
- Type: permission
- Priority: P1
- Preconditions: Overlay revoked, Accessibility on
- Steps:
  1. Simulate videos.
- Expected: banner names Display over other apps; no pill; the app stays alive.

### TC-060: Back on the main screen leaves the app and reopening works
- Covers: cross-cutting (Android back button)
- Platform: android
- Type: edge
- Priority: P3
- Steps:
  1. Press Back on Today. 2. Reopen the app.
- Expected: app leaves; reopening shows Today without crash.

### TC-061: Background and resume keep the day's numbers
- Covers: .7
- Platform: android
- Type: edge
- Priority: P1
- Steps:
  1. 10 simulated videos, End session; Home; reopen without restarting.
- Expected: "10 videos · ... · Drifting".

### TC-062: Landscape keeps Today readable and navigation reachable
- Covers: .13 (landscape)
- Platform: android
- Type: edge
- Priority: P2
- Steps:
  1. Rotate to landscape; use the bottom navigation.
- Expected: numbers visible, History reachable.

### TC-063: At font scale 2.0 count, time and Tier are fully visible
- Covers: .13 (largest font scale)
- Platform: android
- Type: edge
- Priority: P2
- Preconditions: system font scale 2.0
- Steps:
  1. 10 simulated videos; look at Today.
- Expected: count, "videos", time and Tier badge all visible, nothing clipped.

### TC-070: YouTube Shorts: 5 Shorts watched about 6 s each count as 5 videos
- Covers: .6
- Platform: android
- Type: smoke
- Priority: P0
- Preconditions: Accessibility service enabled and bound (no Maestro driver running), Overlay granted, YouTube installed and online, fresh DoomMeter data
- Steps:
  1. Open YouTube Shorts; watch 5 Shorts about 6 s each (adb swipe).
  2. Open DoomMeter Today.
- Expected: YouTube/Shorts row shows 5 videos and matching time; pill showed during the feed.

### TC-071: The pill shows only on the Shorts feed and hides on other screens
- Covers: .6, .4
- Platform: android
- Type: happy
- Priority: P1
- Steps:
  1. On Shorts check the pill window exists. 2. Go Home / open YouTube Home.
- Expected: overlay window present on Shorts, absent on Home screen and YouTube Home tab.

### TC-072: A long video does not count and does not add Watch time
- Covers: .6 edge case
- Platform: android
- Type: edge
- Priority: P1
- Steps:
  1. Play a regular long video for 2 minutes.
- Expected: no count, no Watch time added, pill hidden.

### TC-073: Fast swiping past Shorts adds Watch time but no count
- Covers: .4/.6 edge case
- Platform: android
- Type: edge
- Priority: P1
- Steps:
  1. Swipe past 10 Shorts in under 3 s each.
- Expected: count unchanged, Watch time increased.

### TC-074: Detection failure: Accessibility off while scrolling keeps Watch time and warns
- Covers: .12
- Platform: android
- Type: negative
- Priority: P1
- Preconditions: Accessibility and Usage access granted
- Steps:
  1. Scroll Shorts, disable the Accessibility service, keep scrolling 1 minute, open DoomMeter.
- Expected: Watch time kept rising, count stopped, Day flagged incomplete, warning names the Platform.

### TC-075: Without Usage access the warning appears and nothing is counted
- Covers: .12 edge case
- Platform: android
- Type: negative
- Priority: P2

### TC-080: Instagram Reels counted from Reels tab, Explore, DMs and feed
- Covers: .5
- Platform: android
- Type: happy
- Priority: P1
- Preconditions: Instagram logged in
- Expected: 12 videos after 3 Reels from each entry point.
- Status: needs an Instagram test account, none available in the project or environment.

### TC-081: Comments or creator profile pause Instagram counting
- Covers: .5
- Platform: android
- Type: edge
- Priority: P1
- Status: as TC-080.

### TC-082: Instagram Stories and DMs themselves are not counted
- Covers: .5
- Platform: android
- Type: negative
- Priority: P1
- Status: as TC-080.

### TC-090: TikTok For You / Following counted (skipped: TikTok cannot run on the target emulator)
- Covers: .4
- Platform: android
- Type: happy
- Priority: P1
- Status: **skipped by request**.

### Device-only checks (not automatable here)
- Haptic fires on each Tier increase (.3, .13), reduced-motion behaviour (.13), TalkBack announcements (.8, .13), camera cutout (.13), reboot persistence (.7), contrast measurements (.13, covered by `contrast.test.ts`).

## Coverage matrix

| Ticket | Acceptance criterion | Cases |
|---|---|---|
| .1 Counting engine | 5 s threshold, Watch time, pauses, per-Platform, no RN imports | unit tests; TC-011, TC-013, TC-020..026 via UI |
| .2 Tier, rollover | thresholds, max rule, 04:00 rollover, configurable, no reset | TC-020..026, TC-032..034, TC-014 |
| .3 Overlay pill | tokens, top-center, click-through, tier animation, debug control | TC-050, TC-054, TC-055 (visual tokens: unit tests) |
| .4 TikTok | | TC-090 skipped |
| .5 Instagram | all entry points, pause, no Stories | TC-080..082 blocked (no account) |
| .6 YouTube | Shorts count, long video excluded, pill only on Shorts | TC-070..073 |
| .7 Persistence/Today | survives restart, Today content, empty state | TC-010..013, TC-061 (reboot: device only) |
| .8 History/chart | list, bar labels, a11y summary, No data yet | TC-040..042, TC-043 gap |
| .9 Panel | open/close, drag, compact, 48dp | TC-051, TC-053 (drag: gap, gesture on overlay) |
| .10 Settings | immediate + persisted, validation, permission status | TC-030..039 |
| .11 Onboarding | required/optional, opens without permission, banner, Fix permission | TC-001..008, TC-038 |
| .12 Detection failure | UsageStats time, incomplete flag, warning | TC-074, TC-075 |
| .13 Accessibility | reduced motion, font scale, TalkBack, landscape | TC-062, TC-063; rest device-only |

Gaps: TC-043 (no seeding), pill drag gesture, haptics, reduced motion, TalkBack, camera cutout,
reboot persistence, "no network access" (the debug build requests INTERNET for Metro).
