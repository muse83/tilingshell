#!/usr/bin/env bash
# Saves a screenshot of the headless session to ./out/screenshot.png
docker exec -u dev tilingshell-gnome51 bash -c '
  p=$(pgrep -u dev -x gnome-shell | head -1)
  export $(tr "\0" "\n" </proc/$p/environ | grep ^DBUS_SESSION_BUS_ADDRESS=)
  gdbus call --session --dest org.gnome.Shell.Screenshot \
    --object-path /org/gnome/Shell/Screenshot \
    --method org.gnome.Shell.Screenshot.Screenshot false false /out/screenshot.png'
