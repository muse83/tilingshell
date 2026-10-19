#!/usr/bin/env bash
# Where a new window goes (memory vs auto-tiling), checked on the real shell with two monitors.
# Needs: SECOND_MONITOR=1 ./up.sh. Prints PASS/FAIL per check and exits 1 on any failure.
#   1 each mode (also auto-tiling with every tile taken): never visible at a wrong frame, ends at the right frame, not slower (x3)
#   2 second window of the same app is cascaded, not put on top
#   3 remembered tile already taken by the same app: tile size, cascaded, untiled (tiled or not
#     is read from what the window memory writes down when each window is closed)
#   4 remembered tile on the second monitor
#   5 shutdown: open windows are remembered when the extension is disabled
# usage: ./scenario-window-placement.sh
set -uo pipefail
cd "$(dirname "$0")"
nap() { python3 -c "import time;time.sleep($1)"; }
ev() { timeout 25 ./eval.sh "$1" | sed "s/^(true, '\"\?//;s/\"\?')$//;s/\\\\//g"; }
UUID=tilingshell@ferrarodomenico.com
X="__M.extensionManager.lookup('$UUID').stateObj"
APP=test.Place
FAILS=0
check() { if [ "$2" = ok ]; then echo "PASS $1"; else echo "FAIL $1: $2"; FAILS=$((FAILS+1)); fi; }
# JS: all windows as [x,y,width,height,monitor]
WINDOWS="JSON.stringify(global.get_window_actors().map(a=>a.metaWindow).map(w=>{const r=w.get_frame_rect(); return [r.x,r.y,r.width,r.height,w.get_monitor()]}))"
# Whether a window is tiled is not exposed by the extension. Closing a window makes the window
# memory write down its state, so close the window at x and print the entry it remembered.
closed_entry() {
  ev "const w=global.get_window_actors().map(a=>a.metaWindow).find(w=>w.get_frame_rect().x==$1); w.delete(global.get_current_time()); 'del'" >/dev/null; nap 2
  ev "$X.getSettings().get_string('remembered-windows')"
}
setup() { # remember, auto-tiling, entry json
  ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'close'" >/dev/null; nap 2
  ev "const s=$X.getSettings(); s.set_boolean('remember-windows', $1); s.set_boolean('enable-autotiling', $2); s.set_string('remembered-windows', '$3'); 'cfg'" >/dev/null
}
FRAME='{"x":300,"y":200,"width":500,"height":350}'
TILE='{"x":0,"y":0,"width":0.5,"height":1,"groups":[]}'

until ./status.sh 2>/dev/null | grep -q "'state': 1"; do nap 2; done
ev "import('resource:///org/gnome/shell/ui/main.js').then(m => { globalThis.__M = m; }); 'ok'" >/dev/null; nap 1
MONS=$(ev "__M.layoutManager.monitors.length")
[ "$MONS" = 2 ] || { echo "FAIL needs two monitors (SECOND_MONITOR=1 ./up.sh), found $MONS"; exit 1; }

# the very first window after the shell started needs ~200 ms to start up, with or without this
# module (measured on the code before the change), so it must not count: warm up first
./launch-window.sh test.Warmup Warmup 300 200; nap 5
for i in 1 2 3; do for m in restore autotile both tile full; do
  out=$(MODE=$m ./measure-placement.sh 2>&1 | tail -2 | tr '\n' ' ')
  case "$out" in *FAIL*) check "1 mode $m run $i" "$out" ;; *RESULT*) check "1 mode $m run $i" ok ;; *) check "1 mode $m run $i" "no result" ;; esac
done; done

setup true false "{\"$APP\":{\"frame\":$FRAME}}"
./launch-window.sh $APP One 480 320; nap 3; ./launch-window.sh $APP Two 480 320; nap 3
W=$(ev "$WINDOWS")
r=$(python3 -c "import json,sys; w=sorted(json.loads(sys.argv[1])); print('ok' if [x[:2] for x in w]==[[300,200],[330,230]] else 'got '+sys.argv[1])" "$W")
check "2 second window of the same app is cascaded" "$r"

setup true false "{\"$APP\":{\"frame\":$FRAME,\"tile\":$TILE}}"
./launch-window.sh $APP One 480 320; nap 3; ./launch-window.sh $APP Two 480 320; nap 3
W=$(ev "$WINDOWS")
r=$(python3 -c "
import json,sys
w=sorted(json.loads(sys.argv[1]))
if len(w)!=2: print('got '+sys.argv[1]); sys.exit()
t,f=w
print('ok' if f[2:4]==t[2:4] and f[0]==t[0]+30 and f[1]!=t[1] else 'got '+sys.argv[1])" "$W")
if [ "$r" = ok ]; then
  # the cascaded window is not tiled, the first one is
  XS=$(python3 -c "import json,sys; w=sorted(json.loads(sys.argv[1])); print(w[0][0], w[1][0])" "$W")
  E2=$(closed_entry "${XS#* }"); E1=$(closed_entry "${XS% *}")
  r=$(python3 -c "
import json,sys
e2=json.loads(sys.argv[1]).get('$APP',{}); e1=json.loads(sys.argv[2]).get('$APP',{})
print('ok' if 'tile' not in e2 and 'tile' in e1 else 'got cascaded '+sys.argv[1]+' first '+sys.argv[2])" "$E2" "$E1")
fi
check "3 taken tile: second window has tile size, is cascaded and not tiled" "$r"

setup true false "{\"$APP\":{\"frame\":{\"x\":2100,\"y\":100,\"width\":500,\"height\":350},\"tile\":$TILE}}"
./launch-window.sh $APP One 480 320; nap 3
W=$(ev "$WINDOWS")
r=$(python3 -c "
import json,sys
w=json.loads(sys.argv[1])
print('ok' if len(w)==1 and w[0][4]==1 and w[0][0]>=1920 and w[0][0]+w[0][2]<=3200 else 'got '+sys.argv[1])" "$W")
if [ "$r" = ok ]; then
  E=$(closed_entry "$(python3 -c "import json,sys; print(json.loads(sys.argv[1])[0][0])" "$W")")
  r=$(python3 -c "
import json,sys
print('ok' if 'tile' in json.loads(sys.argv[1]).get('$APP',{}) else 'untiled '+sys.argv[1])" "$E")
fi
check "4 remembered tile on the second monitor" "$r"

setup true false "{}"
./launch-window.sh $APP One 480 320; nap 3
ev "global.get_window_actors().forEach(a=>a.metaWindow.move_resize_frame(false, 400, 300, 520, 360)); globalThis.__s=$X.getSettings(); 'moved'" >/dev/null; nap 1
ev "__M.extensionManager.disableExtension('$UUID'); 'off'" >/dev/null; nap 2
R=$(ev "__s.get_string('remembered-windows')")
ev "__M.extensionManager.enableExtension('$UUID'); 'on'" >/dev/null
r=$(python3 -c "
import json,sys
e=json.loads(sys.argv[1]).get('$APP',{}).get('frame')
print('ok' if e and (e['x'],e['y'])==(400,300) else 'got '+sys.argv[1])" "$R")
check "5 shutdown remembers the open window" "$r"

ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'close'" >/dev/null
# leave the settings as found, other scenarios depend on the defaults
ev "const s=$X.getSettings(); ['enable-autotiling','remember-windows','remembered-windows'].forEach(k=>s.reset(k)); 'reset'" >/dev/null
if [ $FAILS -eq 0 ]; then echo "RESULT: all window placement checks passed"; else echo "RESULT: $FAILS check(s) FAILED"; exit 1; fi
