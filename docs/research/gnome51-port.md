# GNOME 51 port: breaking changes found

Verified on the headless dev stack (`dev-stack/`, GNOME Shell 51.0, Wayland), 2026-10-13.

## API / platform changes that affected the extension

| Change in GNOME 51 | Effect | Fix |
| --- | --- | --- |
| `org.gnome.mutter` no longer has the `experimental-features` key (logical scaling is the default, see `mutter-experimental-features-scaling.md`) | `enable()` threw, extension ended in ERROR state | Treat a missing key as "scaling is logical" and skip watching it (`src/extension.ts`) |
| `metadata.json` did not list 51 | Shell refuses to load it without validation override | Added `"51"` to `shell-version` |

## Pre-existing bug surfaced by the smoke test (not 51-specific)

`disable()` destroyed the indicator before disconnecting signals, which produced a
"object already disposed" critical in the log. Signals are now disconnected first.

## Smoke test result (headless, driven through shell eval + virtual pointer)

| Step | Result |
| --- | --- |
| Enable | ACTIVE, no errors in the shell log |
| Keyboard tile left / right / up | Window moved to expected tile / maximised |
| Untile | Original size restored |
| Drag to left screen edge | Window snapped into a tile on release |
| Snap assistant | Headless check inconclusive; **confirmed working by the maintainer on the real GNOME 51 host** |
| Disable / re-enable | INACTIVE then ACTIVE, no critical in the log |

## Host verification (maintainer, real GNOME 51, single ultrawide monitor)

Maintainer reported that everything works: tiling by drag, snap assistant, tile preview,
keyboard tiling, enable/disable. Shell log on the host shows no errors or criticals.
Not covered: non-100% scaling (value not stated), multi-monitor.
Cosmetic oddity: monitor names are not found (`monitorsDetails=[]`) in the indicator menu log.

## Not verified / open

- The assumption "scaling is always logical on 51" comes from the missing key, not from Mutter
  release notes or source, and the headless stack runs at scale 1. Needs a source check.
- On 51 the extension no longer reacts to scaling changes (nothing left to watch); only matters
  if scaling can change at runtime without a shell restart.

- Whether older shell versions stay supported: needs an ADR (shared with the Wayland cleanup ticket).
- `tsc` reports errors on this toolchain (missing `ExtensionMetadata` export etc.); they pre-date this change.
