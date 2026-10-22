import { Gio, GObject } from '../gi/shared';
import GnomeStorage from './gnomeStorage';
import LayoutsSettings from './layoutsSettings';
import VersionSettings, {
    KEY_LAST_VERSION_NAME_INSTALLED,
} from './versionSettings';
import WindowMemorySettings, {
    KEY_REMEMBERED_WINDOWS,
} from './windowMemorySettings';

export enum ActivationKey {
    NONE = -1,
    CTRL = 0,
    ALT,
    SUPER,
}

export enum EdgeTilingMode {
    DEFAULT = 'default',
    ADAPTIVE = 'adaptive',
    GRANULAR = 'granular',
}

/** ------------- Utility functions ------------- */
function get_string(key: string): string {
    return (
        Settings.gioSetting.get_string(key) ??
        Settings.gioSetting.get_default_value(key)?.get_string()[0]
    );
}

function set_string(key: string, val: string): boolean {
    return Settings.gioSetting.set_string(key, val);
}

function get_boolean(key: string): boolean {
    return (
        Settings.gioSetting.get_boolean(key) ??
        Settings.gioSetting.get_default_value(key)?.get_boolean()
    );
}

function set_boolean(key: string, val: boolean): boolean {
    return Settings.gioSetting.set_boolean(key, val);
}

function get_number(key: string): number {
    return (
        Settings.gioSetting.get_int(key) ??
        Settings.gioSetting.get_default_value(key)?.get_int64()
    );
}

function set_number(key: string, val: number): boolean {
    return Settings.gioSetting.set_int(key, val);
}

function get_unsigned_number(key: string): number {
    return (
        Settings.gioSetting.get_uint(key) ??
        Settings.gioSetting.get_default_value(key)?.get_uint64()
    );
}

function set_unsigned_number(key: string, val: number): boolean {
    return Settings.gioSetting.set_uint(key, val);
}

function get_activationkey(
    key: string,
    defaultValue: ActivationKey
): ActivationKey {
    let val = Settings.gioSetting.get_strv(key);
    if (!val || val.length === 0) {
        val = Settings.gioSetting.get_default_value(key)?.get_strv() ?? [
            String(defaultValue),
        ];
        if (val.length === 0) val = [String(defaultValue)];
    }
    return Number(val[0]);
}

function set_activationkey(key: string, val: ActivationKey): boolean {
    return Settings.gioSetting.set_strv(key, [String(val)]);
}

export default class Settings {
    static _settings: Gio.Settings | null;
    static _is_initialized: boolean = false;
    private static _layouts: LayoutsSettings | null = null;
    private static _version: VersionSettings | null = null;
    private static _windowMemory: WindowMemorySettings | null = null;

    static KEY_LAST_VERSION_NAME_INSTALLED = KEY_LAST_VERSION_NAME_INSTALLED;
    static KEY_OVERRIDDEN_SETTINGS = 'overridden-settings';
    static KEY_WINDOW_BORDER_COLOR = 'window-border-color';
    static KEY_WINDOW_USE_CUSTOM_BORDER_COLOR =
        'window-use-custom-border-color';

    static KEY_TILING_SYSTEM = 'enable-tiling-system';
    static KEY_SNAP_ASSIST = 'enable-snap-assist';
    static KEY_SNAP_ASSIST_SYNC_LAYOUT = 'snap-assist-sync-layout';
    static KEY_SHOW_INDICATOR = 'show-indicator';
    static KEY_TILING_SYSTEM_ACTIVATION_KEY = 'tiling-system-activation-key';
    static KEY_TILING_SYSTEM_DEACTIVATION_KEY =
        'tiling-system-deactivation-key';

    static KEY_SPAN_MULTIPLE_TILES_ACTIVATION_KEY =
        'span-multiple-tiles-activation-key';

    static KEY_SPAN_MULTIPLE_TILES = 'enable-span-multiple-tiles';
    static KEY_RESTORE_WINDOW_ORIGINAL_SIZE = 'restore-window-original-size';
    static KEY_REMEMBER_WINDOWS = 'remember-windows';
    static KEY_REMEMBERED_WINDOWS = KEY_REMEMBERED_WINDOWS;
    static KEY_WRAPAROUND_FOCUS = 'enable-wraparound-focus';
    static KEY_ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY =
        'enable-directional-focus-tiled-only';

    static KEY_RESIZE_COMPLEMENTING_WINDOWS = 'resize-complementing-windows';
    static KEY_ENABLE_BLUR_SNAP_ASSISTANT = 'enable-blur-snap-assistant';
    static KEY_ENABLE_BLUR_SELECTED_TILEPREVIEW =
        'enable-blur-selected-tilepreview';

