# 21 Deepen: put a seam at the settings storage

Status: open
Blocked by: none

## Problem
`settings/settings.ts` (759 lines, ~64 static getters/setters, imported by 21 files) is wide, not
deep, and bound to `Gio.Settings`.
- `get_layouts_json` repairs itself with `reset_layouts_json` in a catch (~575-590).
- Gap getters take a `scaleFactor` parameter.
- The remembered windows blob is a raw string key (~308-313); parsing lives in `frameMemory.ts`.
- Version migration `_validateSettings` lives in `extension.ts` (~87-110).
- `utils/globalState.ts` (372 lines) is a second singleton re-reading layouts on signals.
- `extension.ts` enable/disable is order-dependent hand sequencing of ~12 singletons (770-809),
  27 Settings/GlobalState touches.

Two adapters would justify a real seam: GNOME settings in production, in-memory in tests.

## Goal
A settings module that validates, migrates and repairs behind one interface, testable with an
in-memory adapter.

## Scope
Grill first; large refactor with low acute pain, schedule after the other tickets.

## Done when
Migration and repair live in the module with tests; no direct `Gio.Settings` use outside the
adapter.

## Source
`docs/research/architecture-review-2026-10-16.md`, candidate 6 (Speculative).
