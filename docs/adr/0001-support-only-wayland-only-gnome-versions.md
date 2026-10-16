# 0001 Support only GNOME versions without an X11 session (50 and newer)

Status: accepted (2026-10-13, maintainer decision)

## Context
The fork targets GNOME 51 on Wayland. Upstream Tiling Shell still declares support for GNOME 42-50
and carries X11 remnants (for example the RandR fractional scaling flag) and a separate legacy
build for GNOME 42-44.

What we found about GNOME's X11 removal (sources are announcements from before the releases;
the final state of 49 and 50 was not confirmed from release notes):
- GNOME announced the X11 session would be disabled by default in 49 and removed after that.
- For 49 the switch was partly reverted (GDM re-enabled X11 support), so 49 can still offer an
  X11 session depending on how a distribution builds it.
- For 50 the plan is to delete most X11 session support.
- Sources: https://blogs.gnome.org/alatiera/2025/06/08/the-x11-session-removal/,
  https://gitlab.gnome.org/GNOME/gdm/-/merge_requests/314,
  https://itsfoss.com/x11-is-back-in-gnome/

## Decision
Support GNOME 50 and newer only. Everything older (42-49) is dropped from `shell-version`, and the
X11-specific code paths and the legacy build for 42-44 are removed.

## Consequences
- The Wayland cleanup can delete X11 branches without keeping an exception for 49.
- Users on GNOME 49 or older (for example Ubuntu 24.04 LTS with GNOME 46) get no new releases.
  Version 17.3 stays available as a frozen tag; the README must say which release fits which GNOME.
- Merging upstream changes gets harder because this fork diverges on supported versions.
- If the final GNOME 50 release notes show that an X11 session still exists, revisit this ADR.