    static KEY_ENABLE_MOVE_KEYBINDINGS = 'enable-move-keybindings';
    static KEY_ENABLE_AUTO_TILING = 'enable-autotiling';
    static KEY_RAISE_TOGETHER = 'raise-together';
    static KEY_ACTIVE_SCREEN_EDGES = 'active-screen-edges';
    static KEY_TOP_EDGE_MAXIMIZE = 'top-edge-maximize';
    static KEY_OVERRIDE_WINDOW_MENU = 'override-window-menu';
    static KEY_OVERRIDE_ALT_TAB = 'override-alt-tab';
    static KEY_SNAP_ASSISTANT_THRESHOLD = 'snap-assistant-threshold';
    static KEY_ENABLE_WINDOW_BORDER = 'enable-window-border';
    static KEY_INNER_GAPS = 'inner-gaps';
    static KEY_OUTER_GAPS = 'outer-gaps';
    static KEY_SNAP_ASSISTANT_ANIMATION_TIME = 'snap-assistant-animation-time';
    static KEY_TILE_PREVIEW_ANIMATION_TIME = 'tile-preview-animation-time';
    static KEY_WINDOW_BORDER_WIDTH = 'window-border-width';
    static KEY_ENABLE_SMART_WINDOW_BORDER_RADIUS =
        'enable-smart-window-border-radius';

    static KEY_QUARTER_TILING_THRESHOLD = 'quarter-tiling-threshold';
    static KEY_EDGE_TILING_OFFSET = 'edge-tiling-offset';
    static KEY_ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS =
        'enable-tiling-system-windows-suggestions';

    static KEY_ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS =
        'enable-snap-assistant-windows-suggestions';

    static KEY_ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS =
        'enable-screen-edges-windows-suggestions';

    static KEY_EDGE_TILING_MODE = 'edge-tiling-mode';

    static SETTING_MOVE_WINDOW_RIGHT = 'move-window-right';
    static SETTING_MOVE_WINDOW_LEFT = 'move-window-left';
    static SETTING_MOVE_WINDOW_UP = 'move-window-up';
    static SETTING_MOVE_WINDOW_DOWN = 'move-window-down';
    static SETTING_SPAN_WINDOW_RIGHT = 'span-window-right';
    static SETTING_SPAN_WINDOW_LEFT = 'span-window-left';
    static SETTING_SPAN_WINDOW_UP = 'span-window-up';
    static SETTING_SPAN_WINDOW_DOWN = 'span-window-down';
    static SETTING_SPAN_WINDOW_ALL_TILES = 'span-window-all-tiles';
    static SETTING_UNTILE_WINDOW = 'untile-window';
    static SETTING_MOVE_WINDOW_CENTER = 'move-window-center';
    static SETTING_FOCUS_WINDOW_RIGHT = 'focus-window-right';
    static SETTING_FOCUS_WINDOW_LEFT = 'focus-window-left';
    static SETTING_FOCUS_WINDOW_UP = 'focus-window-up';
    static SETTING_FOCUS_WINDOW_DOWN = 'focus-window-down';
    static SETTING_FOCUS_WINDOW_NEXT = 'focus-window-next';
    static SETTING_FOCUS_WINDOW_PREV = 'focus-window-prev';
    static SETTING_HIGHLIGHT_CURRENT_WINDOW = 'highlight-current-window';
    static SETTING_CYCLE_LAYOUTS = 'cycle-layouts';
    static SETTING_CYCLE_LAYOUTS_BACKWARD = 'cycle-layouts-backward';

    static initialize(settings: Gio.Settings) {
        if (this._is_initialized) return;

        this._is_initialized = true;
        this._settings = settings;
        const storage = new GnomeStorage(settings);
        this._layouts = new LayoutsSettings(storage);
        this._version = new VersionSettings(storage);
        this._windowMemory = new WindowMemorySettings(storage);
    }

    static destroy() {
        if (this._is_initialized) {
            this._is_initialized = false;
            this._layouts?.destroy();
            this._layouts = null;
            this._version = null;
            this._windowMemory = null;
            this._settings = null;
        }
    }

    // the layouts group of the settings module (ADR 0008)
    static get layouts(): LayoutsSettings {
        if (!this._layouts) throw new Error('Settings are not initialized');
        return this._layouts;
    }

    // the version and migration group (ADR 0008)
    static get version(): VersionSettings {
        if (!this._version) throw new Error('Settings are not initialized');
        return this._version;
    }

    // the window memory group (ADR 0008)
    static get windowMemory(): WindowMemorySettings {
        if (!this._windowMemory)
            throw new Error('Settings are not initialized');
        return this._windowMemory;
    }

