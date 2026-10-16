#!/usr/bin/env bash
# Opens the extension's preferences in the running stack and prints warnings/errors from building it.
set -euo pipefail
cd "$(dirname "$0")"
docker cp prefs-harness.js tilingshell-gnome51:/tmp/prefs-harness.js
docker exec -u dev tilingshell-gnome51 bash -c '
  p=$(pgrep -u dev -x gnome-shell | head -1)
  export $(tr "\0" "\n" </proc/$p/environ | grep ^DBUS_SESSION_BUS_ADDRESS=)
  export XDG_RUNTIME_DIR=/tmp/xdg-runtime WAYLAND_DISPLAY=wayland-0 GDK_BACKEND=wayland GSK_RENDERER=cairo
  export GI_TYPELIB_PATH=/usr/lib/gnome-shell/girepository-1.0 LD_LIBRARY_PATH=/usr/lib/gnome-shell
  timeout 40 gjs -m /tmp/prefs-harness.js 2>&1 | grep -v "portal.Settings\|^$"'
