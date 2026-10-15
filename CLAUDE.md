## Agent skills

### Issue tracker

Issues are tracked in Beads via the `bd` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## UI

1. For any UI work, read `design-system/doommeter/MASTER.md` first.
2. Check whether `design-system/doommeter/pages/<page-name>.md` exists. If it does, its rules override MASTER.
3. Do not generate a new design system and do not modify `MASTER.md` unless explicitly asked.
4. Before finishing, verify the result against the checklist in `MASTER.md`.
