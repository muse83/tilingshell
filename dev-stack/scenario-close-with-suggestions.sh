#!/usr/bin/env bash
# Reproduces: tile a window by dragging (Ctrl held) so window suggestions appear, then close all
# windows. Prints whether the shell survived.
# usage: SUGG=1 BORDER=1 ./scenario-close-with-suggestions.sh   (SUGG/BORDER: 1 on, 0 off)
set -uo pipefail
cd "$(dirname "$0")"
SUGG=${SUGG:-1}; BORDER=${BORDER:-1}
nap() { python3 -c "import time;time.sleep($1)"; }
ev() { timeout 25 ./eval.sh "$1" | sed "s/^(true, '\"\?//;s/\"\?')$//"; }
X="__M.extensionManager.lookup('tilingshell@ferrarodomenico.com').stateObj"
FRAME="global.get_window_actors().map(a=>a.metaWindow).map(x=>{const r=x.get_frame_rect(); return x.get_title()+' '+r.x+','+r.y+' '+r.width+'x'+r.height}).join(' ; ')"
# alive = the container runs and the shell still answers (a crash can take a moment to show)
alive() { nap 3; docker ps --format '{{.Status}}' | grep -q '^Up' && timeout 20 ./eval.sh "1" >/dev/null 2>&1; }

until ./status.sh 2>/dev/null | grep -q "'state': 1"; do nap 2; done
ev "import('resource:///org/gnome/shell/ui/main.js').then(m => { globalThis.__M = m; }); 'ok'" >/dev/null; nap 1
ev "$(cat input-helpers.js)" >/dev/null
ev "const s=$X.getSettings(); s.set_boolean('enable-tiling-system-windows-suggestions', $([ "$SUGG" = 1 ] && echo true || echo false)); s.set_boolean('enable-window-border', $([ "$BORDER" = 1 ] && echo true || echo false)); s.set_boolean('remember-windows', false); 'cfg'" >/dev/null
for n in Alpha Beta Gamma; do ./launch-window.sh test.$n $n 480 320; done; nap 5
mv_() { ev "const {GLib}=imports.gi; __dev.notify_absolute_motion(GLib.get_monotonic_time(), $1, $2); 'm'" >/dev/null; }
btn() { ev "const {Clutter,GLib}=imports.gi; __dev.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.$1); 'b'" >/dev/null; }
mv_ 700 380; nap 1; mv_ 760 411; nap 1.5
ev "__ctrl(true); 'c'" >/dev/null; nap 0.3; btn PRESSED; nap 0.5
for p in "700 380" "600 330" "500 300" "420 280" "900 400" "960 500"; do mv_ $p; nap 0.25; done
nap 1; btn RELEASED; nap 1; ev "__ctrl(false); 'c'" >/dev/null; nap 2
echo "frames: $(ev "$FRAME")"
echo "previews: $(ev "const f=[]; const walk=a=>{ if (a._windowLayout) f.push(a._metaWindow.get_title()); a.get_children().forEach(walk); }; walk(global.stage); f.join(',') || 'none'")"
ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'close'" >/dev/null
nap 6
if alive; then echo "RESULT SUGG=$SUGG BORDER=$BORDER: shell survived (windows: $(ev 'global.get_window_actors().length'))"
else echo "RESULT SUGG=$SUGG BORDER=$BORDER: SHELL CRASHED ($(docker ps -a --format '{{.Status}}' | head -1))"; fi
