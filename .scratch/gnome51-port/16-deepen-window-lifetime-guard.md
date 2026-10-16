# 16 Deepen: one module answers "is this window still alive?"

Status: open
Blocked by: none

## Problem
The shell crash on closing windows with suggestions (shell crash ticket) and the null-safety
work (null safety ticket) had the same root: code touches a window or its actor after the
window is gone. Each fix guards only its own place.
- The guard lives as a local closure in `components/windowsSuggestions/tilingLayoutWithSuggestions.ts`
  (`isWindowGone`) and covers only the destroy, completion and stop callbacks. `_recursivelyShowPopup`
  in the same file still calls `set_pivot_point` and `ease` on the actor unguarded.
- Unguarded or cast-only `get_compositor_private()` uses remain in `tilingManager.ts` (~975),
  `tilePreview.ts` (147, 162), `resizeManager.ts` (~423), `snapAssist.ts` (~309),
  `windowBorder.ts` (~95), `tilingShellWindowManager.ts` (~131), `extension.ts` (~585);
  `tilingLayout.ts` (~112) is guarded.
- `_autoTile` in `tilingManager.ts` (~1291) connects on the actor without a null check.
- About 87 `ExtendedWindow` / `as any` style casts across `src/`.

Deletion test: the concept "window is alive, here is its actor, or nothing" is re-derived per
call site; concentrating it removes complexity instead of moving it. It is a deep-module
candidate: small interface, many callers (leverage), one place to fix (locality).

## Goal
One module owns window-lifetime checks and safe actor animation; call sites stop doing their own.

## Scope
- Grill the interface first (what do callers need: actor-or-nothing, safe ease/show/hide?).
- Replace the ad hoc checks listed above.
- Add tests for the module through its interface (pure/with fake window and actor, no GNOME).

## Out of scope
Tile state ownership (see tile state ticket), window memory sequencing (see window placement ticket).

## Done when
The listed call sites use the module, tests cover alive/destroyed/unmanaging windows, type check,
lint, build and `dev-stack/scenario-close-with-suggestions.sh` ("shell survived") pass.

## Source
`docs/research/architecture-review-2026-10-16.md`, candidate 1 (Strong).
