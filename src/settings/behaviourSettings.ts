// The behaviour group of the settings module (ADR 0008): tiling switches, activation keys, edge
// zones, thresholds and window suggestions. A residual group.
// Free of any GNOME API so it can be tested with plain Node.
import SettingsGroup from './settingsGroup.ts';

// plain objects instead of enums, so the module runs under Node's type stripping
export const ActivationKey = {
    NONE: -1,
    CTRL: 0,
    ALT: 1,
    SUPER: 2,
} as const;
export type ActivationKey = (typeof ActivationKey)[keyof typeof ActivationKey];

export const EdgeTilingMode = {
    DEFAULT: 'default',
    ADAPTIVE: 'adaptive',
    GRANULAR: 'granular',
} as const;
export type EdgeTilingMode =
    (typeof EdgeTilingMode)[keyof typeof EdgeTilingMode];

const KEYS = {
    TILING_SYSTEM: 'enable-tiling-system',
    SNAP_ASSIST: 'enable-snap-assist',
    SNAP_ASSIST_SYNC_LAYOUT: 'snap-assist-sync-layout',
    TILING_SYSTEM_ACTIVATION_KEY: 'tiling-system-activation-key',
    TILING_SYSTEM_DEACTIVATION_KEY: 'tiling-system-deactivation-key',
    SPAN_MULTIPLE_TILES: 'enable-span-multiple-tiles',
    SPAN_MULTIPLE_TILES_ACTIVATION_KEY: 'span-multiple-tiles-activation-key',
    REMEMBER_WINDOWS: 'remember-windows',
    RESTORE_WINDOW_ORIGINAL_SIZE: 'restore-window-original-size',
    WRAPAROUND_FOCUS: 'enable-wraparound-focus',
    ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY: 'enable-directional-focus-tiled-only',
    RESIZE_COMPLEMENTING_WINDOWS: 'resize-complementing-windows',
    ENABLE_AUTO_TILING: 'enable-autotiling',
    RAISE_TOGETHER: 'raise-together',
    ACTIVE_SCREEN_EDGES: 'active-screen-edges',
    TOP_EDGE_MAXIMIZE: 'top-edge-maximize',
    OVERRIDE_WINDOW_MENU: 'override-window-menu',
    OVERRIDE_ALT_TAB: 'override-alt-tab',
    SNAP_ASSISTANT_THRESHOLD: 'snap-assistant-threshold',
    QUARTER_TILING_THRESHOLD: 'quarter-tiling-threshold',
    EDGE_TILING_OFFSET: 'edge-tiling-offset',
    ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS:
        'enable-tiling-system-windows-suggestions',
    ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS:
        'enable-snap-assistant-windows-suggestions',
    ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS:
        'enable-screen-edges-windows-suggestions',
    EDGE_TILING_MODE: 'edge-tiling-mode',
    OVERRIDDEN_SETTINGS: 'overridden-settings',
} as const;

export const KEY_OVERRIDDEN_SETTINGS = KEYS.OVERRIDDEN_SETTINGS;

export default class BehaviourSettings extends SettingsGroup {
    readonly keys = KEYS;

    get tilingSystem(): boolean {
        return this._storage.getBoolean(KEYS.TILING_SYSTEM);
    }

    set tilingSystem(val: boolean) {
        this._storage.setBoolean(KEYS.TILING_SYSTEM, val);
    }

    get snapAssist(): boolean {
        return this._storage.getBoolean(KEYS.SNAP_ASSIST);
    }

    set snapAssist(val: boolean) {
        this._storage.setBoolean(KEYS.SNAP_ASSIST, val);
    }

    get snapAssistSyncLayout(): boolean {
        return this._storage.getBoolean(KEYS.SNAP_ASSIST_SYNC_LAYOUT);
    }

    set snapAssistSyncLayout(val: boolean) {
        this._storage.setBoolean(KEYS.SNAP_ASSIST_SYNC_LAYOUT, val);
    }

    get tilingSystemActivationKey(): ActivationKey {
        return this._getActivationKey(
            KEYS.TILING_SYSTEM_ACTIVATION_KEY,
            ActivationKey.CTRL
        );
    }

    set tilingSystemActivationKey(val: ActivationKey) {
        this._storage.setStrv(KEYS.TILING_SYSTEM_ACTIVATION_KEY, [String(val)]);
    }

    get tilingSystemDeactivationKey(): ActivationKey {
        return this._getActivationKey(
            KEYS.TILING_SYSTEM_DEACTIVATION_KEY,
            ActivationKey.NONE
        );
    }

    set tilingSystemDeactivationKey(val: ActivationKey) {
        this._storage.setStrv(KEYS.TILING_SYSTEM_DEACTIVATION_KEY, [
            String(val),
        ]);
    }

    get spanMultipleTiles(): boolean {
        return this._storage.getBoolean(KEYS.SPAN_MULTIPLE_TILES);
    }

    set spanMultipleTiles(val: boolean) {
        this._storage.setBoolean(KEYS.SPAN_MULTIPLE_TILES, val);
    }

    get spanMultipleTilesActivationKey(): ActivationKey {
        return this._getActivationKey(
            KEYS.SPAN_MULTIPLE_TILES_ACTIVATION_KEY,
            ActivationKey.ALT
        );
    }

    set spanMultipleTilesActivationKey(val: ActivationKey) {
        this._storage.setStrv(KEYS.SPAN_MULTIPLE_TILES_ACTIVATION_KEY, [
            String(val),
        ]);
    }

    get rememberWindows(): boolean {
        return this._storage.getBoolean(KEYS.REMEMBER_WINDOWS);
    }

    set rememberWindows(val: boolean) {
        this._storage.setBoolean(KEYS.REMEMBER_WINDOWS, val);
    }

