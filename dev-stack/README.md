# GNOME 51 dev stack

Disposable Docker container: CachyOS userland (same family as the Arch host) with
GNOME Shell 51.0, running headless on Wayland with the extension from the repo root (`..`) loaded.

## Scope and access (read first)
- **Fork only.** This directory is a personal development aid. It lives on the fork's branch
  `gnome51-port` and never goes into a pull request to the upstream repo.
- **No interactive access.** Claude Code and this whole Arch machine run as a VM on the
  maintainer's host PC; the maintainer reaches it only through an SSH terminal. The dev stack
  is a container inside that VM, so it is two layers away from anything the maintainer can see. There is no window, no VNC, no way for a human to look at or
  click in the GNOME session. The stack is for building and testing by the agent only:
  verification goes through `status.sh`, `screenshot.sh` and the logs in `out/`.
- **The maintainer cannot view screenshots either.** `screenshot.sh` is for the agent only
  (it reads the image itself). Anything the maintainer needs to know must be reported as
  text: extension state, log excerpts, and a plain-language description of what is on screen.
- Consequence for reviews: a human cannot "just try it" or look at an image. Evidence must
  be written down as text, never as "see screenshot".

| Command | What it does |
| --- | --- |
| `./up.sh` | Build image, build the extension, start the session (~40 s until ready). `SECOND_MONITOR=1 ./up.sh` adds a second virtual monitor |
| `./down.sh` | Remove the container |
| `./status.sh` | Extension state as seen by the shell (1 ACTIVE, 2 INACTIVE, 3 ERROR) + error text |
| `./screenshot.sh` | Screenshot of the session to `out/screenshot.png` |
| `./eval.sh '<js>'` | Runs a JavaScript expression inside the live shell (unsafe mode) and prints the result. For checking a GNOME API call on the real shell, e.g. `./eval.sh "global.get_window_actors().length"` |
| `./launch-window.sh <name>` | Starts a GTK4 probe test window with its own app id (copies `probe-window.py` in first) |
| `input-helpers.js` | Paste via `eval.sh`: defines virtual pointer/keyboard helpers (`__drag`, `__kb`, `__ctrl`). Drags need slow steps |
| `./scenario-close-with-suggestions.sh` | Ctrl-drag tile with suggestions, close all windows, report whether the shell survived (`SUGG`, `BORDER` env) |
| `./scenario-suggestions-hover-click.sh` | Suggestions: hover shows the title overlay, click tiles the window |
| `./measure-placement.sh` | `MODE=restore\|autotile\|both\|tile`: samples a new window every 4 ms and fails if it was visible at a wrong frame, ended elsewhere than expected or took longer than `MAX_MS` (default 50) |
| `./scenario-window-placement.sh` | Where a new window goes: all modes x3, cascading, taken tile, second monitor, shutdown save. Needs `SECOND_MONITOR=1 ./up.sh`; prints PASS/FAIL, exit 1 on failure. "Tiled or not" is read from what the window memory writes down when a window is closed, not from the window |
| `./scenario-maximise-tiled.sh` | Maximise and tile: keyboard up / top-edge drag keep the window tiled, left-edge drag tiles in all three edge modes, window button does not, keyboard down brings the tile back, window memory round trip, no tile beside a maximised tiled window. Run it on a freshly started stack (`./up.sh`); the placement scenario is timing sensitive and reports false failures after other scenarios ran |
| `./prefs-check.sh` | Builds the preferences dialog in an own harness (`prefs-harness.js`) and reports errors |

Fixed (2026-10-21): `__drag` did not move windows right after the session start. Two causes, both in the stack, not in the extension: the first-run welcome dialog and the start overview each hold a modal grab, so the first press only closed them, and the pointer rests in the hot corner (0,0), whose barrier let the first absolute motion slide along the top edge, so the press hit the panel. `entrypoint.sh` suppresses the welcome dialog, `__drag` leaves the corner and hides the overview itself. Edge tiling is checked live: step 4 (top edge) and steps 8 to 10 (left edge in all three modes) of `scenario-maximise-tiled.sh`.

Logs on the host in `out/`: `gnome-shell.log` (shell journal), `build.log`, `stack.log`, `mock-*.log`.
Re-run `./up.sh` after source changes (it rebuilds and restarts; image layers are cached).

## Why this base
- `cachyos/cachyos` ships `gnome-shell`/`mutter` 51.0 from Arch `extra` (checked 2026-10-13);
  the host repo is no longer limited to 50.x. Fedora 45 was the fallback, not needed.
- Container, not VM: shares the host kernel, starts in seconds, trivially disposable.

## Container workarounds (not extension bugs)
- No systemd: `login1` and `upower` are mocked on the system bus with python-dbusmock
  (`mock-login-user.py` patches a bug in the logind template's `GetUser`).
- Pacman hooks do not run during the image build, so GSettings schemas are compiled explicitly.
- `disable-extension-version-validation` is on, because upstream metadata does not list 51 yet.
- `--unsafe-mode` lets the Screenshot D-Bus API accept our calls. Dev only.
- Warnings about colord, GDM, polkit, geoclue, calendar server are expected noise.

## Current result
GNOME 51 port at 4792c19 loads and works; see `docs/research/gnome51-port-verification.md`
(includes one open shell crash when closing windows while suggestions are shown).
