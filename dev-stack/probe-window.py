import sys, gi
gi.require_version("Gtk", "4.0")
from gi.repository import Gtk, GLib
GLib.set_prgname(sys.argv[1])
appid, title = sys.argv[1], sys.argv[2]
w0 = int(sys.argv[3]) if len(sys.argv) > 3 else 500
h0 = int(sys.argv[4]) if len(sys.argv) > 4 else 350
app = Gtk.Application(application_id=appid)
def act(a):
    w = Gtk.ApplicationWindow(application=a, title=title)
    w.set_default_size(w0, h0)
    w.present()
app.connect("activate", act)
app.run()
