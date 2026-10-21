# 0006 One module decides the edge tile

Status: accepted (2026-10-19, maintainer decision: one entry function, tests only there)

## Context
The edge tiling manager (898 lines) mixed the zone maths with settings reads and state inside a
GObject class. The three strategies (default, adaptive, granular) were near-copies of each
other, and nothing was tested.

## Decision
- One module (`edgeTilingGeometry`) answers "which zone is the pointer in and where does the
  window go". Input: pointer, work area, corner threshold, mode, the layout's tiles, the active
  zone. Output: changed, zone, target rectangle. A second function says whether the pointer is
  near enough to an edge to start at all.
- The three strategies stay internal to the module. Tests go through the entry functions only.
- The manager keeps what needs GNOME: settings binding, layout lookup, "edge tiling in
  progress", the active zone and the top-edge maximise rule.
- No GNOME imports at runtime; tested with `node --test` (`tests/edgeTilingGeometry.test.ts`).

## Behaviour kept on purpose
- Target rectangles are cut to whole pixels, as GNOME rectangles are. Odd screen widths give
  the right half one pixel more than a float calculation would.
- A pointer in no zone still counts as "edge tiling in progress" (old behaviour). Possibly
  unintended; it needs a tiny threshold and a large edge offset to occur.
- Default mode checks only the corners of the pointer's screen half, layout modes check left
  corners first. This differs only on the seam at a 50% threshold with odd widths.
- An unknown mode value acts like default mode.

## Verification (2026-10-19, extended 2026-10-21)
- 42 unit tests; full suite 124 passing; typecheck and build clean.
- Live check added 2026-10-21 after the dev stack's pointer drag was fixed: top-edge drag
  maximises and keeps the tile; a left-edge drag tiles the left half (default), the whole left
  column (adaptive) or the tile level with the pointer (granular). Steps 4 and 8 to 10 of
  `scenario-maximise-tiled.sh`. Corner and right-edge zones are covered by unit tests only.

## Left out on purpose
- The manager's state rules (in progress without zone, top-edge maximise) are not unit tested;
  they sit in the GNOME-bound class. They could move into the module later.
