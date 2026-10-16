#!/usr/bin/env bash
# Asks the running shell for the extension state. States: 1 ACTIVE, 2 INACTIVE, 3 ERROR.
docker exec -u dev tilingshell-gnome51 bash -c '
  p=$(pgrep -u dev -x gnome-shell | head -1)
  export $(tr "\0" "\n" </proc/$p/environ | grep ^DBUS_SESSION_BUS_ADDRESS=)
  gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Extensions.GetExtensionInfo tilingshell@ferrarodomenico.com' \
 | grep -oE "'(state|enabled|error)': <[^>]*>" | tr -d "<>"