    static get gioSetting(): Gio.Settings {
        return this._settings ?? new Gio.Settings();
    }

    static bind(
        key: string,
        object: GObject.Object | any,
        property: string,
        flags: Gio.SettingsBindFlags = Gio.SettingsBindFlags.DEFAULT
    ): void {
        this._settings?.bind(key, object, property, flags);
    }

    static get OVERRIDDEN_SETTINGS(): string {
        return get_string(Settings.KEY_OVERRIDDEN_SETTINGS);
    }

    static set OVERRIDDEN_SETTINGS(val: string) {
        set_string(Settings.KEY_OVERRIDDEN_SETTINGS, val);
    }

    static get TILING_SYSTEM(): boolean {
        return get_boolean(Settings.KEY_TILING_SYSTEM);
    }

    static set TILING_SYSTEM(val: boolean) {
        set_boolean(Settings.KEY_TILING_SYSTEM, val);
    }

    static get SNAP_ASSIST(): boolean {
        return get_boolean(Settings.KEY_SNAP_ASSIST);
    }

    static set SNAP_ASSIST(val: boolean) {
        set_boolean(Settings.KEY_SNAP_ASSIST, val);
    }

    static get SNAP_ASSIST_SYNC_LAYOUT(): boolean {
        return get_boolean(Settings.KEY_SNAP_ASSIST_SYNC_LAYOUT);
    }

    static set SNAP_ASSIST_SYNC_LAYOUT(val: boolean) {
        set_boolean(Settings.KEY_SNAP_ASSIST_SYNC_LAYOUT, val);
    }

    static get SHOW_INDICATOR(): boolean {
        return get_boolean(Settings.KEY_SHOW_INDICATOR);
    }

    static set SHOW_INDICATOR(val: boolean) {
        set_boolean(Settings.KEY_SHOW_INDICATOR, val);
    }

    static get TILING_SYSTEM_ACTIVATION_KEY(): ActivationKey {
        return get_activationkey(
            Settings.KEY_TILING_SYSTEM_ACTIVATION_KEY,
            ActivationKey.CTRL
        );
    }

    static set TILING_SYSTEM_ACTIVATION_KEY(val: ActivationKey) {
        set_activationkey(Settings.KEY_TILING_SYSTEM_ACTIVATION_KEY, val);
    }

    static get TILING_SYSTEM_DEACTIVATION_KEY(): ActivationKey {
        return get_activationkey(
            Settings.KEY_TILING_SYSTEM_DEACTIVATION_KEY,
            ActivationKey.NONE
        );
    }

    static set TILING_SYSTEM_DEACTIVATION_KEY(val: ActivationKey) {
        set_activationkey(Settings.KEY_TILING_SYSTEM_DEACTIVATION_KEY, val);
    }

    static get INNER_GAPS(): number {
        return get_unsigned_number(Settings.KEY_INNER_GAPS);
    }

    static set INNER_GAPS(val: number) {
        set_unsigned_number(Settings.KEY_INNER_GAPS, val);
    }

    static get OUTER_GAPS(): number {
        return get_unsigned_number(Settings.KEY_OUTER_GAPS);
    }

    static set OUTER_GAPS(val: number) {
        set_unsigned_number(Settings.KEY_OUTER_GAPS, val);
    }

    static get SPAN_MULTIPLE_TILES(): boolean {
        return get_boolean(Settings.KEY_SPAN_MULTIPLE_TILES);
    }

    static set SPAN_MULTIPLE_TILES(val: boolean) {
        set_boolean(Settings.KEY_SPAN_MULTIPLE_TILES, val);
    }

    static get SPAN_MULTIPLE_TILES_ACTIVATION_KEY(): ActivationKey {
        return get_activationkey(
            Settings.KEY_SPAN_MULTIPLE_TILES_ACTIVATION_KEY,
            ActivationKey.ALT
        );
    }

    static set SPAN_MULTIPLE_TILES_ACTIVATION_KEY(val: ActivationKey) {
        set_activationkey(Settings.KEY_SPAN_MULTIPLE_TILES_ACTIVATION_KEY, val);
    }

    static get REMEMBER_WINDOWS(): boolean {
        return get_boolean(Settings.KEY_REMEMBER_WINDOWS);
    }

    static set REMEMBER_WINDOWS(val: boolean) {
        set_boolean(Settings.KEY_REMEMBER_WINDOWS, val);
    }

    static get RESTORE_WINDOW_ORIGINAL_SIZE(): boolean {
        return get_boolean(Settings.KEY_RESTORE_WINDOW_ORIGINAL_SIZE);
    }

