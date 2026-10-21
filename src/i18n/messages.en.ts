import { TIER_CATALOG } from '../design/catalog';

/**
 * English: the source catalog, and the fallback for any id another language has not
 * translated yet. Every user-visible text lives here (or in a sibling catalog), never
 * inline in a screen, view model or native code.
 *
 * A message is a string with `{param}` holes, or `{ one, other }` forms that are picked by
 * the `count` param. To add a text: add its id here, read it with `translate`, and add the
 * same id to the other catalogs (a missing one falls back to English).
 */
export type Message = string | { one: string; other: string };

export const en = {
  // Units, counts and lists.
  'unit.video': { one: 'video', other: 'videos' },
  'count.video': { one: '{count} video', other: '{count} videos' },
  'count.hour': { one: '{count} hour', other: '{count} hours' },
  'count.minute': { one: '{count} minute', other: '{count} minutes' },
  'count.second': { one: '{count} second', other: '{count} seconds' },
  'list.and': '{items} and {last}',
  'series.videos': 'videos',
  'series.minutes': 'minutes',

  // Tier names come from the design catalog (CONTEXT.md, Tier).
  'tier.0': TIER_CATALOG[0].label,
  'tier.1': TIER_CATALOG[1].label,
  'tier.2': TIER_CATALOG[2].label,
  'tier.3': TIER_CATALOG[3].label,
  'tier.4': TIER_CATALOG[4].label,
  'tier.sentence': 'Level {level} of {total}, {name}.',

  // Dates.
  'day.today': 'Today',
  'day.yesterday': 'Yesterday',
  'weekday.0': 'Sunday',
  'weekday.1': 'Monday',
  'weekday.2': 'Tuesday',
  'weekday.3': 'Wednesday',
  'weekday.4': 'Thursday',
  'weekday.5': 'Friday',
  'weekday.6': 'Saturday',
  'month.0': 'January',
  'month.1': 'February',
  'month.2': 'March',
  'month.3': 'April',
  'month.4': 'May',
  'month.5': 'June',
  'month.6': 'July',
  'month.7': 'August',
  'month.8': 'September',
  'month.9': 'October',
  'month.10': 'November',
  'month.11': 'December',

  // Navigation.
  'nav.today': 'Today',
  'nav.history': 'History',
  'nav.settings': 'Settings',

  // The Overlay pill and its expanded panel.
  'pill.description': 'Doom meter. {videos}, {time}. {tier}',
  'pill.collapsed': 'Collapsed',
  'panel.description': 'Doom meter details for today. {videos}, {time}. {tier}',
  'panel.rowDescription': '{label}, {videos}, {time}, {percent} percent',
  'panel.close': 'Close',

  // Today.
  'today.title': 'Today',
  'today.byPlatform': 'By platform',
  'today.empty': 'Nothing watched yet. Scroll as usual, DoomMeter keeps count.',
  'today.emptyTitle': 'No data yet',
  'today.enableOverlay': 'Enable overlay',
  'today.summary': 'Today. {videos}, {time}. {tier}',
  'today.tileLabel': '{name}, {videos}, {time}',
  'today.rowLabel': '{label}. {videos}, {time}, {percent} percent.',
  'today.rowWarning': 'Detection not responding.',
  'today.warningKicker': 'Warning',
  'today.warningTitle': '{name} detection is not responding',
  'today.warningWithUsageAccess':
    'Watch time still counts through Usage Access. Videos are not counted until it is back.',
  'today.warningWithoutUsageAccess':
    'Nothing is counted until it is back. Usage Access would keep Watch time going.',
  'today.warningLabel': 'Warning. {title}. {message}',
  'today.setupTitle': 'Setup',
  'today.detectionOn': 'Detection is on. Scroll TikTok and the pill follows along.',
  'today.detectionOff':
    'Detection is off. Enable the DoomMeter Accessibility service so it can see when you scroll short videos. Only counts are kept; no video content is read or stored.',
  'today.openAccessibility': 'Open Accessibility settings',
  'today.overlayOn': 'Overlay is on. It shows only while a short-form feed is open.',
  'today.overlayNoPermission':
    'Overlay permission is missing. Grant "Display over other apps", then come back.',
  'today.overlayOff': 'Overlay is off.',
  'today.disableOverlay': 'Disable overlay',

  // History and the 7-day chart.
  'history.title': 'History',
  'history.emptyTitle': 'No data yet',
  'history.emptyMessage':
    'Days show up here once DoomMeter has counted some scrolling. Turn on the overlay and scroll as usual.',
  'history.incomplete': 'Incomplete: detection stopped, the count may be low.',
  'history.rowLabel': '{date}. {videos}, {time}. {tier}',
  'chart.title': 'Last 7 days',
  'chart.empty': 'The last 7 days will be charted here once DoomMeter has counted some scrolling.',
  'chart.summary': 'Last 7 days. {videos}, {time} in total.',
  'chart.busiest': 'Busiest day: {date}, {videos}.',
  'chart.nothing': '{date}: nothing counted.',
  'chart.day': '{date}: {videos}, {time}, {tier}',

  // Permissions.
  'permission.accessibility.title': 'Accessibility service',
  'permission.accessibility.purpose':
    'DoomMeter uses it to notice when a short-form feed is open and a new video comes up, so it can count them.',
  'permission.overlay.title': 'Display over other apps',
  'permission.overlay.purpose': 'DoomMeter uses it to show the pill at the top of the screen while you scroll.',
  'permission.usageAccess.title': 'Usage access',
  'permission.usageAccess.purpose':
    'DoomMeter uses it only as a backup to keep Watch time right if video detection stops working.',
  'permission.notifications.title': 'Notifications',
  'permission.notifications.purpose':
    'DoomMeter uses them to show the small notice that keeps counting alive in the background.',
  'permission.required': 'Required',
  'permission.optional': 'Optional',
  'permission.fix': 'Fix permission',
  'permission.fixNamed': 'Fix permission: {name}',
  'permission.banner': 'DoomMeter is not counting. Turn on {names}.',
  'permission.notCountingTitle': 'Not counting yet',
  'permission.notCountingMessage':
    'DoomMeter cannot see your scrolling until the missing permission is turned on.',
  'notification.text': 'Counting short-form videos on this device',

  // Onboarding.
  'onboarding.step': 'Step {step} of {total}',
  'onboarding.welcomeTitle': 'Welcome to DoomMeter',
  'onboarding.welcomeBody':
    'DoomMeter counts every short video you watch. The more you scroll, the higher your Tier climbs, and the pill at the top of the screen changes face to match.',
  'onboarding.back': 'Back',
  'onboarding.tiersTitle': 'Five Tiers',
  'onboarding.tiersBody':
    'From the mildest to the worst. Each Tier has its own face, so you can read it at a glance.',
  'onboarding.privacyTitle': 'Private by design',
  'onboarding.privacyBody':
    'No data leaves your device. DoomMeter keeps only counts and watch time, on this phone. What you watch is never saved.',
  'onboarding.calc.title': 'Just for fun',
  'onboarding.calc.body':
    'Set how long you scroll each day and enter your age. Nothing you enter here is saved.',
  'onboarding.calc.hours': {
    one: '{hours} hour a day',
    other: '{hours} hours a day',
  },
  'onboarding.calc.less': 'Less time',
  'onboarding.calc.more': 'More time',
  'onboarding.calc.ageLabel': 'Your age',
  'onboarding.calc.resultLabel': 'Years of life spent scrolling',
  'onboarding.calc.resultNote':
    'Calendar years, if you keep this pace until 73, the average life expectancy.',
  'onboarding.calc.needAge': 'Enter your age to see the result.',
  'onboarding.calc.past':
    'You are at or past the average life expectancy of 73, so there is no number to show here.',
  'onboarding.restrictedHint':
    'On Android 13 and newer the Accessibility switch may be greyed out. If so, open App info, tap the three-dot menu, choose Allow restricted settings, then come back here.',
  'onboarding.getStarted': 'Get started',
  'onboarding.continue': 'Continue',
  'onboarding.notNow': 'Not now',
  'onboarding.skip': 'Skip',
  'onboarding.granted': 'Granted',
  'onboarding.notGrantedYet': 'Not granted yet',
  'onboarding.privacy': 'No data leaves your device. Only counts are kept, on this phone.',
  'onboarding.open.accessibility': 'Open Accessibility settings',
  'onboarding.open.overlay': 'Open Overlay settings',
  'onboarding.open.usageAccess': 'Open Usage access settings',
  'onboarding.open.notifications': 'Open Notification settings',

  // Settings.
  'settings.title': 'Settings',
  'settings.error': 'Error: {message}',
  'settings.permissions.title': 'Permissions',
  'settings.permission.granted': 'Granted',
  'settings.permission.missing': 'Missing',
  'settings.permission.on': 'On',
  'settings.permission.off': 'Off',
  'settings.permission.notGranted': 'Not granted',
  'settings.permission.rowRequired': '{title}: {state}',
  'settings.permission.rowOptional': '{title}, optional: {state}',
  'settings.permission.overlayWhy': 'Lets the pill appear on top of {platforms}.',
  'settings.permission.accessibilityWhy':
    'Lets DoomMeter see when you scroll short videos. Only counts are kept; no video content is read or stored.',
  'settings.overlay.title': 'Overlay',
  'settings.overlay.show': 'Show overlay pill',
  'settings.overlay.showHint': 'Appears only while a short-form feed is open.',
  'settings.overlay.compact': 'Compact mode',
  'settings.overlay.compactHint': 'Face and count only.',
  'settings.overlay.haptics': 'Haptics',
  'settings.overlay.hapticsHint': 'A vibration when your Tier goes up.',
  'settings.position.label': 'Position',
  'settings.position.hint': 'You can also drag the pill itself.',
  'settings.position.up': 'Move up',
  'settings.position.down': 'Move down',
  'settings.position.top': 'Top',
  'settings.position.below': '{dp} dp below the top',
  'settings.thresholds.title': 'Tier thresholds',
  'settings.thresholds.hint':
    'Each Tier starts at the numbers below. Your Tier is the higher of the videos Tier and the minutes Tier. Numbers must go up from one Tier to the next.',
  'settings.thresholds.videos': 'Videos',
  'settings.thresholds.minutes': 'Minutes',
  'settings.thresholds.videosLabel': '{tier} videos',
  'settings.thresholds.minutesLabel': '{tier} minutes',
  'settings.thresholds.save': 'Save thresholds',
  'settings.day.title': 'Day',
  'settings.day.hint':
    'A new Day starts at {time} local time, so late-night scrolling stays in the same Day. Enter an hour from 0 to 23.',
  'settings.day.fieldLabel': 'Day rollover hour',
  'settings.day.fieldCaption': 'Hour (0-23)',
  'settings.day.save': 'Save rollover hour',
  'settings.language.title': 'Language',
  'settings.language.hint': 'Applies right away, in the app and on the pill.',
  'settings.language.system': 'System',
  'settings.language.en': 'English',
  'settings.language.id': 'Bahasa Indonesia',

  // Why a setting was refused.
  'settings.error.videosWhole': '{tier} videos must be a whole number.',
  'settings.error.minutesWhole': '{tier} minutes must be a whole number.',
  'settings.error.thresholdsWhole': 'Tier thresholds for {series} must be whole numbers.',
  'settings.error.thresholdsRange': 'Tier thresholds for {series} must be between 1 and {max}.',
  'settings.error.thresholdsAscend':
    'Tier thresholds for {series} must ascend: each Tier starts higher than the one before ({values}).',
  'settings.error.rollover': 'Day rollover hour must be a whole number from 0 to 23.',
  'settings.error.position': 'Position must be a whole number from {min} to {max}.',
  'settings.error.language': 'Language must be System, English or Bahasa Indonesia.',
  'settings.error.save': 'Could not save this setting on the device.',
} satisfies Record<string, Message>;

export type MessageId = keyof typeof en;
