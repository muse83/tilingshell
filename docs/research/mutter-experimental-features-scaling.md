# Mutter: fate of `experimental-features` and the scaling flags

Researched 2026-10-13 against the Mutter repository at gitlab.gnome.org and the local
`tilingshell-gnome51` container (Mutter 51.0).

## Question

Why does `org.gnome.mutter` have no `experimental-features` key on GNOME 51, is
logical (fractional) monitor scaling therefore always active, and what happened to the
values `scale-monitor-framebuffer` and `x11-randr-fractional-scaling`?

## Short answer

Two separate Mutter changes caused this (confirmed from primary source). In Mutter 50
`scale-monitor-framebuffer` (and `xwayland-native-scaling`) were removed from the key's
value list because the feature is no longer experimental. In Mutter 51 the whole
`experimental-features` key was removed and replaced by a new schema
`org.gnome.mutter.experimental` with one boolean per feature. Logical layout is the
**default** on Wayland/native in 51, but not strictly **always**: a physical layout mode
still exists and can be selected per monitor configuration (confirmed from source).
`x11-randr-fractional-scaling` was **not found** anywhere in upstream Mutter.

## Evidence

All URLs are on `https://gitlab.gnome.org/GNOME/mutter`. Raw file form:
`/-/raw/<tag>/<path>`.

1. Mutter 48.0 and 49.0 schema: key `experimental-features` exists and documents
   `scale-monitor-framebuffer` as "makes mutter default to layout logical monitors in a
   logical pixel coordinate space".
   `/-/raw/48.0/data/org.gnome.mutter.gschema.xml.in`, `/-/raw/49.0/...` (lines ~105-145).
2. Mutter 50.0 schema: key still exists, but its documented keyword list only has
   `kms-modifiers` and `autoclose-xwayland`. The flag enum at the top of the file still
   lists `scale-monitor-framebuffer` (leftover, no code reads it).
   `/-/raw/50.0/data/org.gnome.mutter.gschema.xml.in`.
3. Commit 74965cdb "Make framebuffer and Xwayland native scaling non-experimental",
   2026-02-03, merge request !4877
   (`/-/commit/74965cdb047df0f2159d53cb12770949924c60e9`,
   `/-/merge_requests/4877`). It removes `SCALE_MONITOR_FRAMEBUFFER` and
   `XWAYLAND_NATIVE_SCALING` from `meta-settings.c`, `meta-settings-private.h` and
   removes the `experimental_features_changed` handler from `meta-monitor-manager.c`.
   Commit message: "The existing default fully X11 compatible behavior can still be
   achieved using `gdctl set --layout-mode=physical ...`".
4. Mutter 50.0 NEWS line "Make VRR and fractional scaling non-experimental [Michel,
   Jonas; !4863, !4877]": `/-/raw/50.0/NEWS`. (!4863 is the VRR part, e1c7410c.)
5. Commit 9f2744aa "settings: Split experimental features into separate settings",
   2026-08-01, merge request !4893 (`/-/commit/9f2744aaa244b1843d8a10055ac0a944a809451b`,
   `/-/merge_requests/4893`). Deletes the `experimental-features` key from
   `org.gnome.mutter` and adds `data/org.gnome.mutter.experimental.gschema.xml.in`
   (schema `org.gnome.mutter.experimental`, keys `kms-modifiers`, `autoclose-xwayland`).
   Reason given: flags lists reset all features when one is removed, `gsettings set`
   overwrote other features, translations invalidated, distro defaults ineffective.
6. Mutter 51.0 NEWS: "Split experimental features into separate settings [Sebastian K.;
   !4893]": `/-/raw/51.0/NEWS`. The 51.0 schema file has no `experimental-features` key:
   `/-/raw/51.0/data/org.gnome.mutter.gschema.xml.in`.
7. Default layout mode in 51.0, native backend: function
   `meta_monitor_manager_native_get_default_layout_mode` returns
   `META_LOGICAL_MONITOR_LAYOUT_MODE_LOGICAL` unconditionally
   (`/-/raw/51.0/src/backends/native/meta-monitor-manager-native.c`, ~line 521).
   In 49.0 the same function returned LOGICAL only if the experimental feature was on,
   else PHYSICAL (`/-/raw/49.0/...`, lines 492-502).
8. Physical layout mode still exists in 51.0: `META_LOGICAL_MONITOR_LAYOUT_MODE_PHYSICAL`
   is still handled in `meta-monitor-manager.c`, `meta-monitor-config-manager.c` and the
   native manager (in physical mode fractional scales are constrained,
   `META_MONITOR_SCALES_CONSTRAINT_NO_FRAC`). The D-Bus properties `layout-mode` and
   `supports-changing-layout-mode` are present (`/-/raw/51.0/src/backends/meta-monitor-manager.c`,
   ~lines 2369-2374, 3006). A public C getter `meta_monitor_manager_get_layout_mode`
   exists in the private source (line ~4494); I did not verify it is exposed to Shell JS.
9. X11 backend: `src/backends/x11/meta-monitor-manager-xrandr.c` returns HTTP 404 at tag
   51.0 (present at 49.0, where its default layout mode was PHYSICAL). So there is no
   X11 RandR monitor manager in 51.0.
10. Local ground truth, container `tilingshell-gnome51` (running), `mutter --version` =
    `mutter 51.0`, package `mutter 51.0-2`:
    - `gsettings list-keys org.gnome.mutter | grep -c experimental` -> `0`.
    - `/usr/share/glib-2.0/schemas/org.gnome.mutter.experimental.gschema.xml` exists, keys:
      `kms-modifiers`, `autoclose-xwayland`, `tearing`, `auto-fullscreen-tearing`
      (the last two are not in the 51.0 tag; the Arch package evidently carries newer
      or patched sources).
    - `/usr/share/glib-2.0/schemas/org.gnome.mutter.gschema.xml` still declares the flag
      enum with `scale-monitor-framebuffer` (value 1) at the top, but no key uses it.

## What `x11-randr-fractional-scaling` is

Not found upstream. The string does not occur in `data/org.gnome.mutter.gschema.xml.in`
or `src/backends/meta-settings.c` at tags 3.38.0, 40.0, 42.0, 43.0, 44.0, 45.0, 46.0,
47.0, 48.0, 49.0, 50.0, 51.0 (checked by raw-file grep). The GitLab code search needs
authentication, so I could not grep the whole history. It is therefore not an upstream
GNOME Mutter value (my inference, not confirmed: probably a downstream/distro patch). I
did not check any distro source.

## What remains unknown

- Origin of `x11-randr-fractional-scaling` (downstream patch? which distro?).
- Whether GNOME Shell 51 JS can read the layout mode of the current configuration
  without D-Bus (`Mutter.DisplayConfig` `layout-mode` property is the confirmed route).
- No GNOME 50 or 51 release note on release.gnome.org was read; only Mutter NEWS, which
  is the primary source anyway.
- Behaviour of a user's saved `monitors.xml` with `<layoutmode>physical</layoutmode>`
  on 51 was not tested.

## Recommendation for the extension's detection logic

Keep the current behaviour (missing key -> "scaling is logical"), but fix the wording:
it is the default, not a guarantee. Strict correctness would read the `layout-mode`
property of `org.gnome.Mutter.DisplayConfig` (0 = logical, 1 = physical) when the key
is absent; that is optional follow-up work, only relevant for users who explicitly set
the physical layout mode (e.g. via `gdctl`). Also note that on 51 the key is absent
but the old flag name still exists in the schema's flag enum, so the existing
`_hasExperimentalFeatures` check must test for the key, not the enum.
