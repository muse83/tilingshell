# dbusmock's logind template crashes on GetUser (str + UInt32); replace it with a working one.
import dbus
bus = dbus.SystemBus()
mgr = dbus.Interface(bus.get_object("org.freedesktop.login1", "/org/freedesktop/login1"),
                     "org.freedesktop.DBus.Mock")
uid = 1000
path = "/org/freedesktop/login1/user/_%d" % uid
mgr.AddObject(path, "org.freedesktop.login1.User", {
    "UID": dbus.UInt32(uid), "GID": dbus.UInt32(uid), "Name": "dev",
    "State": "active", "Linger": False,
    "Sessions": dbus.Array([], signature="(so)"),
    "Display": dbus.Struct(("", dbus.ObjectPath("/")), signature="so"),
}, [])
mgr.AddMethod("org.freedesktop.login1.Manager", "GetUser", "u", "o",
              'ret = dbus.ObjectPath("%s")' % path)
