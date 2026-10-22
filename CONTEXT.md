# Context

Glossary of the terms this project uses. Decisions are in `docs/adr/`.

- **Tile**: one fixed area of the screen a window snaps into, with a position and size relative
  to the work area.
- **Layout**: a division of a monitor's work area into tiles.
- **Tile state**: what is known about one window: which tile it sits in (if any) and the size it
  had before it was tiled. Owned by one module (ADR 0004). Maximising by the top edge or by
  keyboard keeps the window tiled (whole-screen tile); maximising with the window button
  forgets the tile (ADR 0004).
- **Size before tiling**: the size a window gets back when it leaves its tile.
- **Vacant tile**: a tile of the layout that no tiled, non-minimised window covers.
- **Window memory**: the remembered frame per application, restored for new windows (ADR 0002).
- **Window placement**: the single decision, when a window is shown, whether to restore it,
  auto-tile it or leave it alone (ADR 0003).
- **Display scale**: how the screen is scaled. Logical (default on GNOME 50+): the shell's theme
  scale stays 1 and sizes are already divided by the monitor scale. Physical: the theme scale
  carries the scale and widgets are styled with it. Answered by one module (ADR 0005).
- **Edge zone**: a strip along the border of the work area (corners, left, right, top centre)
  that a dragged window can be dropped on to tile it. Which zone the pointer is in and the
  resulting target area are decided in one module without GNOME code.
- **Drop decision**: the single decision, when a dragged window is released, whether nothing
  happens, the window is maximised by the top edge (keeping its tile) or it is tiled, and in
  the tile case whether window suggestions open, on which layout, and whether the monitor's
  layout follows the snap assistant's. Decided in one module without GNOME code (ADR 0007).
- **Drag decision**: the single decision, on every tick while a window is dragged, what is shown:
  the layout, the edge preview, the snap assistant, nothing, or "close everything" (other
  monitor, window cannot move or resize). It also says "unchanged" when keys and pointer are
  unchanged. Decided in the same module as the drop decision (ADR 0007).
- **Window suggestions**: the offer, right after a window was tiled, to fill the remaining
  tiles with windows that are not tiled yet.
- **Settings group**: one topic of the settings (layouts, spacing, window memory, appearance,
  behaviour, shortcuts, version and migration) with its own interface. Together they form the
  settings module (ADR 0008).
- **Settings storage**: where settings values live behind the settings module. GNOME settings in
  production, memory in tests. Offers read and write (text, switches, whole numbers, lists) and a
  change notification per key that every group uses for `connect` (ADR 0008).
- **Layout repair**: when stored layout data is empty or broken, it is replaced by the default
  layouts.
- **Migration**: the compatibility changes applied to stored settings when the last installed
  version differs from the running one.
- **Start order**: which parts of the extension start before which others; stop runs in reverse
  (ADR 0008).
