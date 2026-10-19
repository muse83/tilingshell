# 0004 One module manages a window's tile state

Status: accepted (2026-10-19, maintainer decision in a grilling session)

## Context
The tile state of a window (the tile it sits in, and the size it had before it was tiled) hangs
as two loose fields on the GNOME window object. About ten places in seven files read and write
it (tiling manager, suggestions, window memory, window placement, extension, alt-tab, window
border resizing, raise together, window menu, global state). Nobody owns the rules. The
calculation "which tiles are vacant" exists twice (auto-tiling in the tiling manager, the
suggestion previews), and the two copies treat maximised windows differently. Nothing of this
runs without GNOME, so none of it is tested.

## Decision
- One module manages the tile state. It is global (not per monitor): the state belongs to the
  window and knows no monitor.
- It owns both fields, the four write operations (tile a window, release it by drag, release it by
  keyboard or menu, forget it) with their rules (size before tiling is remembered once, only for
  a window that was not tiled and not maximised; the minimum drag distance), the queries
  ("is it tiled", "which windows are tiled", "is it already in this tile") and the one
  calculation of vacant tiles.
- Nobody outside the module reads or writes the fields. The fields on the GNOME window are removed.
- Two layers behind one interface: the rules run under plain Node without GNOME; a thin GNOME
  layer only moves windows. The interface of the module is the only test seam. Behaviour in the
  real shell is checked with the dev stack scenarios.
- Behaviour is carried over 1:1. In particular, maximising a window, whichever way, still
  forgets its tile. In the single vacant-tiles calculation, maximised and minimised windows
  occupy nothing.
- Steps inside the ticket: first the state rules and queries, then the vacant-tiles calculation.

## Consequences
- The module keeps the tile independent of the maximised flag, so a later ticket can make a
  window maximised by dragging to the top edge (or by keyboard "up" in the top row) count as
  tiled, while maximising with the window button stays "not tiled". Today both are the same
  (not tiled). That change is user-visible (alt-tab, directional focus, raise together,
  suggestions, window memory) and gets its own ticket and an amendment to ADR 0002.
- Slimming the long drag and release functions of the tiling manager is a separate ticket.

## Amendment (2026-10-19, maintainer decision in a grilling session)
Maximising is no longer carried over 1:1. Edge and keyboard maximise keep the window tiled in
the whole-screen tile and remember the tile from before; unmaximising brings that tile back.
The window button still forgets the tile. Tiled windows maximised this way take part in
alt-tab, directional focus and raise together, and occupy the whole screen in the vacant-tiles
calculation (suggestions, auto-tiling). In that calculation only minimised windows occupy
nothing now.
