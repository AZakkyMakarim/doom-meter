# The empty state offers "Enable overlay" only while the pill is off

The Today screen's empty state used to be specified (ticket doom-meter-v9k.7) as guidance plus an "Enable overlay" button. On a fresh install the **Overlay pill** is on by default and permissions are granted, so the button would say "Enable overlay" for something already enabled. QA (TC-010, bug doom-meter-r2h) found the app hides it in that case, and this records that as intended.

**Rule** (`showsEnableOverlayAction` in `src/today/todayViewModel.ts`): the button shows only when the empty state is on screen, the pill is switched off, and no "Not counting yet" notice is shown. Tapping it turns the pill on, and it disappears.

**Fresh install, pill on, permissions granted:** Today shows the empty-state guidance and "No data yet", no button; the 7-day card says "No data yet"; Settings and the Setup section say "Overlay is on". TC-010 asserts exactly this. TC-039 covers the button (pill switched off in Settings, button appears, tap turns the pill on).

**Missing permission:** the empty state is replaced by the "Not counting yet" notice and the button stays hidden, because the pill cannot show without Display over other apps.

Rejected: always showing the button (misleading when the pill is already on, and a tap would do nothing) and a differently worded always-visible button (adds a control the user does not need on first run).
