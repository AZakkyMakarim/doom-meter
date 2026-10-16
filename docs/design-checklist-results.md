# Design checklist results (MASTER.md section 11)

Ticket `doom-meter-v9k.13`. Status per item: **unit-tested** (a Jest test asserts it),
**verified-in-code** (reviewed in the source, no automated check), **needs-device** (cannot be
confirmed without a real phone). Most items are a mix, so each lists all that apply.

Scope reviewed: the pill, the expanded panel, Today, History with the 7-day chart, Settings,
Onboarding, the permission banner and the detection-failure warnings.

## Results

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | All 5 Tiers on a bright and a black video | unit-tested + needs-device | The pill is opaque, so the video behind it cannot change its contrast: pill surface vs white 18:1, solid Tier 1-4 borders vs black >= 3:1 (`src/design/contrast.test.ts`). Each Tier has its own avatar, border width and size (`pillViewModel.test.ts`). The screenshots themselves need a device. |
| 2 | Contrast of each `--sev-N` on `--color-overlay-bg` | unit-tested | `src/design/contrast.test.ts` computes WCAG ratios: 10.1, 12.7, 8.6, 7.0, 6.2. All pass the section 8 floors (4.5:1 text, 3:1 non-text). Tier 4 is below the 7:1 that section 2.2 claims "by approximation"; see Findings. |
| 3a | Reduced motion | unit-tested + verified-in-code + needs-device | `pillViewModel` carries `motion` flags and a null `pulseMs` under reduced motion; the haptic is unchanged (`accessibility.test.ts`). The setting is read from React Native and pushed to the pill (`reducedMotion.ts`, `runtime.ts`). Native honors the flags and also the system animation scales (`OverlayPill.kt`). |
| 3b | Largest font scale | verified-in-code + needs-device | Pill: drops unit, then dot, then Tier label, judged from natural widths (`OverlayPill.kt`, `WidthFitting.kt`); the count and time are never dropped. Panel: total and platform rows stack instead of truncating. Today, History and Settings text has no line limits and wraps; Settings position row wraps; 7-day chart becomes one row per Day from font scale 1.3 (`fontScale.ts`, unit-tested). Bottom nav labels stop growing at 1.4x (documented deviation). |
| 4 | Screen reader announces Tier change only | unit-tested + verified-in-code + needs-device | `announcement` is null on the first draw, on count or time updates, and set only on a Tier change (`accessibility.test.ts`). Native speaks only that field; the pill label is one description on one button with an expand action and a "Collapsed" state. The 7-day chart has one text summary (`historyViewModel.test.ts`). TalkBack behavior needs a device. |
| 5 | Touch targets >= 48dp; pill click-through | verified-in-code + needs-device | Pill host min 48x48dp; panel close button 48dp; all buttons, inputs and toggle rows `minHeight: 48`; bottom nav items 56dp. The pill window is sized to the pill with `FLAG_NOT_TOUCH_MODAL`, so taps outside fall through. Click-through needs a device. |
| 6 | Top safe area, cutout, landscape | unit-tested + verified-in-code + needs-device | Pill: below the larger of status bar and cutout inset, plus 8dp; panel is capped at 60% of the height in landscape (fraction unit-tested) and never past the bottom of the screen, then scrolls. App screens: padding from the system insets, including side cutouts and the gesture bar (`safeArea.ts` unit-tested; `DoomMeterInsetsModule.kt` reads them). |
| 7 | Digits are tabular | verified-in-code | All counts and times use JetBrains Mono (fixed width) with `tnum` on native text and `fontVariant: ['tabular-nums']` in React Native: pill count and time, panel totals, rows and percents, Today, History, chart values, Settings inputs. |
| 8 | Icons from one set, one weight | verified-in-code | The app draws no icon font. The only glyphs are the Mood avatars (decorative, hidden from screen readers) and the panel close button, a bold 2.5dp X. No emoji icons. Gap: the bottom navigation has labels but no icons (see Open gaps). |

Additional section 8 and 9 items checked in code: opaque pill with no blur or shadow; one
polite live region for detection warnings; permission banner has an alert role and a 48dp
fix action; decorative faces hidden from the accessibility tree; no raw hex outside
`src/design` (`tokens.test.ts`).

## Findings and fixes

- Reels chip text (dark surface color on `#E1306C`) was 4.47:1, under 4.5:1. The panel now uses
  `onPlatform` (`#000000`): 4.84:1 or better on all three Platform colors.
- Input and secondary button outlines used `--color-border` (1.8:1 on cards). They now use a new
  token `borderStrong` (`#64748B`, 3.7:1 or better). Card borders stay decorative.
- Tier 4 `#FF4D8D` is 6.2:1 on the pill surface, below the 7:1 section 2.2 estimates. It passes
  the real requirements (4.5:1 text, 3:1 non-text), so the color is unchanged (the avatars bake
  it in). MASTER.md section 2.2 should say 6:1 instead of 7:1 for Tier 4; MASTER.md was not edited.
- The Tier 0 border at 40% opacity is 2.5:1, below 3:1. It is decorative by design (avatar and
  label carry the Tier) and recorded as such in a test.
- The pill's old overflow check compared the row's measured width to the screen, which can never
  be larger for a wrap_content row, so nothing collapsed at large font scales. It now uses natural widths.
- The pill's reduced-motion check looked at the animator scale only; React Native's setting uses
  the transition scale. Both are honored now, and JavaScript owns the flags.
- App screens padded the top with the status bar height only and the bottom with a fixed 24dp.
  They now follow the real insets, including side cutouts in landscape.

## Open gaps (not done here)

- Bottom navigation has no icons, though MASTER.md section 6.4 says icon + label. Adding them
  needs an icon source (Phosphor bold) and a vector renderer the app does not have yet.
- Tier changes are announced from the pill only. The in-app Today badge does not announce a change.
- `announceForAccessibility` is deprecated on API 36 but still works; a live-region pane is the
  long-term replacement.

## Manual checks still needed on a device

1. Open a bright video (white background) and a black video; raise the Tier through all 5 (use the
   debug simulator) and look at the pill and its border on each.
2. Settings > Accessibility > Remove animations on. Raise the Tier: no pulse, no count roll, no
   avatar pop, panel opens instantly, haptic still fires.
3. Settings > Display > Font size and Display size at the largest. Check the pill (count and time
   complete, label may drop), the panel (rows stack, scrolls), Today, History, the 7-day chart rows,
   Settings and Onboarding: nothing clipped; count and time never truncated.
4. TalkBack on: focusing the pill reads "Doom meter. ..., Level N of 5, Name."; a new video speaks
   nothing; a Tier change speaks the Level sentence once; the panel and its close button work.
5. Rotate to landscape, open the panel: pill top-center, panel at most 60% of the height, scrolls.
   On a phone with a camera cutout, check portrait and both landscape directions; the pill and the
   app content stay clear of the cutout, status bar and gesture bar.
6. Tap beside the pill: the app underneath receives the touch. Tap the pill and the close button
   at the screen edge: easy to hit (48dp).
7. Three-button navigation and gesture navigation: the bottom nav sits above the system bar.
