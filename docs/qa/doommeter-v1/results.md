# DoomMeter v1: QA results

Date: 2026-10-16. Platform: Android emulator `emulator-5554` (Android 11, 1080x2400), debug build of
`com.doommeter` installed 2026-10-16 09:58 (newer than the last commit, so not stale). Tool: Maestro 2.11.0
through `.maestro/doommeter-v1/run-suite.sh`. TikTok skipped by request. Web: not applicable.

**This run is partial.** 16 of 51 cases have a clean result. The rest were not run, because the runner
was started twice by mistake (two concurrent runners invalidated that batch, results kept in
`.qa-artifacts/invalid-run/`, not used here) and later flows hung on this machine (low RAM, C: at 98%,
Maestro session-file lock errors). Nothing below comes from the invalid batch.

## Results

| Case | Result | Bug | Note |
|---|---|---|---|
| TC-001, 002, 003, 004, 005, 006, 008 | pass | | |
| TC-007 | pass | | |
| TC-010 | **fail** | doom-meter-r2h | no "Enable overlay" on fresh-install empty state |
| TC-011, 012, 013, 014 | pass | | TC-014 was flaky once, then passed |
| TC-020, 021 | pass | | boundary assertions accept N or N+1 (see below) |
| TC-038 | **fail** | doom-meter-7om | Settings has no Usage access row |
| TC-039 | pass | | |
| TC-024 | not run | | hung twice; assertion fixed but not re-verified |
| TC-022, 023, 025, 026 | not run | | |
| TC-030 to TC-037 | not run | | |
| TC-040 to TC-042, TC-050 to TC-055 | not run | | |
| TC-060 to TC-063 | not run | | |
| TC-043 | gap | | no way to seed 10+ Days in the debug build |
| TC-070 to TC-075 | not run | | YouTube Shorts detection: cannot run under Maestro (see below); adb-driven harness not built |
| TC-080 to TC-082 | not run | | Instagram: no test account supplied |
| TC-090 | skipped | | TikTok, by request |

Smoke verdict: TC-001, 003, 008, 011 pass. TC-050 (pill) was not run, so the pill smoke is unverified in this report.

## Environment notes

- Maestro's UiAutomation driver unbinds every other AccessibilityService and clears
  `enabled_accessibility_services` when it connects. Real detection of YouTube/Instagram therefore
  cannot be exercised in a Maestro flow. UI cases use the debug simulator, with the a11y setting
  re-asserted by the runner. This is an environment limit, not a DoomMeter bug.
- A video that stays on screen 5 s counts in real time, also in the simulator. Maestro steps can take
  longer than 5 s on a loaded machine, so exact counts are not deterministic. Boundary cases accept
  the pair "N and its tier" or "N+1 and its tier" (the rule is still checked), others accept `1[01]`.
- `overlay` and `usage` permissions are set with `appops` by the runner and survive `clearState`.
