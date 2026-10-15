# Issue tracker: Beads

Issues and specs for this repo are tracked with [Beads](https://github.com/steveyegge/beads) via the `bd` CLI. Run `bd --help` for the full command list.

## Conventions

- Create issues with `bd create` (or `bd q` for quick capture, which prints only the ID)
- View with `bd show <id>`, list with `bd list`, search with `bd search <text>`
- Dependencies between issues use `bd link` (blocking edges); a ticket is unblocked when everything blocking it is closed
- Labels use `bd label` / `bd tag` (see `triage-labels.md` for the role strings)
- Comments and notes: `bd comment <id>` / `bd note <id>`
- Close finished work with `bd close <id>`; reopen with `bd reopen <id>`

## When a skill says "publish to the issue tracker"

Run `bd create` with a title and body. For a spec, create a parent issue; for implementation tickets, create child issues and link blockers with `bd link`.

## When a skill says "fetch the relevant ticket"

Run `bd show <id>`.

## Wayfinding operations

Used by `/wayfinder`.

- **Map**: a parent bead holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a child bead (`bd children <map-id>` lists them) with the question in the body and a type label (`research`/`prototype`/`grilling`/`task`).
- **Blocking**: `bd link` blocking edges. A ticket is unblocked when every blocker is closed.
- **Frontier**: open, unblocked, unclaimed children of the map.
- **Claim**: `bd update <id>` to assign/mark in-progress before any work.
- **Resolve**: add the answer with `bd comment`, `bd close <id>`, then append a context pointer (gist + id) to the map's Decisions-so-far.
