# 0008 One module owns the settings behind a storage seam

Status: accepted (2026-10-21, maintainer decision in a grilling session)

## Context
The settings class is wide, not deep: 83 static members, imported by 21 files, bound to the GNOME
settings object. Logic that should be testable sits in awkward places: the layout list repairs
itself with a reset in a catch, the remembered windows are a raw string key parsed elsewhere, the
version migration lives in the extension's main file, and a second singleton (global state)
re-reads layouts on signals. The extension starts and stops about twelve singletons by hand in an
order that is written down nowhere. Only the shell can run any of it, so none of it is tested.

## Decision
- One settings module, split into groups: Layouts, Spacing, Window memory, Appearance, Behaviour,
  Shortcuts, Version and migration. The wide list is not kept as a facade; call sites move to the
  groups. Appearance and Behaviour are residual groups; their exact contents are settled while
  moving.
- A storage interface sits underneath with two adapters: GNOME settings in production, in-memory
  in tests. It offers read and write only. The Layouts group alone also offers "notify on change",
  because only layouts are changed from two sides (preferences window and running extension).
- The Layouts group reloads and announces changes itself. The second singleton that re-reads
  layouts disappears or shrinks to managing state.
- Repair of broken layout data and version migration move into the module with behaviour carried
  over 1:1 (reset to the default layouts, same compatibility changes). Improving them (for example
  dropping single broken layouts) is a separate ticket once tests exist.
- Spacing keeps taking the scale factor from the caller, as today. The group knows no monitor.
- No direct GNOME settings use outside the GNOME adapter. Documented exception: UI widgets bound
  directly to one key (the shortcut picker in preferences) may still touch GNOME settings.
- One module owns the extension's start and stop order: parts declare dependencies, start runs in
  dependency order, stop in reverse, a failed start shuts down the parts already started.
- Tests run under plain Node with `node --test`. The seams are the settings groups over the
  in-memory adapter, and the start/stop module with fake parts. The GNOME adapter and the UI
  exceptions are checked in the dev stack.

## Consequences
- Large refactor over many files, sequenced expand-contract: first the storage interface with the
  Layouts group beside the old class, then migration and window memory, then the remaining groups
  and deletion of the old class, last the start/stop module (issues #27 to #30, parent #21).
- Preferences runs in its own process and initialises the settings itself; the module must work in
  both processes.
