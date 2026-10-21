# DoomMeter — Design System (MASTER)

Source of truth for all DoomMeter UI. Page/screen overrides go in `design-system/doommeter/pages/<name>.md` and win over this file.

Generated with ui-ux-pro-max (`--design-system`), then adapted: the generic output (landing-page pattern, crypto font mood) did not fit an always-on overlay HUD, so the pattern, severity model and typography below are product-specific.

## 1. Product & Concept

- **What**: A floating pill at the top of the screen showing videos watched (Reels / Shorts / TikTok) and total watch time. The worse the doomscroll, the worse the pill looks.
- **Core idea**: **Escalating severity.** The same component moves through 5 tiers; color, icon, label, size, and motion all intensify. The user should feel it getting worse without reading a number.
- **Style**: Flat, high-contrast, dark-only HUD. No shadows or gradients on the pill (it floats over unpredictable video content, so it must be self-contained and opaque).
- **Tone**: Dry, a little roasting, never preachy. Short labels.
- **Platform note**: Android can draw over other apps (`SYSTEM_ALERT_WINDOW`). iOS cannot draw over other apps; there the equivalent is a Live Activity / Dynamic Island. The tokens below apply to both.

## 2. Severity Tiers (the heart of the system)

Tier = the **higher** of the count tier and the time tier. Thresholds are initial values; tune after usage data.

| Tier | Name (label) | Videos | Time | Color token | Hex | Icon (Phosphor) |
|------|--------------|--------|------|-------------|-----|-----------------|
| 0 | `Vibing` | 0–9 | 0–9 min | `--sev-0` | `#FACC15` | `smiley` |
| 1 | `Cooked` | 10–29 | 10–29 min | `--sev-1` | `#FB923C` | `fire-simple` |
| 2 | `Washed` | 30–59 | 30–59 min | `--sev-2` | `#F87171` | `drop` |
| 3 | `Brainrot` | 60–119 | 60–119 min | `--sev-3` | `#A3E635` | `brain` |
| 4 | `Doomed` | 120+ | 120+ min | `--sev-4` | `#6B7280` | `skull` |

`Doomed` is grey (`#6B7280`) for the face, border and bars, but its label text and filled badges use the lighter `#9CA3AF` so text keeps 4.5:1 (`sevText` in `src/design/catalog.ts`). All other Tiers use their Hex for text too.

### 2.1 Mood Avatar (mascot face)

Each tier has a round flat face that replaces the tier icon in the pill and panel. Files: `assets/mood-{0..4}-*.svg` (64×64 viewBox; preview: `assets/preview.html`).

| Tier | Mood | Face |
|------|------|------|
| 0 Vibing | cool | sunglasses, wide smile |
| 1 Cooked | worried | round eyes, raised brows, wobbly mouth, one sweat drop |
| 2 Washed | drained | heavy lids, eye bags, flat mouth turned slightly down, one sweat drop |
| 3 Brainrot | fried | open skull with a pink brain (two hemispheres, centre fissure, dark red folds), one round white eye, one `X` eye, open mouth with teeth |
| 4 Doomed | dead | skull: `X X` eyes, triangle nose, teeth |

Rules:
- Faces are filled with the tier color; features use `--color-overlay-bg` (`#0B0D14`). Brainrot is the exception: an open skull in lime with a pink brain (`#F9A8D4`, folds `#BE185D`), eye white `#F8FAFC`. Hex is baked into the SVGs, so regenerate them if tier colors change.
- Sizes follow the pill: 32 (T0–T1), 36 (T2), 40 (T3), 44 (T4); 96 in the expanded panel.
- The face is **decorative** next to the tier label (`aria-hidden`); the label carries the meaning. Shape of the face, not just its color, changes per tier.
- Face changes on tier change only (swap with scale pop, see §6.3). No idle animation by default; optional blink every 4–6s on T0–T1 only, disabled under reduced motion.
- Use the faces as the app icon badge / notification small icon too (mono variant: single-color `#F8FAFC` features on transparent).

### 2.2 Severity rules
- Color is **never the only signal**: every tier also has a distinct face/icon + text label (colorblind-safe, `color-not-only`).
- Contrast on the pill surface (`#0B0D14`), checked with the contrast tool (`src/design/contrast.test.ts`): face colors ≥ 3:1 (Doomed grey 4.0:1), label text colors ≥ 7:1 (Doomed text `#9CA3AF` 7.6:1), Brainrot brain pink 10.7:1.
- Escalation rules:

