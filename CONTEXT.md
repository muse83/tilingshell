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
- **Window suggestions**: the offer, right after a window was tiled, to fill the remaining
  tiles with windows that are not tiled yet.
