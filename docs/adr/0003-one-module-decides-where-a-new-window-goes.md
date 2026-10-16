# 0003 One module decides where a new window goes

Status: accepted (2026-10-16, maintainer decision in a grilling session)

## Context
A new window had two independent deciders: the window memory (ADR 0002) restored the remembered
frame, and the per-monitor tiling manager auto-tiled. They were coordinated through a static
singleton (`hasEntryFor`) and a second check at the window's first frame. The ordering of the
window events was written down nowhere. Measured on GNOME 51 (dev stack, 2026-10-16): the
window is created, about 18 ms later it is shown (the application id is known only now), and
about 3 ms after that the first frame is drawn. The window reached its final frame after
21-28 ms, and in every case it was visible for one sample at the application's own position
before it moved.

## Decision
- One module (`windowPlacement`) listens to new windows once and decides once, when the window
  is shown: restore, auto-tile, or leave alone. The tiling managers and the window memory only
  carry out the decision. The static lookup and the first-frame re-check are removed.
- Ranking: (1) a remembered entry for the application wins (position and size, or tile, or
  maximised) when the feature is on and the window can be moved and resized; (2) otherwise
  auto-tiling when it is on and the window qualifies; (3) otherwise the application decides.
  Auto-tiling never runs for a window that has a remembered entry.
- A new window is never visible at a wrong place and never glides. It is kept hidden from the
  decision until it has its final frame, then shown. A safety timeout shows it anyway so a
  window can never stay invisible. Its length is derived from measurements, not guessed.
- Another window of the **same application** already at the remembered place: the new window is
  cascaded slightly, like Windows and macOS. For a remembered tile the new window gets the
  tile's size, cascaded, and is **not** tiled (a tile cannot be offset); it can be dragged into
  a tile afterwards. Windows of other applications at the place are ignored.
- Remembering on close and on shutdown stays in the window memory, which stays small. The new
  module only asks it whether an entry exists.
- Speed is a requirement: the decision is synchronous, no artificial waiting. Time until the
  window is visible at its final frame must not be worse than before.
- Tests: the decision runs under plain Node without GNOME. Behaviour is tested with real
  windows in the dev stack (`dev-stack/measure-placement.sh` and the scenarios), repeated, and
  a ticket of this kind is only done when they pass.

## Consequences
- ADR 0002 is unchanged in behaviour except the occupied-tile case above (before: the new
  window covered the other one completely).
- The monitor index used to look up a tiling manager is checked on two monitors as part of the
  ticket; if it is wrong it is corrected there.
