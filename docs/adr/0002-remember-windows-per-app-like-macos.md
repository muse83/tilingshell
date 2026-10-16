# 0002 Remember window frame per app, like macOS

Status: accepted (2026-10-13, maintainer decision)

## Context
Users want an app's window to come back with the size, position and tile it had when it was
last closed, also after logout or reboot. Mutter 51 has its own session management for Wayland
(the `xdg-session-management` protocol, state saved by Mutter), but it only works for apps that
implement the protocol, which almost none do today. The shell extension API gives no way to ask
whether a given window was restored by Mutter.

## Decision
- The extension remembers the last known frame **per application** (one slot per app, the
  application id as key) and applies it to every new window of that app. Behaviour follows macOS.
- Remembered: size, free position, tile, and the maximised flag. A window closed while tiled
  comes back in that tile; the size it had before tiling is kept so dragging it out of the
  tile restores it.
- The extension never invents a size. If the free size is unknown (a window closed tiled or
  maximised with no size from before tiling), only the tile or the maximised flag is stored and
  the application keeps its own default size (decided 2026-10-14, maintainer).
- Monitor independent: a remembered position outside every monitor, or bigger than the work
  area, is moved/shrunk onto the nearest monitor. The entry is not discarded.
- A second window of the same app is offset slightly so it does not cover the first.
- One central switch (default off) and a button to clear everything. Not part of exported settings.
- Mutter's own session management is not used explicitly. Where an app uses it, both restore the
  same last known state, so they do not fight in practice.
- Stored as a JSON string in the extension's own settings, at most 200 apps (least recently used
  dropped).

## Consequences
- Tiling Shell always applies its remembered frame after the window is shown, also for apps
  that Mutter restored natively. If the two ever disagree, the extension wins.
- Per-window memory (several windows of one app, each with its own place) is not supported.
