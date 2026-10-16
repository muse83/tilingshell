# 18 Deepen: one module owns a window's tile state

Status: open
Blocked by: 16, 17

## Problem
`tilingManager.ts` (1366 lines) is wide and shallow: the constructor (87-160) builds layouts,
suggestions layout, selection preview and snap assist; `enable()` (164-320) wires about ten
signal handlers; `_onMovingWindow` (594-775) and `_onWindowGrabEnd` (777-920) are very long;
about 45 Settings/GlobalState touches. Decision logic is entangled with actors, so none of it
is testable.
- Tile state on `ExtendedWindow` (`assignedTile`, `originalSize`) is mutated from
  `tilingManager.ts` (~329, 443, 459, 847-850, 1222-1226), `windowMemory.ts` (~174-175, 223)
  and `tilingLayoutWithSuggestions.ts` (~349, 367). No single owner.
- Tile equality is hand-written with four casts (~417-422).
- Vacant-tile computation exists twice: `_findEmptyTile` / `_openWindowsSuggestions`
  (~923-960) and `_showVacantPreviewsOnly` in `tilingLayoutWithSuggestions.ts` (~118-147).

## Goal
A module owns tile state and the vacancy calculation; TilingManager shrinks to signals and display.

## Scope
Grill first. Larger and riskier than the two tickets it is blocked by, hence the order.

## Out of scope
Edge tiling geometry (edge zone ticket).

## Done when
Single owner of tile state, vacancy computed once, logic tested without GNOME, dev stack
scenarios (suggestions hover/click, close with suggestions) still pass.

## Source
`docs/research/architecture-review-2026-10-16.md`, candidate 3 (Worth exploring).
