# 0007 One module decides the drop of a dragged window

Status: accepted (2026-10-21, maintainer decision in a grilling session; step one of the spec
"Slim the tiling manager's drag and release functions")

## Context
The tiling manager's release function (about 140 lines) mixed the decision "what happens when
a dragged window is dropped" with reading settings and keys, previews, animation and the tile
state writes. Nothing of it was tested.

## Decision
- One module (`dropDecision`) answers the question. Entry function `decideDrop`: facts in
  (keys, active modes, settings, pointer and window guards), decision out. No GNOME imports,
  nothing stored.
- The decision is one of: nothing, maximise by edge (keeps the tile, ADR 0004), or tile. A tile
  decision says whether window suggestions open and on which layout (the fixed four quarters,
  the monitor's layout, or the snap assistant's layout), and whether the monitor's layout
  follows the snap assistant's.
- The manager only gathers the facts and executes the answer: cleanup of the active modes,
  maximise, tile state writes, animation, layout sync, opening suggestions.
- Tests go through the entry functions only (`tests/dropDecision.test.ts` for `decideDrop`,
  `tests/dragDecision.test.ts` for `decideDrag`). Execution is checked with
  the dev stack scenarios.
- The drag tick (what is shown while dragging) is the second entry function of the same
  module, `decideDrag` (added 2026-10-21, see "Amendment: the drag tick" below).

## Behaviour kept on purpose
- Suggestions after edge tiling in default mode use a fixed four-quarter layout; in the other
  edge modes the monitor's layout.
- If the snap assistant is active but its layout is no longer known, the drop still tiles, but
  that mode allows no suggestions and no layout sync.
- Edge tiling wins over the snap assistant when both are active (layout for suggestions).
- The maximise by top edge happens before the guards for another monitor, an empty selection
  and an already maximised window, as before.
- Only difference in order: the manager now always switches off snap assistance and edge
  tiling after asking the module, also when no mode was active (before: it returned first).
  With no mode active there is nothing to switch off, so nothing visible changes.
- A pointer in no edge zone still counts as edge tiling in progress (ADR 0006).

## Verification (2026-10-21)
- 19 unit tests; full suite 143 passing; typecheck and lint clean.
- Dev stack: maximise scenario (top-edge maximise keeps the tile, edge modes), suggestions
  hover and click, close with suggestions: all pass.

## Amendment: the drag tick (2026-10-21, step two)

### Decision
- `decideDrag` takes the facts of one tick (keys, settings, pointer, whether the pointer is near
  an edge, whether the snap assistant is active) and the previous tick's state (key states and
  pointer position). It returns the decision and the new state. Nothing is stored in the module.
- The decision is one of: close everything (other monitor, window cannot move or resize),
  unchanged (keys and pointer as in the last tick), show the layout (with whether spanning is
  allowed and whether the span key just changed), show the edge preview, show the snap
  assistant, or show nothing (layout hidden, no edge tiling, snap assistant switched off).
- The manager reads the pointer and keys, asks the module, and executes the answer. Touch and
  pen wiring stays in the manager. Tests: `tests/dragDecision.test.ts`, through `decideDrag`.

### Behaviour kept on purpose
- On "nothing" and "close everything" the remembered state is not updated, as before.
- The tile-release step (a tiled window leaving its tile) still runs on "nothing" ticks but not
  on "close everything" ticks, as before.
- The check "pointer is inside the current selection" and the tile lookup stay in the manager;
  they need the preview's current rectangle, which is not known to the module.
- The pointer is now read (and, with touch input, the touch pointer advanced) before the
  "close everything" guard, so also on ticks on another monitor. The touch pointer only adds up
  window movement, so skipping or doing it on such a tick gives the same position later.
- Whether the pointer is on this monitor is now asked on every tick, also for windows that
  cannot move or resize. No visible effect.
- The edge-distance check is now evaluated on every tick instead of only when edge tiling can
  apply. It is a few comparisons without side effects.
- The state reset at the end of a drag only forgets the pointer position, not the key states.

### Verification (2026-10-21)
- 24 unit tests for the drag tick; full suite 167 passing; typecheck and lint clean.
- Speed: the decision costs about 13 nanoseconds per tick (1 million runs), against a 15
  millisecond timer: not measurable.
- Dev stack: maximise scenario (top-edge and left-edge drag in all edge modes), suggestions
  hover and click, close with suggestions: all pass.
