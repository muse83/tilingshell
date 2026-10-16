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
| # | Candidate | Strength | Ticket |
|---|-----------|----------|--------|
| 1 | One module for window lifetime ("is it still alive?") | Strong | `.scratch/gnome51-port/16-deepen-window-lifetime-guard.md` |
| 2 | One module decides placement of a new window (memory vs auto-tiling) | Strong | `17-deepen-window-placement-memory-vs-auto-tiling.md` |
| 3 | One owner for a window's tile state; shrink TilingManager | Worth exploring | `18-deepen-window-tile-state.md` |
| 4 | One module for display scale | Worth exploring | `19-deepen-display-scale.md` |
| 5 | Edge tiling geometry as a pure module | Speculative | `20-extract-edge-tiling-geometry.md` |
| 6 | Seam at settings storage | Speculative | `21-deepen-settings-seam.md` |

Recommended order: 16, then 17, then 18; 19, 20, 21 independent. Details and file references
are in the tickets.

## Not found
No leftover legacy-version shims in the files read. `prefs.ts` (1726 lines, the largest file)
was not read in depth. The number of remaining type errors was not re-checked.
