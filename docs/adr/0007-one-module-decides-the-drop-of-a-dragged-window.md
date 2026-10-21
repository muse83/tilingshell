# 0007 One module decides the drop of a dragged window

Status: accepted (2026-10-21, maintainer decision in a grilling session; step one of the spec
"Slim the tiling manager's drag and release functions")

## Context
The tiling manager's release function (about 140 lines) mixed the decision "what happens when
a dragged window is dropped" with reading settings and keys, previews, animation and the tile
state writes. Nothing of it was tested.

## Decision
- One module (`dropDecision`) answers the question. One entry function, `decideDrop`: facts in
  (keys, active modes, settings, pointer and window guards), decision out. No GNOME imports,
  nothing stored.
- The decision is one of: nothing, maximise by edge (keeps the tile, ADR 0004), or tile. A tile
  decision says whether window suggestions open and on which layout (the fixed four quarters,
  the monitor's layout, or the snap assistant's layout), and whether the monitor's layout
  follows the snap assistant's.
- The manager only gathers the facts and executes the answer: cleanup of the active modes,
  maximise, tile state writes, animation, layout sync, opening suggestions.
- Tests go through `decideDrop` only (`tests/dropDecision.test.ts`). Execution is checked with
  the dev stack scenarios.
- The drag tick (what is shown while dragging) follows in a separate step, same module.

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
