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

## Amendment: Version and window memory groups (issue 28, 2026-10-22)
- Storage interface gained boolean and list-of-strings read and write (needed by the migration).
- Version group (`versionSettings.ts`, `Settings.version`): `migrate(runningVersion)` records the
  running version on the first run (stored version "0") and applies the compatibility changes.
  The extension's main file only calls it. Window memory group (`windowMemorySettings.ts`,
  `Settings.windowMemory`): `entries`, `setEntries`, `clear`; unreadable data reads as nothing.
- Kept 1:1, including two oddities, now covered by tests: the cycle-layouts-backward change runs
  at every start while the stored version is not 17.3 (the stored version is only written on the
  first run), so it overwrites a keybinding the user set there; and it writes `<Shift>` alone when
  cycle-layouts is empty. Fixing both is a separate ticket.
- The "remember windows" on/off switch stays in the residual Behaviour group (ticket for the
  remaining groups).
- Checked in the dev stack: an old state (version 17.0) written through the shell was migrated on
  re-enable (custom border kept, backwards keybinding set); the maximise/tile scenario, including
  the remembered-window round trip, passes.
- Left for the ticket with the remaining groups: `Settings` still re-exports the two key names
  (last version, remembered windows) because the settings export lists them as excluded keys.

## Amendment: Remaining groups and removal of the wide settings class (issue 29, 2026-10-22)
- Four groups, each in its own file over the storage seam: Spacing (inner and outer gaps; the
  scale factor still comes from the caller), Appearance (window border, blur, animation times,
  panel indicator), Behaviour (tiling switches, activation keys, edge zones, thresholds, window
  suggestions, the remember-windows switch, the record of overridden GNOME settings) and
  Shortcuts (the on/off switch of the keybindings and the keybinding key names). Behaviour is the
  residual group.
- The wide settings class is gone. `Settings` only creates the groups (`Settings.spacing`,
  `.appearance`, `.behaviour`, `.shortcuts`, next to layouts, version and window memory) and keeps
  `bind`. Each group offers `connect`/`disconnect` on a storage key, in GObject shape for
  `SignalHandling`, and `keys` with its key names.
- Supersedes the Decision bullet that only the Layouts group notifies on change: every group now
  offers `connect`/`disconnect` per key (callbacks get no arguments).
- Storage interface gained whole numbers; the GNOME adapter reads the key's type to tell signed
  from unsigned. Like the other types, the in-memory adapter reports no change for an unchanged
  number.
- The two enums (activation key, edge tiling mode) are plain objects now, because Node's type
  stripping cannot run enums. Same names and values; they live in the Behaviour file.
- Differences to before: an empty activation key still reads as the default of that key; the
  schema default is empty, so nothing changes.
- Documented exceptions that still touch GNOME settings directly:
  1. `Settings.bind`, binding one key to a property of a widget or actor (preferences rows, snap
     assistant, tile preview, panel indicator, edge tiling manager, global state).
  2. The shortcut picker in preferences (`ShortcutSettingButton`).
  3. Registering keybindings: GNOME Shell takes the settings object itself
     (`Main.wm.addKeybinding`, native keybinding override in `keybindings.ts`).
  4. Settings export/import and restore to default (`settingsExport.ts`, `settingsOverride.ts`),
     which work on the whole key list and `dconf`.
  5. Settings of other GNOME schemas, not the extension's own: the accent colour
     (`org.gnome.desktop.interface`, window border manager) and the native edge tiling and
     keybinding overrides (`org.gnome.mutter` and others, `extension.ts`, `settingsOverride.ts`).
  6. Preferences passes the raw settings object to its shortcut rows and reads from it whether a
     keybinding is set (`prefs.ts`). Left for a later ticket if it should go through the
     shortcuts group.
- Checked in the dev stack: extension active, preferences build without errors, maximise/tile
  and window placement scenarios pass, disable and re-enable run without shell errors.

## Amendment: Start and stop order (issue 30, 2026-10-22)
- `lifecycle/lifecycle.ts` knows no GNOME code. Parts have a name, the names they depend on, `start`
  and `stop`. Start runs in dependency order (parts without an order between them in the order
  given), stop in exact reverse, a failed start stops the parts already started and rethrows,
  a failing stop does not keep the others running (first error is rethrown afterwards). Unknown
  dependencies, cycles and duplicate names are rejected when the module is built. Covered by
  `node --test` with fake parts.
- The extension declares 17 parts in `_parts()` and its enable/disable only start and stop them.
  The signal connections are the last part (they depend on the others), so on stop they are
  disconnected first, as before.
- Differences to before: stop order is now the strict reverse of start, so the keybindings, the
  display scale, the native settings overrides and the window manager are released in a different position than the old
  hand-written disable (none depends on another one being alive). The global state is its own
  part that stops before the settings. If start fails, the extension releases its signals itself
  and rethrows.
- Checked in the dev stack: extension active, three disable/re-enable cycles without error,
  preferences build, maximise/tile scenarios pass. The window placement scenario needs a second
  monitor and was not run.
