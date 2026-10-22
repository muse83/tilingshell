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

## Amendment: Layouts group and storage seam (issue 27, 2026-10-22)
- Storage interface (`storage.ts`): strings, lists of string lists, reset, and `onChange` per key.
  Adapters: GNOME (`gnomeStorage.ts`) and in-memory (`MemoryStorage`). Like GNOME settings, the
  in-memory adapter reports no change when a value is written unchanged.
- Layouts group (`layoutsSettings.ts`) holds the layout list and the selected layouts per workspace
  and monitor. It offers `connect`/`disconnect` (GObject style, so `SignalHandling` can hold the
  connection) for two announcements: layouts changed, selected layouts changed. It is created in
  `Settings.initialize`, reachable as `Settings.layouts`, and works in the extension and in
  preferences.
- Deviation from the ticket's expand step: the old layout methods of the wide settings class were
  deleted at once and all callers moved, because keeping them would leave a second place that
  re-reads layouts.
- Kept 1:1: broken or empty data is repaired to the default layouts; layouts without tiles are
  filtered out; if that leaves nothing, nothing is repaired (as before).
- Differences to before: repair runs when the group is created and when the key changes, not on every
  read. The global state's layouts-changed signal now fires only when the stored layouts really
  changed (before: on every save). The layout list handed out is the group's shared array; callers
  replace it through `setLayouts`, they do not mutate it.
- Checked in the dev stack: extension active, preferences build without errors, broken layout data
  written from outside is repaired by the running extension at once. Editing layouts by clicking in
  preferences cannot be done there (no interactive access).
- Left for later tickets: the global state now only passes layout access through; the layout import
  in preferences filters empty layouts a second time.