    get restoreWindowOriginalSize(): boolean {
        return this._storage.getBoolean(KEYS.RESTORE_WINDOW_ORIGINAL_SIZE);
    }

    set restoreWindowOriginalSize(val: boolean) {
        this._storage.setBoolean(KEYS.RESTORE_WINDOW_ORIGINAL_SIZE, val);
    }

    get wraparoundFocus(): boolean {
        return this._storage.getBoolean(KEYS.WRAPAROUND_FOCUS);
    }

    set wraparoundFocus(val: boolean) {
        this._storage.setBoolean(KEYS.WRAPAROUND_FOCUS, val);
    }

    get enableDirectionalFocusTiledOnly(): boolean {
        return this._storage.getBoolean(
            KEYS.ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY
        );
    }

    set enableDirectionalFocusTiledOnly(val: boolean) {
        this._storage.setBoolean(KEYS.ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY, val);
    }

    get resizeComplementingWindows(): boolean {
        return this._storage.getBoolean(KEYS.RESIZE_COMPLEMENTING_WINDOWS);
    }

    set resizeComplementingWindows(val: boolean) {
        this._storage.setBoolean(KEYS.RESIZE_COMPLEMENTING_WINDOWS, val);
    }

    get enableAutoTiling(): boolean {
        return this._storage.getBoolean(KEYS.ENABLE_AUTO_TILING);
    }

    set enableAutoTiling(val: boolean) {
        this._storage.setBoolean(KEYS.ENABLE_AUTO_TILING, val);
    }

    get raiseTogether(): boolean {
        return this._storage.getBoolean(KEYS.RAISE_TOGETHER);
    }

    set raiseTogether(val: boolean) {
        this._storage.setBoolean(KEYS.RAISE_TOGETHER, val);
    }

    get activeScreenEdges(): boolean {
        return this._storage.getBoolean(KEYS.ACTIVE_SCREEN_EDGES);
    }

    set activeScreenEdges(val: boolean) {
        this._storage.setBoolean(KEYS.ACTIVE_SCREEN_EDGES, val);
    }

    get topEdgeMaximize(): boolean {
        return this._storage.getBoolean(KEYS.TOP_EDGE_MAXIMIZE);
    }

    set topEdgeMaximize(val: boolean) {
        this._storage.setBoolean(KEYS.TOP_EDGE_MAXIMIZE, val);
    }

    get overrideWindowMenu(): boolean {
        return this._storage.getBoolean(KEYS.OVERRIDE_WINDOW_MENU);
    }

    set overrideWindowMenu(val: boolean) {
        this._storage.setBoolean(KEYS.OVERRIDE_WINDOW_MENU, val);
    }

    get overrideAltTab(): boolean {
        return this._storage.getBoolean(KEYS.OVERRIDE_ALT_TAB);
    }

    set overrideAltTab(val: boolean) {
        this._storage.setBoolean(KEYS.OVERRIDE_ALT_TAB, val);
    }

    get snapAssistantThreshold(): number {
        return this._storage.getNumber(KEYS.SNAP_ASSISTANT_THRESHOLD);
    }

    set snapAssistantThreshold(val: number) {
        this._storage.setNumber(KEYS.SNAP_ASSISTANT_THRESHOLD, val);
    }

    get quarterTilingThreshold(): number {
        return this._storage.getNumber(KEYS.QUARTER_TILING_THRESHOLD);
    }

    set quarterTilingThreshold(val: number) {
        this._storage.setNumber(KEYS.QUARTER_TILING_THRESHOLD, val);
    }

    get edgeTilingOffset(): number {
        return this._storage.getNumber(KEYS.EDGE_TILING_OFFSET);
    }

    set edgeTilingOffset(val: number) {
        this._storage.setNumber(KEYS.EDGE_TILING_OFFSET, val);
    }

    get enableTilingSystemWindowsSuggestions(): boolean {
        return this._storage.getBoolean(
            KEYS.ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS
        );
    }

    set enableTilingSystemWindowsSuggestions(val: boolean) {
        this._storage.setBoolean(
            KEYS.ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS,
            val
        );
    }

    get enableSnapAssistantWindowsSuggestions(): boolean {
        return this._storage.getBoolean(
            KEYS.ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS
        );
    }

    set enableSnapAssistantWindowsSuggestions(val: boolean) {
        this._storage.setBoolean(
            KEYS.ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS,
            val
        );
    }

    get enableScreenEdgesWindowsSuggestions(): boolean {
        return this._storage.getBoolean(
            KEYS.ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS
        );
    }

    set enableScreenEdgesWindowsSuggestions(val: boolean) {
        this._storage.setBoolean(
            KEYS.ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS,
            val
        );
    }

    get edgeTilingMode(): EdgeTilingMode {
        const value = this._storage.getString(KEYS.EDGE_TILING_MODE);
        if (Object.values(EdgeTilingMode).includes(value as EdgeTilingMode))
            return value as EdgeTilingMode;

        return EdgeTilingMode.DEFAULT;
    }

    set edgeTilingMode(val: EdgeTilingMode) {
        this._storage.setString(KEYS.EDGE_TILING_MODE, val);
    }

    get overriddenSettings(): string {
        return this._storage.getString(KEYS.OVERRIDDEN_SETTINGS);
    }

    set overriddenSettings(val: string) {
        this._storage.setString(KEYS.OVERRIDDEN_SETTINGS, val);
    }

    // stored as a list with one number; empty (the schema default) means the given default
    private _getActivationKey(
        key: string,
        defaultValue: ActivationKey
    ): ActivationKey {
        const val = this._storage.getStrv(key);
        return Number(
            val.length === 0 ? String(defaultValue) : val[0]
        ) as ActivationKey;
    }
}