| Property | T0 | T1 | T2 | T3 | T4 |
|----------|----|----|----|----|----|
| Border | none (the pill has no border; the Tier shows in face, label and accent dot) | | | | |
| Icon glow/pulse | none | none | slow pulse (2.4s) | pulse (1.6s) | fast pulse (0.9s) |
| Pill height (avatar + 2 x 14 padding) | 60 | 60 | 64 | 68 | 72 |
| Number size | 20 | 20 | 22 | 24 | 26 |
| Haptic on enter | none | light | medium | heavy | heavy ×2 |

## 3. Color Tokens

Use semantic tokens only; no raw hex in components. Dark-only (the HUD overlays video; a light variant would be unreadable).

```css
:root {
  /* Surfaces */
  --color-overlay-bg:      #0B0D14;  /* pill surface, opaque */
  --color-overlay-bg-alt:  #151925;  /* expanded panel rows / chips */
  --color-app-bg:          #020617;  /* in-app screens background */
  --color-card:            #0E1223;
  --color-muted:           #1A1E2F;
  --color-border:          #334155;

  /* Text */
  --color-text:            #F8FAFC;  /* 17:1 on overlay-bg */
  --color-text-muted:      #94A3B8;  /* ≥ 7:1 on overlay-bg; never go dimmer for meaningful text */
  --color-on-sev:          #0B0D14;  /* text on a filled severity chip */

  /* Severity (see §2) */
  --sev-0: #34D399;
  --sev-1: #FACC15;
  --sev-2: #FB923C;
  --sev-3: #F87171;
  --sev-4: #FF4D8D;

  /* Platform chips (data-viz identity, always paired with icon + label) */
  --plat-reels:  #E1306C;  /* Instagram Reels */
  --plat-shorts: #FF3D3D;  /* YouTube Shorts */
  --plat-tiktok: #25F4EE;  /* TikTok */
  --plat-facebook: #1877F2;  /* Facebook Reels (4.1:1 on #0B0D14) */

  /* Interaction */
  --color-focus-ring: #FFFFFF;
  --color-action:     #F8FAFC;  /* primary button bg */
  --color-on-action:  #0B0D14;
}
```

Platform colors are for small chips/segments only. Do not use official logos unless following each brand's guidelines; use a neutral glyph + text label (`Reels`, `Shorts`, `TikTok`).

## 4. Typography

- **Numbers (the counter)**: `JetBrains Mono` 500/700, **tabular figures** so the counter never jitters as digits change.
- **UI text**: `Inter` 400/500/600.
- **Display (in-app headline numbers, tier names)**: `Space Grotesk` 600/700.
- Respect system text scaling (Dynamic Type / sp). The pill may grow vertically but must never truncate the count or time.

| Role | Font | Size / line | Weight |
|------|------|-------------|--------|
| `overlay-count` | JetBrains Mono | 20–26 / 1.1 (per tier) | 700 |
| `overlay-time` | JetBrains Mono | 14 / 1.2 | 500 |
| `overlay-label` | Inter | 12 / 1.2, +0.04em caps | 600 |
| `display` | Space Grotesk | 40 / 1.1 | 700 |
| `title` | Space Grotesk | 22 / 1.25 | 600 |
| `body` | Inter | 16 / 1.5 | 400 |
| `caption` | Inter | 13 / 1.4 | 400 |

Minimum body size 16. The overlay label may be 12 because it is always accompanied by the larger count and an icon.

## 5. Spacing, Radius, Elevation

- Spacing scale (4pt): `4, 8, 12, 16, 24, 32, 48`.
- Radius: pill `999`, card `16`, chip `8`, button `12`.
- Elevation: **none on the pill** (flat). Cards in the app use border `1px --color-border`, not shadows. Only one shadow exists: the expanded panel gets a `0 8 24 rgba(0,0,0,.5)` scrim shadow so it separates from video.

## 6. Components

### 6.1 Overlay Pill (core)
Collapsed (default), centered, below the status bar / camera cutout (respect safe-area top + 8px).

```
┌───────────────────────────────────────────┐
│ [icon]  47 videos  ·  38:12  ● [Doomed]   │   height 64, tier 2
└───────────────────────────────────────────┘
```
- Content: mood avatar (§2.1) · `{count}` + "videos" · `{h:mm:ss or mm:ss}` · tier label.
- Surface `--color-overlay-bg`, **no border**, corner radius 20, vertical padding 14. The Tier is marked by the face, the label and a small 8dp dot in `--sev-N` (>= 3:1 on the surface); color is never the only signal.
- Tap → expands to the panel (6.2). Tap again or swipe up → collapses.
- Drag to reposition vertically along the top edge; **visible fallback**: settings has a "Position" control (no gesture-only critical action).
- Touch target ≥ 48dp (Android) / 44pt (iOS); extend the hit area beyond the visual bounds.
- Click-through: the pill must not block taps outside its bounds.
- Compact mode (setting): icon + count only, for people who find the full pill too big.

