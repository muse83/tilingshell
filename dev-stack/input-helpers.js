// Paste into ./eval.sh "$(cat input-helpers.js)" once per shell session.
// __drag(x0, y0, x1, y1, steps, holdMs): press the primary button at (x0,y0), move in steps,
//   hold at (x1,y1) for holdMs (globalThis.__afterHold runs there), release. Default tiling needs
//   Ctrl held while dragging: call __ctrl(true) before and __ctrl(false) after.
// A modal grab (overview, popup menu, dialog) swallows the press. The helper hides the overview
// itself but does not close popup menus or dialogs.
// __kb: virtual keyboard (notify_keyval), __dev: virtual pointer.
const {Clutter, GLib} = imports.gi;
globalThis.__dev = globalThis.__dev || global.stage.context.get_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
globalThis.__drag = function(x0,y0,x1,y1,steps,holdMs) {
  const d = globalThis.__dev, now = () => GLib.get_monotonic_time();
  globalThis.__dragLog = [];
  // Two things block a press at the start point right after the session starts:
  // - The pointer rests in the hot corner (0,0). Its barrier lets the first absolute motion only
  //   slide along the top edge, to (x0,0), where the press would hit the panel. So move twice.
  // - GNOME shows the overview at session start; it holds a modal grab, a press would only close
  //   it. Hide it and wait for the animation before pressing.
  const overviewWasOpen = Main.overview.visible;
  d.notify_absolute_motion(now(), x0, y0);
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { d.notify_absolute_motion(now(), x0, y0); return GLib.SOURCE_REMOVE; });
  if (overviewWasOpen) GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => { Main.overview.hide(); return GLib.SOURCE_REMOVE; });
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, overviewWasOpen ? 1000 : 300, () => {
    d.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
    let i = 0;
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
      i++;
      d.notify_absolute_motion(now(), x0 + (x1-x0)*i/steps, y0 + (y1-y0)*i/steps);
      if (i < steps) return GLib.SOURCE_CONTINUE;
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, holdMs, () => {
        globalThis.__dragLog.push('held');
        globalThis.__afterHold && globalThis.__afterHold();
        d.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        globalThis.__dragLog.push('released');
        return GLib.SOURCE_REMOVE;
      });
      return GLib.SOURCE_REMOVE;
    });
    return GLib.SOURCE_REMOVE;
  });
};
globalThis.__kb = global.stage.context.get_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
globalThis.__ctrl = (down) => globalThis.__kb.notify_keyval(GLib.get_monotonic_time(), 0xffe3, down ? Clutter.KeyState.PRESSED : Clutter.KeyState.RELEASED);
'defined'
