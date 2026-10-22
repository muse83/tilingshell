// The shortcuts group of the settings module (ADR 0008): the on/off switch of the keybindings and
// the names of the keybinding keys. GNOME Shell registers the keybindings itself from the settings
// object (documented exception in the ADR).
// Free of any GNOME API so it can be tested with plain Node.
import SettingsGroup from './settingsGroup.ts';

const KEYS = {
    ENABLE_MOVE_KEYBINDINGS: 'enable-move-keybindings',
    MOVE_WINDOW_RIGHT: 'move-window-right',
    MOVE_WINDOW_LEFT: 'move-window-left',
    MOVE_WINDOW_UP: 'move-window-up',
    MOVE_WINDOW_DOWN: 'move-window-down',
    SPAN_WINDOW_RIGHT: 'span-window-right',
    SPAN_WINDOW_LEFT: 'span-window-left',
    SPAN_WINDOW_UP: 'span-window-up',
    SPAN_WINDOW_DOWN: 'span-window-down',
    SPAN_WINDOW_ALL_TILES: 'span-window-all-tiles',
    UNTILE_WINDOW: 'untile-window',
    MOVE_WINDOW_CENTER: 'move-window-center',
    FOCUS_WINDOW_RIGHT: 'focus-window-right',
    FOCUS_WINDOW_LEFT: 'focus-window-left',
    FOCUS_WINDOW_UP: 'focus-window-up',
    FOCUS_WINDOW_DOWN: 'focus-window-down',
    FOCUS_WINDOW_NEXT: 'focus-window-next',
    FOCUS_WINDOW_PREV: 'focus-window-prev',
    HIGHLIGHT_CURRENT_WINDOW: 'highlight-current-window',
    CYCLE_LAYOUTS: 'cycle-layouts',
    CYCLE_LAYOUTS_BACKWARD: 'cycle-layouts-backward',
} as const;

export default class ShortcutsSettings extends SettingsGroup {
    readonly keys = KEYS;

    get enableMoveKeybindings(): boolean {
        return this._storage.getBoolean(KEYS.ENABLE_MOVE_KEYBINDINGS);
    }

    set enableMoveKeybindings(val: boolean) {
        this._storage.setBoolean(KEYS.ENABLE_MOVE_KEYBINDINGS, val);
    }
}