### 6.2 Expanded Panel
Same top anchor, grows downward from the pill (height reveal, 220ms), no border, corner radius 20. Contains:
1. Mood avatar (96) + tier name large (`display`) in tier color.
2. Total count and total time.
3. Breakdown rows per platform: platform chip · count · time · proportion bar (bar has numeric label, not color-only).
4. Day context: "today" (the Day rolls over at 04:00 local time, configurable). No manual reset; see `CONTEXT.md` → Day.
5. Close affordance (explicit close button, not only swipe).

### 6.3 Tier Transition
When the tier increases: icon swaps with a scale pop (0.9→1.1→1), one haptic per the table in §2. Never animate on every video increment; the count change is a 120ms number roll (opacity/translate only).

### 6.4 In-app screens
- **Today** (home): big `display` count + time, tier badge, platform breakdown, 7-day bar chart (bars labeled with values; text summary for screen readers).
- **History**: list by day, virtualized.
- **Settings**: Overlay on/off, position, compact mode, tier thresholds, haptics, permission status (with a clear "Fix permission" action and explanation).
- Primary button: `--color-action` bg, `--color-on-action` text, 48 height. One primary CTA per screen.
- Bottom navigation: max 3–4 items (Today, History, Settings), icon + label.

### 6.5 Empty / permission / error states
- First run with no data: "Belum ada yang ditonton. Scroll seperti biasa, DoomMeter yang menghitung." + CTA to enable the overlay permission.
- Permission revoked: pill replaced by in-app banner with a retry/fix action.
- Never show a blank chart: show "No data yet" with guidance.

## 7. Motion

| Token | Value | Use |
|-------|-------|-----|
| `--dur-fast` | 120ms | number roll, press feedback |
| `--dur-base` | 200ms | color crossfade, chip changes |
| `--dur-panel` | 220ms decelerate (open, grows down), 150ms accelerate (close, shrinks up) | expand/collapse, vertical only, no horizontal slide |
| `--dur-pulse` | 2.4s / 1.6s / 0.9s | tier 2/3/4 icon pulse |

- Animate `transform` and `opacity` only, except the panel open/close, which reveals by height (vertical clip).
- **Reduced motion**: no pulse, no number roll, no scale pop, panel opens and closes instantly; tier change is an instant swap with the haptic retained. Severity must still read via color + icon + label + size.
- Pulsing must be subtle on the pill (a distracting overlay on top of someone's video is itself an anti-pattern). Max 1 animated element (the icon).
- Never animate in a way that blocks input; all animations are interruptible.

## 8. Accessibility

- Contrast: normal text ≥ 4.5:1, non-text (icons, borders, severity) ≥ 3:1 against the pill surface; test any new color.
- Screen reader label for the pill: `"Doom meter. 47 videos, 38 minutes 12 seconds. Level 3 of 5, Doomed."` Announce **only tier changes** via a polite live region, never every increment.
- The pill is a button with a name and `expanded` state.
- Support system font scaling to the largest size without clipping.
- Haptics are optional (setting) and never the only feedback.
- Landscape: pill stays top-center, panel is capped to 60% screen height and scrolls.
- Safe areas: top cutout / status bar / gesture bar respected.

## 9. Icons

- Phosphor icons (`@phosphor-icons/react` on web; the matching native set otherwise), **one style**: `bold` weight (~2px stroke at 24). Don't mix filled and outline at the same level.
- Sizes: `icon-sm 16`, `icon-md 24`, `icon-lg 32`.
- No emoji as icons. Decorative icons beside text are hidden from the accessibility tree.

## 10. Anti-patterns (avoid)

- Red/green only differentiation; tier color without icon + label.
- Translucent / blurred pill background (unreadable over video).
- Updating or animating on every video; any flashing > 3 Hz (seizure risk; tier-4 pulse stays ≤ 1.1 Hz).
- Shaming copy ("You're wasting your life"); keep it dry-funny, not cruel.
- Tiny tap targets, gesture-only controls, tight tracking on numbers, proportional (non-tabular) digits.
- Raw hex in components; ad-hoc spacing outside the 4pt scale.

## 11. Pre-delivery checklist

- [ ] All 5 tiers screenshot-tested on a bright video and a black video
- [ ] Contrast verified for each `--sev-N` on `--color-overlay-bg`
- [ ] Reduced motion + largest font scale tested
- [ ] Screen reader announces tier change only
- [ ] Touch targets ≥ 48dp/44pt; pill is click-through outside bounds
- [ ] Top safe area / cutout respected, landscape tested
- [ ] Counter digits are tabular (no jitter)
- [ ] Icons from one set, one weight
