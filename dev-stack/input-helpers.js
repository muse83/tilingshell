// Paste into ./eval.sh "$(cat input-helpers.js)" once per shell session.
// __drag(x0, y0, x1, y1, steps, holdMs): press the primary button at (x0,y0), move in steps,
//   hold at (x1,y1) for holdMs (globalThis.__afterHold runs there), release. Default tiling needs
//   Ctrl held while dragging: call __ctrl(true) before and __ctrl(false) after.
// __kb: virtual keyboard (notify_keyval), __dev: virtual pointer.
const {Clutter, GLib} = imports.gi;
globalThis.__dev = globalThis.__dev || global.stage.context.get_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
globalThis.__drag = function(x0,y0,x1,y1,steps,holdMs) {
  const d = globalThis.__dev, now = () => GLib.get_monotonic_time();
  globalThis.__dragLog = [];
  d.notify_absolute_motion(now(), x0, y0);
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
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
