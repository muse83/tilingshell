#!/usr/bin/env bash
# Verifies that window suggestions still react to hover and click:
# tile a window by Ctrl-drag so suggestions appear, then move the pointer onto a suggestion
# (its title overlay must show), off it again (overlay hides) and click it (window gets tiled).
# usage: ./scenario-suggestions-hover-click.sh
set -uo pipefail
cd "$(dirname "$0")"
nap() { python3 -c "import time;time.sleep($1)"; }
ev() { timeout 25 ./eval.sh "$1" | sed "s/^(true, '\"\?//;s/\"\?')$//;s/\\\\//g"; }
X="__M.extensionManager.lookup('tilingshell@ferrarodomenico.com').stateObj"
FRAME="global.get_window_actors().map(a=>a.metaWindow).map(x=>{const r=x.get_frame_rect(); return x.get_title()+' '+r.x+','+r.y+' '+r.width+'x'+r.height}).join(' ; ')"
# JS: collect suggestion actors as [title, centerX, centerY, overlayShown]
SUGG="(()=>{const f=[]; const walk=a=>{ if (a._windowLayout) { const c=a.get_window_clone()??a; const [x,y]=c.get_transformed_position(); const [w,h]=c.get_transformed_size(); f.push([a._metaWindow.get_title(), Math.round(x+w/2), Math.round(y+h/2), a._overlayShown]); } a.get_children().forEach(walk); }; walk(global.stage); return JSON.stringify(f); })()"

until ./status.sh 2>/dev/null | grep -q "'state': 1"; do nap 2; done
ev "import('resource:///org/gnome/shell/ui/main.js').then(m => { globalThis.__M = m; }); 'ok'" >/dev/null; nap 1
ev "$(cat input-helpers.js)" >/dev/null
ev "const s=$X.getSettings(); s.set_boolean('enable-tiling-system-windows-suggestions', true); s.set_boolean('enable-window-border', false); s.set_boolean('remember-windows', false); 'cfg'" >/dev/null
for n in Alpha Beta Gamma; do ./launch-window.sh test.$n $n 480 320; done; nap 5
mv_() { ev "const {GLib}=imports.gi; __dev.notify_absolute_motion(GLib.get_monotonic_time(), $1, $2); 'm'" >/dev/null; }
btn() { ev "const {Clutter,GLib}=imports.gi; __dev.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.$1); 'b'" >/dev/null; }
mv_ 700 380; nap 1; mv_ 760 411; nap 1.5
ev "__ctrl(true); 'c'" >/dev/null; nap 0.3; btn PRESSED; nap 0.5
for p in "700 380" "600 330" "500 300" "420 280" "900 400" "960 500"; do mv_ $p; nap 0.25; done
nap 1; btn RELEASED; nap 1; ev "__ctrl(false); 'c'" >/dev/null; nap 2

echo "frames before: $(ev "$FRAME")"
S0=$(ev "$SUGG"); echo "suggestions: $S0"
read -r TITLE CX CY <<<"$(python3 -c "import json,sys; s=json.loads(sys.argv[1]); print(s[0][0], s[0][1], s[0][2]) if s else print('none 0 0')" "$S0")"
[ "$TITLE" = none ] && { echo "RESULT: FAIL no suggestions shown"; exit 1; }

mv_ 5 5; nap 1                       # pointer away from every suggestion
mv_ "$CX" "$CY"; nap 1.5             # hover the first suggestion
echo "hover on $TITLE: $(ev "$SUGG")"
mv_ 5 5; nap 1.5                     # leave
echo "after leave: $(ev "$SUGG")"
mv_ "$CX" "$CY"; nap 1; btn PRESSED; nap 0.2; btn RELEASED; nap 2.5   # click
echo "frames after click: $(ev "$FRAME")"
echo "suggestions after click: $(ev "$SUGG")"
