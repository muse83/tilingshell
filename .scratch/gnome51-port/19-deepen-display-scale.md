# 19 Deepen: one module answers the display scale

Status: open
Blocked by: none (check the scaling source decision in the scaling detection ticket first)

## Problem
Two sources for one fact.
- `extension.ts` (~757) derives `_logicalScaling` from `St.ThemeContext.scaleFactor === 1` and passes
  it (inverted: `!this._logicalScaling`) to TilingManager, WindowBorderManager, Indicator and
  LayoutSwitcherPopup (`extension.ts` ~82, 162, 195, 235, 342).
- Consumers (`layoutEditor.ts` 36-49, `editorDialog.ts` ~44, `layoutSwitcher.ts` 103-117,
  `overriddenWindowMenu.ts` 135-137) additionally call `getMonitorScalingFactor`
  (`utils/ui.ts` 98-105), which re-reads the theme scale factor itself.
- The `scale-factor` handler (`extension.ts` 219-240) rebuilds managers and border by hand; it
  does not recreate the layout switcher or the window memory.
- `_tilingManagers[monitorIndex]` is indexed by Mutter monitor index but built in
  `getMonitors()` order (`extension.ts` ~171, 270, 402). Related to the monitor names ticket.
- `WindowMemory` is created before `startup-complete` while `_tilingManagers` may be unpopulated.

Deletion test: the boolean is a pass-through; without it the callees would just ask
`getMonitorScalingFactor`.

## Goal
One module gives the scale per monitor and announces changes; consumers rebuild themselves.

## Scope
Grill first; confirm what is the real scale source on GNOME 50+ (see
`docs/research/mutter-experimental-features-scaling.md`). Include the monitor-index versus
getMonitors-order check.

## Done when
No boolean passes through extension.ts, a scale change updates every consumer, dev stack
check with the second virtual monitor passes.

## Source
`docs/research/architecture-review-2026-10-16.md`, candidate 4 (Worth exploring).
