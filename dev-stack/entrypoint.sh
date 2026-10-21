#!/usr/bin/env bash
# Runs inside the container: build extension from /src (read-only), start a headless
# GNOME Shell on Wayland, enable the extension, stream logs to /out.
set -euo pipefail

# Phase 1 (root): the shell expects a system bus and a machine-id, like a real login session.
if [ "$(id -u)" = 0 ]; then
  mkdir -p /out /run/dbus
  chown dev /out
  dbus-uuidgen --ensure
  dbus-daemon --system --fork
  # No systemd in the container: mock logind (and friends) on the system bus.
  for t in logind upower; do
    python3 -m dbusmock --system --template $t >/out/mock-$t.log 2>&1 &
  done
  sleep 2
  python3 /home/dev/mock-login-user.py
  exec runuser -u dev -- "$0"
fi

OUT=/out
UUID="tilingshell@ferrarodomenico.com"
mkdir -p "$OUT"

echo "[stack] building extension" | tee "$OUT/stack.log"
rsync -a --exclude node_modules --exclude dist --exclude dist_legacy /src/ /home/dev/build/
ln -sfn /home/dev/deps/node_modules /home/dev/build/node_modules
(cd /home/dev/build && npm run build) >"$OUT/build.log" 2>&1

EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
mkdir -p "$EXT_DIR"
cp -r /home/dev/build/dist/* "$EXT_DIR/"

cat > /home/dev/session.sh <<'SESSION'
#!/usr/bin/env bash
set -u
export XDG_RUNTIME_DIR=/tmp/xdg-runtime
mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
export GSETTINGS_BACKEND=keyfile

# Upstream metadata does not list GNOME 51 yet; skip the version check so it loads anyway.
gsettings set org.gnome.shell disable-extension-version-validation true
# The first-run welcome dialog is modal and swallows the first pointer press, so virtual drags
# did nothing. Pretend a newer version was already shown.
gsettings set org.gnome.shell welcome-dialog-last-shown-version '999'
gsettings set org.gnome.shell enabled-extensions "['tilingshell@ferrarodomenico.com']"

exec gnome-shell --unsafe-mode --headless --wayland --no-x11 --virtual-monitor 1920x1080 ${SECOND_MONITOR:+--virtual-monitor 1280x720} \
  >/out/gnome-shell.log 2>&1
SESSION
chmod +x /home/dev/session.sh

echo "[stack] starting $(gnome-shell --version)" | tee -a "$OUT/stack.log"
exec dbus-run-session -- /home/dev/session.sh
