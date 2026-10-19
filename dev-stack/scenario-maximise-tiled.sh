#!/usr/bin/env bash
# Maximise and the tile: edge and keyboard maximise keep a window tiled (whole-screen tile), the
# window button does not. Checked on the real shell. Needs: ./up.sh (one monitor is enough).
# "Tiled or not" is read from what the window memory writes down when a window is closed.
#   1 keyboard up in the top row: maximised and tiled
#   2 window button on a tiled window: maximised, not tiled
#   3 keyboard down after keyboard up: tile from before is back (auto-tiling off and on)
#   4 top-edge drag: maximised and tiled
#   5 remembered maximised+tiled window comes back maximised and tiled
#   6 a window maximised tiled occupies the whole screen: auto-tiling puts no new window beside it
#   7 maximise refused by keyboard must not make a later window-button maximise count as tiled
# usage: ./scenario-maximise-tiled.sh
set -uo pipefail
cd "$(dirname "$0")"
nap() { python3 -c "import time;time.sleep($1)"; }
ev() { timeout 25 ./eval.sh "$1" | sed "s/^(true, '\"\?//;s/\"\?')$//;s/\\\\//g"; }
UUID=tilingshell@ferrarodomenico.com
X="__M.extensionManager.lookup('$UUID').stateObj"
APP=test.Max
FAILS=0
check() { if [ "$2" = ok ]; then echo "PASS $1"; else echo "FAIL $1: $2"; FAILS=$((FAILS+1)); fi; }
# JS: first window as [x,y,width,height,maximised]
WIN="JSON.stringify(global.get_window_actors().map(a=>a.metaWindow).map(w=>{const r=w.get_frame_rect(); return [r.x,r.y,r.width,r.height,w.maximizedHorizontally&&w.maximizedVertically]}))"
FIRST="global.get_window_actors()[0].metaWindow"
UP=2; DOWN=3
key() { ev "$FIRST.activate(global.get_current_time()); 'focus'" >/dev/null; nap 1
  ev "$X._keybindings.emit('move-window', global.display, $1); 'key'" >/dev/null; nap 2; }
