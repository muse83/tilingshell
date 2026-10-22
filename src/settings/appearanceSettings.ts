// The appearance group of the settings module (ADR 0008): window border, blur, animation times and
// the panel indicator.
// Free of any GNOME API so it can be tested with plain Node.
import SettingsGroup from './settingsGroup.ts';

const KEYS = {
    SHOW_INDICATOR: 'show-indicator',
    ENABLE_WINDOW_BORDER: 'enable-window-border',
    WINDOW_BORDER_COLOR: 'window-border-color',
    WINDOW_USE_CUSTOM_BORDER_COLOR: 'window-use-custom-border-color',
    WINDOW_BORDER_WIDTH: 'window-border-width',
    ENABLE_SMART_WINDOW_BORDER_RADIUS: 'enable-smart-window-border-radius',
    ENABLE_BLUR_SNAP_ASSISTANT: 'enable-blur-snap-assistant',
    ENABLE_BLUR_SELECTED_TILEPREVIEW: 'enable-blur-selected-tilepreview',
    SNAP_ASSISTANT_ANIMATION_TIME: 'snap-assistant-animation-time',
    TILE_PREVIEW_ANIMATION_TIME: 'tile-preview-animation-time',
} as const;

export default class AppearanceSettings extends SettingsGroup {
    readonly keys = KEYS;

    get showIndicator(): boolean {
        return this._storage.getBoolean(KEYS.SHOW_INDICATOR);
    }

    set showIndicator(val: boolean) {
        this._storage.setBoolean(KEYS.SHOW_INDICATOR, val);
    }

    get enableWindowBorder(): boolean {
        return this._storage.getBoolean(KEYS.ENABLE_WINDOW_BORDER);
    }

    set enableWindowBorder(val: boolean) {
        this._storage.setBoolean(KEYS.ENABLE_WINDOW_BORDER, val);
    }

    get windowBorderColor(): string {
        return this._storage.getString(KEYS.WINDOW_BORDER_COLOR);
    }

    set windowBorderColor(val: string) {
        this._storage.setString(KEYS.WINDOW_BORDER_COLOR, val);
    }

    get windowUseCustomBorderColor(): boolean {
        return this._storage.getBoolean(KEYS.WINDOW_USE_CUSTOM_BORDER_COLOR);
    }

    set windowUseCustomBorderColor(val: boolean) {
        this._storage.setBoolean(KEYS.WINDOW_USE_CUSTOM_BORDER_COLOR, val);
    }

    get windowBorderWidth(): number {
        return this._storage.getNumber(KEYS.WINDOW_BORDER_WIDTH);
    }

    set windowBorderWidth(val: number) {
        this._storage.setNumber(KEYS.WINDOW_BORDER_WIDTH, val);
    }

    get enableSmartWindowBorderRadius(): boolean {
        return this._storage.getBoolean(KEYS.ENABLE_SMART_WINDOW_BORDER_RADIUS);
    }

    set enableSmartWindowBorderRadius(val: boolean) {
        this._storage.setBoolean(KEYS.ENABLE_SMART_WINDOW_BORDER_RADIUS, val);
    }

    get enableBlurSnapAssistant(): boolean {
        return this._storage.getBoolean(KEYS.ENABLE_BLUR_SNAP_ASSISTANT);
    }

    set enableBlurSnapAssistant(val: boolean) {
        this._storage.setBoolean(KEYS.ENABLE_BLUR_SNAP_ASSISTANT, val);
    }

    get enableBlurSelectedTilepreview(): boolean {
        return this._storage.getBoolean(KEYS.ENABLE_BLUR_SELECTED_TILEPREVIEW);
    }

    set enableBlurSelectedTilepreview(val: boolean) {
        this._storage.setBoolean(KEYS.ENABLE_BLUR_SELECTED_TILEPREVIEW, val);
    }

    get snapAssistantAnimationTime(): number {
        return this._storage.getNumber(KEYS.SNAP_ASSISTANT_ANIMATION_TIME);
    }

    set snapAssistantAnimationTime(val: number) {
        this._storage.setNumber(KEYS.SNAP_ASSISTANT_ANIMATION_TIME, val);
    }

    get tilePreviewAnimationTime(): number {
        return this._storage.getNumber(KEYS.TILE_PREVIEW_ANIMATION_TIME);
    }

    set tilePreviewAnimationTime(val: number) {
        this._storage.setNumber(KEYS.TILE_PREVIEW_ANIMATION_TIME, val);
    }
}