    static set RESTORE_WINDOW_ORIGINAL_SIZE(val: boolean) {
        set_boolean(Settings.KEY_RESTORE_WINDOW_ORIGINAL_SIZE, val);
    }

    static get WRAPAROUND_FOCUS(): boolean {
        return get_boolean(Settings.KEY_WRAPAROUND_FOCUS);
    }

    static set WRAPAROUND_FOCUS(val: boolean) {
        set_boolean(Settings.KEY_WRAPAROUND_FOCUS, val);
    }

    static get ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY(): boolean {
        return get_boolean(Settings.KEY_ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY);
    }

    static set ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY, val);
    }

    static get RESIZE_COMPLEMENTING_WINDOWS(): boolean {
        return get_boolean(Settings.KEY_RESIZE_COMPLEMENTING_WINDOWS);
    }

    static set RESIZE_COMPLEMENTING_WINDOWS(val: boolean) {
        set_boolean(Settings.KEY_RESIZE_COMPLEMENTING_WINDOWS, val);
    }

    static get ENABLE_BLUR_SNAP_ASSISTANT(): boolean {
        return get_boolean(Settings.KEY_ENABLE_BLUR_SNAP_ASSISTANT);
    }

    static set ENABLE_BLUR_SNAP_ASSISTANT(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_BLUR_SNAP_ASSISTANT, val);
    }

    static get ENABLE_BLUR_SELECTED_TILEPREVIEW(): boolean {
        return get_boolean(Settings.KEY_ENABLE_BLUR_SELECTED_TILEPREVIEW);
    }

    static set ENABLE_BLUR_SELECTED_TILEPREVIEW(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_BLUR_SELECTED_TILEPREVIEW, val);
    }

    static get ENABLE_MOVE_KEYBINDINGS(): boolean {
        return get_boolean(Settings.KEY_ENABLE_MOVE_KEYBINDINGS);
    }

    static set ENABLE_MOVE_KEYBINDINGS(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_MOVE_KEYBINDINGS, val);
    }

    static get ENABLE_AUTO_TILING(): boolean {
        return get_boolean(Settings.KEY_ENABLE_AUTO_TILING);
    }

    static set ENABLE_AUTO_TILING(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_AUTO_TILING, val);
    }

    static get RAISE_TOGETHER(): boolean {
        return get_boolean(Settings.KEY_RAISE_TOGETHER);
    }

    static set RAISE_TOGETHER(val: boolean) {
        set_boolean(Settings.KEY_RAISE_TOGETHER, val);
    }

    static get ACTIVE_SCREEN_EDGES(): boolean {
        return get_boolean(Settings.KEY_ACTIVE_SCREEN_EDGES);
    }

    static set ACTIVE_SCREEN_EDGES(val: boolean) {
        set_boolean(Settings.KEY_ACTIVE_SCREEN_EDGES, val);
    }

    static get TOP_EDGE_MAXIMIZE(): boolean {
        return get_boolean(Settings.KEY_TOP_EDGE_MAXIMIZE);
    }

    static set TOP_EDGE_MAXIMIZE(val: boolean) {
        set_boolean(Settings.KEY_TOP_EDGE_MAXIMIZE, val);
    }

    static get OVERRIDE_WINDOW_MENU(): boolean {
        return get_boolean(Settings.KEY_OVERRIDE_WINDOW_MENU);
    }

    static set OVERRIDE_WINDOW_MENU(val: boolean) {
        set_boolean(Settings.KEY_OVERRIDE_WINDOW_MENU, val);
    }

    static get OVERRIDE_ALT_TAB(): boolean {
        return get_boolean(Settings.KEY_OVERRIDE_ALT_TAB);
    }

    static set OVERRIDE_ALT_TAB(val: boolean) {
        set_boolean(Settings.KEY_OVERRIDE_ALT_TAB, val);
    }

    static get SNAP_ASSISTANT_THRESHOLD(): number {
        return get_number(Settings.KEY_SNAP_ASSISTANT_THRESHOLD);
    }

    static set SNAP_ASSISTANT_THRESHOLD(val: number) {
        set_number(Settings.KEY_SNAP_ASSISTANT_THRESHOLD, val);
    }

    static get QUARTER_TILING_THRESHOLD(): number {
        return get_unsigned_number(Settings.KEY_QUARTER_TILING_THRESHOLD);
    }

    static set QUARTER_TILING_THRESHOLD(val: number) {
        set_unsigned_number(Settings.KEY_QUARTER_TILING_THRESHOLD, val);
    }

    static get EDGE_TILING_OFFSET(): number {
        return get_unsigned_number(Settings.KEY_EDGE_TILING_OFFSET);
    }

    static set EDGE_TILING_OFFSET(val: number) {
        set_unsigned_number(Settings.KEY_EDGE_TILING_OFFSET, val);
    }

    static get WINDOW_BORDER_COLOR(): string {
        return get_string(Settings.KEY_WINDOW_BORDER_COLOR);
    }

    static set WINDOW_BORDER_COLOR(val: string) {
        set_string(Settings.KEY_WINDOW_BORDER_COLOR, val);
    }

    static get WINDOW_USE_CUSTOM_BORDER_COLOR(): boolean {
        return get_boolean(Settings.KEY_WINDOW_USE_CUSTOM_BORDER_COLOR);
    }

    static set WINDOW_USE_CUSTOM_BORDER_COLOR(val: boolean) {
        set_boolean(Settings.KEY_WINDOW_USE_CUSTOM_BORDER_COLOR, val);
    }

    static get WINDOW_BORDER_WIDTH(): number {
        return get_unsigned_number(Settings.KEY_WINDOW_BORDER_WIDTH);
    }

    static set WINDOW_BORDER_WIDTH(val: number) {
        set_unsigned_number(Settings.KEY_WINDOW_BORDER_WIDTH, val);
    }

    static get ENABLE_SMART_WINDOW_BORDER_RADIUS(): boolean {
        return get_boolean(Settings.KEY_ENABLE_SMART_WINDOW_BORDER_RADIUS);
    }

    static set ENABLE_SMART_WINDOW_BORDER_RADIUS(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_SMART_WINDOW_BORDER_RADIUS, val);
    }

    static get ENABLE_WINDOW_BORDER(): boolean {
        return get_boolean(Settings.KEY_ENABLE_WINDOW_BORDER);
    }

    static set ENABLE_WINDOW_BORDER(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_WINDOW_BORDER, val);
    }

    static get SNAP_ASSISTANT_ANIMATION_TIME(): number {
        return get_unsigned_number(Settings.KEY_SNAP_ASSISTANT_ANIMATION_TIME);
    }

    static set SNAP_ASSISTANT_ANIMATION_TIME(val: number) {
        set_unsigned_number(Settings.KEY_SNAP_ASSISTANT_ANIMATION_TIME, val);
    }

    static get TILE_PREVIEW_ANIMATION_TIME(): number {
        return get_unsigned_number(Settings.KEY_TILE_PREVIEW_ANIMATION_TIME);
    }

    static set TILE_PREVIEW_ANIMATION_TIME(val: number) {
        set_unsigned_number(Settings.KEY_TILE_PREVIEW_ANIMATION_TIME, val);
    }

    static get ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS(): boolean {
        return get_boolean(
            Settings.KEY_ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS
        );
    }

    static set ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS, val);
    }

    static get ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS(): boolean {
        return get_boolean(
            Settings.KEY_ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS
        );
    }

    static set ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS(val: boolean) {
        set_boolean(
            Settings.KEY_ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS,
            val
        );
    }

    static get ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS(): boolean {
        return get_boolean(
            Settings.KEY_ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS
        );
    }

    static set ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS(val: boolean) {
        set_boolean(Settings.KEY_ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS, val);
    }

    static get EDGE_TILING_MODE(): EdgeTilingMode {
        const value = get_string(Settings.KEY_EDGE_TILING_MODE);
        if (Object.values(EdgeTilingMode).includes(value as EdgeTilingMode))
            return value as EdgeTilingMode;

        return EdgeTilingMode.DEFAULT;
    }

    static set EDGE_TILING_MODE(val: EdgeTilingMode) {
        set_string(Settings.KEY_EDGE_TILING_MODE, val);
    }

    static get_inner_gaps(scaleFactor: number = 1): {
        top: number;
        bottom: number;
        left: number;
        right: number;
    } {
        // get the gaps settings and scale by scale factor
        const value = this.INNER_GAPS * scaleFactor;
        return {
            top: value,
            bottom: value,
            left: value,
            right: value,
        };
    }

    static get_outer_gaps(scaleFactor: number = 1): {
        top: number;
        bottom: number;
        left: number;
        right: number;
    } {
        // get the gaps settings and scale by scale factor
        const value = this.OUTER_GAPS * scaleFactor;
        return {
            top: value,
            bottom: value,
            left: value,
            right: value,
        };
    }

    static connect(key: string, func: (..._arg: unknown[]) => void): number {
        return this._settings?.connect(`changed::${key}`, func) || -1;
    }

    static disconnect(id: number) {
        this._settings?.disconnect(id);
    }
}
