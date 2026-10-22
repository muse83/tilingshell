#!/usr/bin/env bash
# Window memory on its own (single monitor): frame, tile, maximise restore and the round trip on close.
set -uo pipefail
cd "$(dirname "$0")"
nap() { python3 -c "import time;time.sleep($1)"; }
ev() { timeout 25 ./eval.sh "$1" | sed "s/^(true, '\"\?//;s/\"\?')$//;s/\\\\//g"; }
X="__M.extensionManager.lookup('tilingshell@ferrarodomenico.com').stateObj"
APP=test.Slice; FAILS=0
check() { if [ "$2" = ok ]; then echo "PASS $1"; else echo "FAIL $1: $2"; FAILS=$((FAILS+1)); fi; }
WINDOWS="JSON.stringify(global.get_window_actors().map(a=>a.metaWindow).map(w=>{const r=w.get_frame_rect(); return [r.x,r.y,r.width,r.height,w.is_maximized()]}))"
until ./status.sh 2>/dev/null | grep -q "'state': 1"; do nap 2; done
ev "import('resource:///org/gnome/shell/ui/main.js').then(m => { globalThis.__M = m; }); 'ok'" >/dev/null; nap 1
setup() { ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'c'" >/dev/null; nap 2
  ev "const s=$X.getSettings(); s.set_boolean('remember-windows', true); s.set_boolean('enable-autotiling', false); s.set_string('remembered-windows', '$1'); 'cfg'" >/dev/null; }
./launch-window.sh test.Warm Warm 300 200; nap 5
echo "workarea: $(ev "(r=>JSON.stringify({x:r.x,y:r.y,width:r.width,height:r.height}))(__M.layoutManager.getWorkAreaForMonitor(0))")"

setup "{\"$APP\":{\"frame\":{\"x\":300,\"y\":200,\"width\":500,\"height\":350}}}"
./launch-window.sh $APP One 480 320; nap 3
W=$(ev "$WINDOWS"); check "1 frame restored" "$(python3 -c "import json,sys; w=json.loads(sys.argv[1]); print('ok' if len(w)==1 and w[0][:4]==[300,200,500,350] else 'got '+sys.argv[1])" "$W")"

setup "{\"$APP\":{\"frame\":{\"x\":300,\"y\":200,\"width\":500,\"height\":350},\"tile\":{\"x\":0,\"y\":0,\"width\":0.5,\"height\":1,\"groups\":[]}}}"
./launch-window.sh $APP One 480 320; nap 3
W=$(ev "$WINDOWS"); echo "tile result: $W"
WA=$(ev "(r=>JSON.stringify({x:r.x,y:r.y,width:r.width,height:r.height}))(__M.layoutManager.getWorkAreaForMonitor(0))")
check "2 tile restored (about half the work area wide, full height, left)" "$(python3 -c "
import json,sys
w=json.loads(sys.argv[1]); a=json.loads(sys.argv[2])
f=w[0]
print('ok' if len(w)==1 and abs(f[0]-a['x'])<=20 and abs(f[1]-a['y'])<=20 and abs(f[2]-a['width']/2)<=30 and abs(f[3]-a['height'])<=40 else 'got '+sys.argv[1]+' wa '+sys.argv[2])" "$W" "$WA")"

# dragging out is not scripted here; the round trip on close is
E1=$(ev "const w=global.get_window_actors().map(a=>a.metaWindow)[0]; w.delete(global.get_current_time()); 'del'" >/dev/null; nap 2; ev "$X.getSettings().get_string('remembered-windows')")
echo "entry after close: $E1"
check "3 closing a tiled window remembers its tile" "$(python3 -c "import json,sys; e=json.loads(sys.argv[1]).get('$APP',{}); print('ok' if 'tile' in e else 'got '+sys.argv[1])" "$E1")"

setup "{\"$APP\":{\"maximized\":true}}"
./launch-window.sh $APP One 480 320; nap 3
W=$(ev "$WINDOWS"); check "4 maximised restored" "$(python3 -c "import json,sys; w=json.loads(sys.argv[1]); print('ok' if len(w)==1 and w[0][4] else 'got '+sys.argv[1])" "$W")"
echo "fails: $FAILS"; exit $((FAILS>0))
