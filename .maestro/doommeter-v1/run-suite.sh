#!/usr/bin/env bash
# Runs the DoomMeter v1 Maestro flows one by one on an Android emulator or device.
#
# Usage:  .maestro/doommeter-v1/run-suite.sh [--tags smoke] [TC-010 TC-011 ...]
#         (no ids = every flow)
# Env:    ADB     path to adb          (default: adb, then the Android SDK default)
#         DEVICE  adb serial           (default: emulator-5554)
#
# Why a runner and not plain `maestro test <dir>`:
#   * Each flow declares the device state it needs in a header comment, for example
#         # setup: a11y=on overlay=allow usage=allow font=1.0
#     Android permissions that Maestro cannot toggle (Display over other apps, Usage access,
#     Accessibility, font scale) are set here with adb before the flow starts.
#   * Maestro's UiAutomation driver suppresses every other AccessibilityService and clears
#     `enabled_accessibility_services` when it connects. While a flow runs, a background keeper
#     re-asserts the wanted a11y setting every 2 s, so the app reads "Accessibility on" even
#     though the service itself stays unbound. Real detection of Instagram/YouTube therefore
#     cannot run under Maestro; see detection/run-detection.sh for those cases.
#   * It checks logcat for a crash of the app after each flow and retries a failed flow once.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
APP=com.doommeter
SVC="$APP/$APP.detection.DoomMeterAccessibilityService"
DEVICE="${DEVICE:-emulator-5554}"
if [ -z "${ADB:-}" ]; then
  if command -v adb >/dev/null 2>&1; then ADB=adb
  else ADB="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}/platform-tools/adb"; fi
fi
adb_() { "$ADB" -s "$DEVICE" "$@"; }
OUT="$ROOT/.qa-artifacts/mobile"
mkdir -p "$OUT"

TAGS=""
IDS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --tags) TAGS="$2"; shift 2 ;;
    *) IDS+=("$1"); shift ;;
  esac
done

apply_state() { # a11y overlay usage font
  local a11y="$1" overlay="$2" usage="$3" font="$4"
  adb_ shell appops set $APP SYSTEM_ALERT_WINDOW "$overlay" >/dev/null
  adb_ shell appops set $APP GET_USAGE_STATS "$usage" >/dev/null
  adb_ shell settings put system font_scale "$font" >/dev/null
  if [ "$a11y" = on ]; then
    adb_ shell settings put secure enabled_accessibility_services "$SVC" >/dev/null
    adb_ shell settings put secure accessibility_enabled 1 >/dev/null
  else
    adb_ shell settings delete secure enabled_accessibility_services >/dev/null
    adb_ shell settings put secure accessibility_enabled 0 >/dev/null
  fi
}

reset_device() {
  adb_ shell settings put system accelerometer_rotation 0 >/dev/null
  adb_ shell settings put system user_rotation 0 >/dev/null
  adb_ shell input keyevent KEYCODE_HOME >/dev/null
}

header_value() { # file key default
  local v
  v="$(grep -m1 '^# setup:' "$1" | tr ' ' '\n' | grep "^$2=" | head -1 | cut -d= -f2)"
  echo "${v:-$3}"
}

run_one() { # flow-file
  local f="$1" id a11y overlay usage font
  id="$(basename "$f" .yaml)"
  a11y="$(header_value "$f" a11y off)"
  overlay="$(header_value "$f" overlay allow)"
  usage="$(header_value "$f" usage allow)"
  font="$(header_value "$f" font 1.0)"

  adb_ logcat -c
  reset_device
  apply_state "$a11y" "$overlay" "$usage" "$font"

  # Keeper: re-assert the a11y setting while the flow runs (see header).
  touch "$OUT/.running"
  (
    while [ -f "$OUT/.running" ]; do
      if [ "$a11y" = on ]; then
        adb_ shell settings put secure enabled_accessibility_services "$SVC" >/dev/null 2>&1
        adb_ shell settings put secure accessibility_enabled 1 >/dev/null 2>&1
      else
        adb_ shell settings delete secure enabled_accessibility_services >/dev/null 2>&1
      fi
      sleep 2
    done
  ) &
  local keeper=$!

  local result=FAIL attempt
  for attempt in 1 2; do
    mkdir -p "$OUT/$id"
    if maestro --device "$DEVICE" test "$f" \
         --format junit --output "$OUT/$id/report.xml" \
         --debug-output "$OUT/$id/debug" --flatten-debug-output \
         >"$OUT/$id/log.txt" 2>&1; then
      result=PASS
      [ "$attempt" = 2 ] && result=FLAKY
      break
    fi
    # Second attempt starts from a clean device state again.
    reset_device; apply_state "$a11y" "$overlay" "$usage" "$font"
  done

  rm -f "$OUT/.running"
  wait "$keeper" 2>/dev/null

  local crash=""
  if adb_ logcat -d -b crash 2>/dev/null | grep -q "FATAL EXCEPTION.*" ; then crash=CRASH; fi
  if adb_ logcat -d 2>/dev/null | grep -E "FATAL EXCEPTION|ANR in" | grep -q "$APP"; then crash=CRASH; fi
  [ "$crash" = CRASH ] && [ "$result" != FAIL ] && result=FAIL-CRASH

  printf '%s\t%s\t%s\n' "$id" "$result" "$crash" | tee -a "$OUT/results.tsv"
  # restore defaults so later manual use of the emulator is not surprising
  adb_ shell settings put system font_scale 1.0 >/dev/null
}

touch "$OUT/results.tsv"
FLOWS=()
if [ ${#IDS[@]} -gt 0 ]; then
  for i in "${IDS[@]}"; do FLOWS+=("$HERE/$i.yaml"); done
else
  while IFS= read -r f; do FLOWS+=("$f"); done < <(ls "$HERE"/TC-*.yaml | sort)
fi
for f in "${FLOWS[@]}"; do
  if [ -n "$TAGS" ] && ! grep -qE "^ *- ?$TAGS|tags:.*$TAGS" "$f"; then continue; fi
  run_one "$f"
done
