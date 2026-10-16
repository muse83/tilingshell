#!/usr/bin/env bash
# usage: ./launch-window.sh <app-id> <title> [width height]
# Opens a plain GTK4 test window in the container. The app id is also set as the window class,
# so the extension's per-app features (window memory) treat different ids as different apps.
set -euo pipefail
cd "$(dirname "$0")"
docker cp probe-window.py tilingshell-gnome51:/tmp/probe-window.py
docker exec -u dev -d tilingshell-gnome51 bash -c \
  "export XDG_RUNTIME_DIR=/tmp/xdg-runtime WAYLAND_DISPLAY=wayland-0 GDK_BACKEND=wayland GSK_RENDERER=cairo; exec python3 /tmp/probe-window.py $*"
