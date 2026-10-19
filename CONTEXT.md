# Context

Glossary of the terms this project uses. Decisions are in `docs/adr/`.

- **Tile**: one fixed area of the screen a window snaps into, with a position and size relative
  to the work area.
- **Layout**: a division of a monitor's work area into tiles.
- **Tile state**: what is known about one window: which tile it sits in (if any) and the size it
  had before it was tiled. Owned by one module (ADR 0004). Maximising a window forgets its tile
  for now (ADR 0004; a ticket changes this for edge maximise).
- **Size before tiling**: the size a window gets back when it leaves its tile.
- **Vacant tile**: a tile of the layout that no tiled window that is neither minimised nor
  maximised covers.
- **Window memory**: the remembered frame per application, restored for new windows (ADR 0002).
- **Window placement**: the single decision, when a window is shown, whether to restore it,
  auto-tile it or leave it alone (ADR 0003).
