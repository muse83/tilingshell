# 17 Deepen: one module decides where a new window goes (memory vs auto-tiling)

Status: open
Blocked by: 16 (window-lifetime module)

## Problem
`components/windowMemory/frameMemory.ts` is deep and tested (parse, remember on close, place
restored). Its glue is shallow and untested, and the three open runtime risks of the window
memory hardening ticket sit exactly there.
- `windowMemory.ts` (245 lines): `_restore` (~182-225) holds the sequencing (async
  `move_resize_frame`, then `_tileWindow` with a named monitor, then patching `originalSize`);
  `_rememberOpenWindows` (~98-114) is the shutdown save; `_appIdOf` (~116-125) is the only
  definition of which windows count and is private.
- Race between restore and auto-tiling is split across three modules: `windowMemory.ts` (~131-142,
  `window-created` then `shown`), `tilingManager.ts` (~299-303 and 1270-1313, `_autoTile`, `first-frame`
  re-check, `hasEntryFor`), `extension.ts` (~170-173, closure `restoreTile` per monitor).
- One TilingManager per monitor each connects `window-created` and each asks `hasEntryFor`
  through a static singleton (`WindowMemory._instance`).
- The ordering of `first-frame` versus `shown` is assumed, written down nowhere.

Deletion test: removing `hasEntryFor` makes the two features fight, so the coupling is real;
today it lives in a static and a callback. Deleting WindowMemory would only move the glue into
extension.ts, so a deeper seam is needed, not removal.

## Goal
One module owns "new window: restore from memory or auto-tile", with the ordering contract
stated in its interface and tested.

## Scope
- Grill the seam (new-window event in, placement decision out; monitor lookup behind it).
- Move the three unobserved runtime risks (shutdown save, auto-tiling vs restore, tile on a
  second monitor) under tests or the dev-stack scenario.
- Add the missing null check in `_autoTile`.

## Out of scope
The behaviour decided in ADR 0002 (remember windows per app) stays unchanged.

## Done when
Tests cover the ordering and the three risks, no module reaches into WindowMemory through a
static, existing frame memory tests stay green, dev stack check on two monitors passes.

## Source
`docs/research/architecture-review-2026-10-16.md`, candidate 2 (Strong).
