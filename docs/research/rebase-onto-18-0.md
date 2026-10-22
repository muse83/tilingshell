# Rebase onto upstream 18.0: window memory as a standalone slice

Date: 2026-10-22. Branch `upstream-18-rebase` of the fork (from upstream tag `18.0`), checked
out as a git worktree next to this clone. `gnome51-port` is unchanged.

## Done: the standalone slice (steps 1 and 2 of the ticket)

Four commits on 18.0, no fork-only module needed:

- the original window memory (`8ac9635`), the logging commit (`043bee2`, without its
  version-name change in `metadata.json`), the hardening with the pure decision module and its
  tests (`4b6b607`), and the "never invent a size" fix (`957b21f`), plus one style commit
  (blank line between class members).
- Cherry-picked in order. Conflicts: only `package.json` (test script added to upstream's
  scripts) and `metadata.json` (dropped), and a replay of the windowMemory rewrite. The
  `extension.ts` wiring merged without a conflict, contrary to the trial in the ticket.
- Dependencies cut: none needed. The original form uses only things 18.0 has: the window's
  `originalSize`, `assignedTile`, `buildRectangle`, `maximizeWindow` and the tiling manager's
  `restoreTile` (added by the first commit). Maximise rule: `maximizeWindow` in 18.0's
  `gnomesupport.ts` is the equivalent.
- Typecheck: 25 errors, the same 25 as plain 18.0 (typings of the installed packages), none in
  the memory files. Tests: 17 pass. Lint: one error in `settings.ts`, also on plain 18.0.

## Live check on the dev stack (single monitor, GNOME Shell 51)

`dev-stack/scenario-memory-slice.sh`: frame restored, tile restored (left half, full height),
closing a tiled window remembers the tile, maximised flag restored: all pass.

Finding: plain 18.0 does **not** load in the stack unless the session type is set. 18.0 asks the
mutter setting `experimental-features` unless it sees a Wayland session through the environment
variable `XDG_SESSION_TYPE`, and the stack does not set it (a real session does). The fork's
scaling commit `10cc523` avoids the question altogether but is a larger change that conflicts
heavily with 18.0's `extension.ts`. For the live check the variable was set in a throwaway
copy of the stack's `entrypoint.sh`; nothing of that is committed.

## Open: the rest of the fork on top (step 3)

Not started. A trial merge of `gnome51-port` into the slice conflicts in 23 files (among them
`settings.ts`, `extension.ts`, `tilingManager.ts`, `prefs.ts`, `snapAssist.ts`, `ui.ts`,
`windowMemory.ts`, `frameMemory.ts`), 48 fork commits. That is the size the ticket warned
about, so step 3 should be its own ticket, to be done as one merge or in stages (settings
groups, lifecycle, then the rest). Dropped as already in 18.0 (to be confirmed per commit when
step 3 runs): the GNOME 50/51 support commits, `f22a28b`, `3ea2e05`, `a803e83`.
