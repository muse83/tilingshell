#!/usr/bin/env bash
# usage: eval.sh '<js expression>'  -- runs in the dev stack shell (unsafe mode)
docker exec -u dev -i tilingshell-gnome51 bash -c '
  p=$(pgrep -u dev -x gnome-shell | head -1)
  export $(tr "\0" "\n" </proc/$p/environ | grep ^DBUS_SESSION_BUS_ADDRESS=)
  gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "$0"' "$1"
