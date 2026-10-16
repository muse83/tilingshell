# Disposable GNOME 51 Wayland dev stack on CachyOS (same distro family as the host).
FROM cachyos/cachyos:latest

RUN pacman -Syu --noconfirm --needed \
      gnome-shell mutter dbus glib2 gettext nodejs npm rsync procps-ng \
      python-dbusmock mesa gsettings-desktop-schemas adwaita-icon-theme \
    && glib-compile-schemas /usr/share/glib-2.0/schemas \
    && pacman -Scc --noconfirm

# Permissive system-bus policy so the mocked system services are reachable by the shell user.
RUN printf '%s\n' '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN" "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd"><busconfig><policy context="default"><allow own="*"/><allow send_destination="*"/><allow receive_sender="*"/></policy></busconfig>' > /usr/share/dbus-1/system.d/zz-mock.conf

RUN useradd -m dev
WORKDIR /home/dev

# Dependencies change rarely: install them in their own cached layer.
COPY --chown=dev package.json /home/dev/deps/package.json
RUN chown dev /home/dev/deps && su dev -c 'cd /home/dev/deps && npm install --legacy-peer-deps --no-audit --no-fund'

COPY --chown=dev entrypoint.sh mock-login-user.py /home/dev/
ENTRYPOINT ["/home/dev/entrypoint.sh"]
