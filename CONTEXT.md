# DoomMeter

An app that counts how many short-form videos the user has watched and how long they spent on them, then shows how bad the doomscrolling is through a display that gets worse as the numbers grow.

## Language

**Short-form video**:
A vertical video played in an endless swipe feed, on a platform covered by DoomMeter.
_Avoid_: reel, short, content

**Platform**:
One of the four sources of short-form video: Instagram, YouTube, TikTok, Facebook. The Lite version of an app counts as the same Platform.
_Avoid_: app, source app

**Short-form surface**:
The place inside a **Platform** where the vertical swipe feed is shown. Every entry point into that feed counts the same: the Reels tab, Explore, DMs, or a feed post opened into the Reels feed (Instagram and Facebook); Shorts (YouTube); For You and Following (TikTok). Long videos, Stories, and merely viewing thumbnails are excluded. A surface is active while the swipe feed itself is visible with the main video in focus. Opening the comments does not leave the surface; opening a creator profile does, and counting resumes when the user returns to the feed.
_Avoid_: page, tab

**Watched video**:
One **Short-form video** that becomes the main video in focus on a **Short-form surface**. It is counted the moment it appears, so a quick skip still counts. Returning to the same video (after comments or a creator profile) or watching it loop does not count it again.
_Avoid_: view, play

**Watch time**:
Total time the user spends on a **Short-form surface** with the screen on, including skipped videos and time with the comments open. Not the sum of the videos' lengths.
_Avoid_: video duration, duration

**Day**:
The period over which **Watched videos** and **Watch time** are summed. Counted per day, not per session, and cannot be reset manually. Rolls over at 04:00 local time (configurable) so late-night scrolling stays in the same day.
_Avoid_: session

**Tier**:
Severity level 0–4 (Vibing, Cooked, Washed, Brainrot, Doomed; shown in Indonesian as Santuy, Oleng, Madesu, Cengoh, Wassalam), derived from the **Watched video** count and **Watch time** of the current **Day**. Formula and thresholds are in the design system.
_Avoid_: level, status

**Mood avatar**:
The mascot face that changes per **Tier**. Decorative only; the **Tier** label carries the meaning.
_Avoid_: icon, emoji

**Overlay pill**:
The small pop-up at the top of the screen showing the **Mood avatar**, **Watched video** count, **Watch time**, and **Tier** label. Shown only while a **Short-form surface** is active in the foreground; hidden otherwise.
_Avoid_: widget, notification, HUD

**Detection failure**:
Video detection for a **Platform** has stopped working (see ADR 0005). No new **Watched video** is counted for that **Platform** while it lasts; its **Watch time** keeps rising through UsageStats when Usage Access is granted. The **Day** is marked incomplete for that **Platform** and the app warns, naming it.
_Avoid_: outage, crash

**Home widget**:
The Android home-screen widget showing today's **Mood avatar**, **Tier** label, **Watched video** count, and **Watch time**. Separate from the **Overlay pill**, which only appears over a **Short-form surface**.
_Avoid_: pill, overlay

**Punishment**:
A rule the user sets for a **Tier** (Cooked through Doomed): when that **Tier** is reached in a **Day**, the apps of all **Platforms** are blocked for a chosen length of time. Off by default for every **Tier**.
_Avoid_: penalty, limit

**Lockout**:
The period during which the **Platform** apps are blocked because a **Punishment** was triggered. It cannot be ended early, and Punishment settings cannot be weakened while it runs.
_Avoid_: ban, timeout
