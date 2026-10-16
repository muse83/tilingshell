# GNOME 51 port: behavioural verification

Date: 2026-10-15. Build under test: fork branch `gnome51-port` at 4792c19.
Environment: `dev-stack/` (GNOME Shell 51.0, headless Wayland, unsafe mode).
No human-interactive access; input is injected through a virtual seat.

## Method
- Test windows: GTK4 client (`probe-window.py`, `launch-window.sh`), one app id per window.
- Input: virtual pointer/keyboard via `input-helpers.js` (`__drag`, `__kb`, `__ctrl`).
  Drags only work reliably with slow stepwise motion (~0.25 s per step, wait before press)
  and Ctrl held (default tiling activation key).
- State inspected through `eval.sh` (extension instance, settings, GlobalState).
- Preferences dialog: `prefs-harness.js` / `prefs-check.sh` (own harness, because the
  Extensions app does not start in the container: missing portal/typelib).
- Crash scenario: `scenario-close-with-suggestions.sh` (env `SUGG`, `BORDER`).

## Results
| Area | Result |
|---|---|
| Tiling by drag | works (window snaps to the tile, frame matches tile) |
| Window suggestions: show, hover, leave, click | works |
| Window memory (remember frame per app) | works; see limits below |
| Window border (colour, custom colour) | works |
| Preferences dialog builds | works (one upstream Gtk-CRITICAL, harmless) |
| Keybindings | work, except `untile-window` which is unbound by default |
| Indicator menu | works, closes with the GNOME 51 popup animation enum |
| Rapid open/close of windows (suggestions off) | shell survives |
| **Close all windows while suggestions are shown** | **shell crashes (SIGSEGV, exit 139)** |

## Finding 1: shell crash when closing windows with suggestions shown
- Reproducible: tile one window by Ctrl-drag with suggestions enabled, then close all windows.
- Independent of the window border (BORDER=0 still crashes).
- With suggestions disabled the shell survives.
- Present at every tested commit: 4792c19, 4c19bd4, 33e34ef, 3ea2e05 and e1c8e34
  (first "support GNOME 51" commit). So it pre-dates the null-safety/format work.
- Backtrace (from the core dump of the e1c8e34 run, symbolised in the container; function
  names inside mutter are stripped, only library and call path are known):
  1. A JS call destroys an actor (`clutter_actor_destroy` -> dispose -> `destroy` signal).
  2. A JS `destroy` handler runs and calls `clutter_actor_show` on another actor.
  3. The `show` signal handler inside libmutter dereferences a null pointer
     (`testb $0x10, 0x26a(%rbp)` with `rbp` = NULL) -> SIGSEGV.
- Most likely cause (extension side): `tilingLayoutWithSuggestions.ts`, the `destroy` handler of
  the suggestion clone calls `winActor.show()` on the real window actor. When the window is
  being closed, that actor is already detached from its meta window, and mutter's show
  handler crashes on it. This was confirmed by the fix, see below.
- Confirmed by the fix (2026-10-15): guarding the three callbacks against a gone window makes the
  scenario report "shell survived" with and without border.
- So the trigger is the extension, the crash itself is a missing null check in mutter.
  Fix direction: do not touch the window actor in that handler if the window is gone
  (check the window is still alive / listen to its `unmanaging`), see ticket.
- Not fixed in this session (scope). Suggested next step: separate ticket, start by getting
  a backtrace (coredump / gdb in container) and by clearing previews on window destroy.
- Logs: `dev-stack/out/gnome-shell.log` after a run.

## Finding 2: upstream duplicate in preferences
`prefs.ts` adds the behaviour group to the page twice (right after creating the suggestions
group). GTK logs a CRITICAL; UI still works. Upstream bug, not fixed.

## Limits / notes
- Maximized-then-closed windows store no free size (by design, see ADR 0002).
- `untile-window` has no default binding, so it was only tested after setting one.
- Extensions app does not start in the container; prefs verified via own harness.
- Visual result was judged from screenshots and frame/tile numbers, not by a human.
