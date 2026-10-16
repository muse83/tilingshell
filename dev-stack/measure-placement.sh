#!/usr/bin/env bash
# Measures where and when a NEW window becomes visible: samples frame rect, actor opacity and
# visibility every 4 ms from the moment the window is created. A window is "jumped" if it was
# visible (opacity > 0) while its frame differed from its final frame.
# usage: MODE=restore|autotile|both|tile ./measure-placement.sh   (prints one RESULT line)
# Exit 1 when a window was visible at a wrong frame, did not end at the frame expected for the
# mode, or took longer than MAX_MS (default 50; before the change windows needed 21-28 ms).
#   restore  remembered frame, auto-tiling off
#   autotile auto-tiling on, nothing remembered
#   both     remembered frame and auto-tiling on (remembered must win)
#   tile     remembered tile (left half), auto-tiling off
#   full     auto-tiling on but every tile taken (6 windows open first): the window must stay
#            where the application put it and must not be held back
set -uo pipefail
cd "$(dirname "$0")"
MODE=${MODE:-restore}; APP=${APP:-test.Probe}
nap() { python3 -c "import time;time.sleep($1)"; }
ev() { timeout 25 ./eval.sh "$1" | sed "s/^(true, '\"\?//;s/\"\?')$//;s/\\\\//g"; }
X="__M.extensionManager.lookup('tilingshell@ferrarodomenico.com').stateObj"

until ./status.sh 2>/dev/null | grep -q "'state': 1"; do nap 2; done
ev "import('resource:///org/gnome/shell/ui/main.js').then(m => { globalThis.__M = m; }); 'ok'" >/dev/null; nap 1
ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'close'" >/dev/null; nap 2

REMEMBER=false; AUTO=false; ENTRY='{}'
FRAME='{"x":300,"y":200,"width":500,"height":350}'
case $MODE in
  restore)  REMEMBER=true; ENTRY="{\"$APP\":{\"frame\":$FRAME}}" ;;
  autotile|full) AUTO=true ;;
  both)     REMEMBER=true; AUTO=true; ENTRY="{\"$APP\":{\"frame\":$FRAME}}" ;;
  tile)     REMEMBER=true; ENTRY="{\"$APP\":{\"frame\":$FRAME,\"tile\":{\"x\":0,\"y\":0,\"width\":0.5,\"height\":1,\"groups\":[]}}}" ;;
esac
ev "const s=$X.getSettings(); s.set_boolean('remember-windows', $REMEMBER); s.set_boolean('enable-autotiling', $AUTO); s.set_string('remembered-windows', '$ENTRY'); 'cfg'" >/dev/null

if [ "$MODE" = full ]; then for n in 1 2 3 4 5 6; do ./launch-window.sh test.Fill$n Fill$n 300 200; nap 1.5; done; nap 3; fi
ev "globalThis.__rec=[]; const {GLib}=imports.gi; const t0=GLib.get_monotonic_time();
globalThis.__recId = global.display.connect('window-created',(d,w)=>{ const rec={s:[]}; __rec.push(rec);
 GLib.timeout_add(GLib.PRIORITY_DEFAULT,4,()=>{ const a=w.get_compositor_private(); const r=w.get_frame_rect();
  rec.s.push([Math.round((GLib.get_monotonic_time()-t0)/1000), r.x,r.y,r.width,r.height, a?a.opacity:-1, a?(a.visible?1:0):-1]);
  return rec.s.length<500 ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE; }); }); 'rec'" >/dev/null
./launch-window.sh $APP Probe 480 320; nap 4
JSON=$(ev "JSON.stringify(__rec)")
ev "global.display.disconnect(__recId); 'off'" >/dev/null
MAX_MS=${MAX_MS:-50} python3 - "$MODE" "$JSON" <<'PY'
import json, os, sys
mode, raw = sys.argv[1], sys.argv[2]
rec = json.loads(raw)
if not rec: print(f"RESULT MODE={mode}: no window recorded"); sys.exit(1)
s = rec[0]["s"]; first, final = s[0], s[-1]
f = tuple(final[1:5])
shown = [x for x in s if x[5] > 0 and x[6] == 1]
t_vis = (shown[0][0] - first[0]) if shown else None
wrong = [x for x in shown if tuple(x[1:5]) != f]
# the moment the user sees the window where it stays: visible AND already at its final frame
settled = [x for x in shown if tuple(x[1:5]) == f]
t_set = (settled[0][0] - first[0]) if settled else None
at_final = [x for x in s if tuple(x[1:5]) == f]
t_frame = (at_final[0][0] - first[0]) if at_final else None
print(f"RESULT MODE={mode}: final={f} ms_to_visible={t_vis} ms_to_visible_at_final={t_set} ms_frame_final={t_frame} visible_samples_at_wrong_frame={len(wrong)}"
      + (f" first_wrong={tuple(wrong[0][1:5])}" if wrong else ""))
expected = {"restore": (300, 200, 500, 350), "both": (300, 200, 500, 350), "tile": (8, 40, 944, 1032), "full": (720, 396, 480, 320)}.get(mode)
problems = []
if wrong: problems.append("window visible at a wrong frame")
if expected and f != expected: problems.append(f"final frame {f} is not {expected}")
if mode == "autotile" and f == tuple(first[1:5]): problems.append("window was not auto-tiled")
if t_set is None or t_set > int(os.environ["MAX_MS"]): problems.append(f"too slow: {t_set} ms")
if problems:
    print("FAIL " + "; ".join(problems)); sys.exit(1)
PY
RC=$?
ev "const s=$X.getSettings(); ['enable-autotiling','remember-windows','remembered-windows'].forEach(k=>s.reset(k)); 'reset'" >/dev/null
ev "global.get_window_actors().forEach(a=>a.metaWindow.delete(global.get_current_time())); 'close'" >/dev/null
exit $RC
