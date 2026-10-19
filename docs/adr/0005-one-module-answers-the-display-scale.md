# 0005 One module answers the display scale

Status: accepted (2026-10-19, maintainer decision in a grilling session)

## Context
Two sources answered one question. The extension derived a yes/no "logical scaling" from the
theme scale factor and passed it, inverted, through the tiling manager, window border manager,
indicator and layout switcher. Other consumers (layout editor, editor dialog, window menu, snap
assist) asked a helper that re-read the theme scale factor itself. When the scale changed, the
extension rebuilt only the tiling managers and the border, and only when the yes/no flipped, so a
change between two physical scales (2 to 3) was ignored.

## Decision
- One module answers: "does anything need explicit scaling" (physical scaling), "which style
  scale for this monitor" (nothing when scaling is logical) and "which scale does this monitor
  have". It announces changes; consumers subscribe and rebuild themselves.
- Detection stays as it was: logical scaling means the theme scale factor is 1. Reading the
  layout mode from the display configuration would only sharpen the rare case of a user who
  chose the physical layout mode on purpose, and could not be verified on the shell side
  (`docs/research/mutter-experimental-features-scaling.md`).
- Any change of the theme scale factor notifies, not only the flip between logical and physical.
- The decision logic has no GNOME imports and is tested with `node --test`. The shell wiring
  (theme context signal, monitor scale lookup) is a thin adapter checked in the dev stack.
- The monitor index question was checked in the dev stack with two monitors: the layout
  manager's monitor list and Mutter's monitor indices are in the same order, so no fix.

## Consequences
No yes/no value passes through the extension any more. The indicator, window border manager and
the extension (for its tiling managers) subscribe on their own.