# close all windows and print the entry the window memory wrote for $APP
closed_entry() {
  ev "const s=$X.getSettings(); s.set_string('remembered-windows','{}'); global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'del'" >/dev/null; nap 2
  ev "$X.getSettings().get_string('remembered-windows')"
}
setup() { # auto-tiling, entry json
  ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'close'" >/dev/null; nap 2
  ev "const s=$X.getSettings(); s.set_boolean('remember-windows', true); s.set_boolean('enable-autotiling', $1); s.set_boolean('top-edge-maximize', true); s.set_string('remembered-windows', '$2'); 'cfg'" >/dev/null
}
# python check on an entry: $1 entry json, $2 python expression over e (the app entry)
entry_is() { python3 -c "
import json,sys
e=json.loads(sys.argv[1]).get('$APP',{})
print('ok' if $2 else 'got '+sys.argv[1])" "$1"; }
WHOLE="e.get('tile') and (e['tile']['x'],e['tile']['y'],e['tile']['width'],e['tile']['height'])==(0,0,1,1)"
HALF="e.get('tile') and (e['tile']['x'],e['tile']['y'],e['tile']['width'],e['tile']['height'])==(0,0,0.5,1)"
HALFTILE='{"x":0,"y":0,"width":0.5,"height":1,"groups":[]}'
FRAME='{"x":300,"y":200,"width":500,"height":350}'
TILED="{\"$APP\":{\"frame\":$FRAME,\"tile\":$HALFTILE}}"

until ./status.sh 2>/dev/null | grep -q "'state': 1"; do nap 2; done
ev "import('resource:///org/gnome/shell/ui/main.js').then(m => { globalThis.__M = m; }); 'ok'" >/dev/null; nap 1
ev "$X.getSettings().set_boolean('enable-move-keybindings', true); 'kb'" >/dev/null

# 1 keyboard up
setup false "$TILED"; ./launch-window.sh $APP One 480 320; nap 3
key $UP
r=$(python3 -c "import json,sys; w=json.loads(sys.argv[1]); print('ok' if len(w)==1 and w[0][4] else 'got '+sys.argv[1])" "$(ev "$WIN")")
if [ "$r" = ok ]; then r=$(entry_is "$(closed_entry)" "e.get('maximized') and $WHOLE"); fi
check "1 keyboard up maximises and keeps the window tiled" "$r"

# 2 window button
setup false "$TILED"; ./launch-window.sh $APP One 480 320; nap 3
ev "$FIRST.maximize(); 'max'" >/dev/null; nap 2
r=$(entry_is "$(closed_entry)" "e.get('maximized') and 'tile' not in e")
check "2 window button maximises without a tile" "$r"

# 3 keyboard down brings the tile back, with auto-tiling off and on
for at in false true; do
  setup $at "$TILED"; ./launch-window.sh $APP One 480 320; nap 3
  key $UP; key $DOWN
  r=$(python3 -c "import json,sys; w=json.loads(sys.argv[1]); print('ok' if len(w)==1 and not w[0][4] and w[0][2]<1900 else 'got '+sys.argv[1])" "$(ev "$WIN")")
  if [ "$r" = ok ]; then r=$(entry_is "$(closed_entry)" "not e.get('maximized') and $HALF"); fi
  check "3 keyboard down gives back the tile from before (auto-tiling $at)" "$r"
done

# 4 top-edge drag: take the window by its title bar to the top edge of the screen
setup false "{}"; ./launch-window.sh $APP One 480 320; nap 3
ev "$FIRST.move_frame(false, 700, 300); 'mv'" >/dev/null; nap 1
ev "$(cat input-helpers.js)" >/dev/null
ev "__drag(900, 320, 900, 0, 20, 400); 'drag'" >/dev/null; nap 4
r=$(python3 -c "import json,sys; w=json.loads(sys.argv[1]); print('ok' if len(w)==1 and w[0][4] else 'got '+sys.argv[1])" "$(ev "$WIN")")
if [ "$r" = ok ]; then r=$(entry_is "$(closed_entry)" "e.get('maximized') and $WHOLE"); fi
check "4 top-edge drag maximises and keeps the window tiled" "$r"

# 5 remembered maximised+tiled window comes back maximised and tiled
setup false "{\"$APP\":{\"frame\":$FRAME,\"tile\":{\"x\":0,\"y\":0,\"width\":1,\"height\":1,\"groups\":[]},\"maximized\":true}}"
./launch-window.sh $APP One 480 320; nap 4
r=$(python3 -c "import json,sys; w=json.loads(sys.argv[1]); print('ok' if len(w)==1 and w[0][4] else 'got '+sys.argv[1])" "$(ev "$WIN")")
if [ "$r" = ok ]; then r=$(entry_is "$(closed_entry)" "e.get('maximized') and $WHOLE"); fi
check "5 remembered maximised tiled window returns maximised and tiled" "$r"

# 6 a maximised tiled window leaves no vacant tile: a new window of another app is not tiled
setup true "{}"; ./launch-window.sh $APP One 480 320; nap 3
key $UP
./launch-window.sh test.Other Two 480 320; nap 4
ev "const w=global.get_window_actors().map(a=>a.metaWindow).find(w=>w.get_wm_class()=='test.Other'); w.delete(global.get_current_time()); 'del'" >/dev/null; nap 2
R=$(ev "$X.getSettings().get_string('remembered-windows')")
r=$(python3 -c "
import json,sys
e=json.loads(sys.argv[1]).get('test.Other',{})
print('ok' if e and 'tile' not in e else 'got '+sys.argv[1])" "$R")
check "6 new window is not tiled beside a maximised tiled window" "$r"

# 7 keyboard up on a window that cannot be maximised changes nothing for later maximise
setup false "$TILED"; ./launch-window.sh $APP One 480 320; nap 3
ev "const w=$FIRST; w.can_maximize=()=>false; 'nomax'" >/dev/null
key $UP
ev "delete $FIRST.can_maximize; $FIRST.maximize(); 'max'" >/dev/null; nap 2
r=$(entry_is "$(closed_entry)" "e.get('maximized') and 'tile' not in e")
check "7 refused keyboard maximise leaves no stale tile for the window button" "$r"

ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'close'" >/dev/null
# leave the settings as found, other scenarios depend on the defaults
ev "const s=$X.getSettings(); ['enable-autotiling','remember-windows','remembered-windows','top-edge-maximize','enable-move-keybindings'].forEach(k=>s.reset(k)); 'reset'" >/dev/null
if [ $FAILS -eq 0 ]; then echo "RESULT: all maximise checks passed"; else echo "RESULT: $FAILS check(s) FAILED"; exit 1; fi
