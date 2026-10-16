# Architecture review, 2026-10-16

Method: scoped to recent hot spots (window memory, suggestions crash, null safety) from the
commit history and tickets; a read-only exploration of `tilingshell/src` found friction;
candidates were assessed with the deletion test. No code was changed, no tests were run by the
exploration. An HTML report with before/after sketches was written to the temp directory (not
kept in the repo).

State of tests: only `components/windowMemory/frameMemory.ts` is tested (17 tests via
`node --test`, pure functions, no GNOME). Fixes for the null-safety and the shell crash tickets were
verified by type check and dev-stack scenario scripts only.

No `CONTEXT.md` exists yet; terms like tile, layout, remembered frame are only defined in the ADRs.
No candidate contradicts ADR 0001 or 0002.

## Candidates and tickets
| # | Candidate | Strength | Issue |
|---|-----------|----------|--------|
| 1 | One module for window lifetime ("is it still alive?") | Strong | issue #16 |
| 2 | One module decides placement of a new window (memory vs auto-tiling) | Strong | issue #17 |
| 3 | One owner for a window's tile state; shrink TilingManager | Worth exploring | issue #18 |
| 4 | One module for display scale | Worth exploring | issue #19 |
| 5 | Edge tiling geometry as a pure module | Speculative | issue #20 |
| 6 | Seam at settings storage | Speculative | issue #21 |

Recommended order: 16, then 17, then 18; 19, 20, 21 independent. Details and file references
are in the GitHub issues of muse83/tilingshell (#16-#21, with verification comments).

## Status
- Candidate 1 (issue #16) done: `src/components/windowLifetime/windowLifetime.ts` with tests in
  `tests/windowLifetime.test.ts`; crash scenario `dev-stack/scenario-close-with-suggestions.sh`
  reports "shell survived" on the final state. The tile-state casts (`ExtendedWindow`) were left
  for candidate 3 (issue #18).
- Candidate 2 (issue #17) done: `src/components/windowPlacement/` (decision in
  `placementDecision.ts`, tests in `tests/placementDecision.test.ts`; GNOME glue in
  `windowPlacement.ts`). Decisions in ADR 0003. Measured before and after with
  `dev-stack/measure-placement.sh`: before, a new window was visible for one sample at the
  application's own position in every case; after, never (20 runs), and it is at its final
  frame after 20-28 ms (before: 21-28 ms). The very first window after the shell started takes
  ~200 ms with and without the change (app start-up), so the scenario warms up first. `dev-stack/scenario-window-placement.sh` covers
  both modes, cascading, a taken tile, the second monitor and the shutdown save. The suspected
  monitor-index mismatch is not real: the shell's monitor list is ordered by monitor index and
  the tile on the second monitor lands there (issue #19 keeps the rest of its scope).

## Not found
No leftover legacy-version shims in the files read. `prefs.ts` (1726 lines, the largest file)
was not read in depth. The number of remaining type errors was not re-checked.
