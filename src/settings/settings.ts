import { Gio, GObject } from '../gi/shared';
import AppearanceSettings from './appearanceSettings';
import BehaviourSettings from './behaviourSettings';
import GnomeStorage from './gnomeStorage';
import LayoutsSettings from './layoutsSettings';
import ShortcutsSettings from './shortcutsSettings';
import SpacingSettings from './spacingSettings';
import VersionSettings, {
    KEY_LAST_VERSION_NAME_INSTALLED,
} from './versionSettings';
import WindowMemorySettings, {
    KEY_REMEMBERED_WINDOWS,
} from './windowMemorySettings';

// Entry point of the settings module (ADR 0008): holds the settings groups, which are created
// over the GNOME storage by `initialize`. Works in the extension and in preferences.
export default class Settings {
    private static _settings: Gio.Settings | null = null;
    private static _is_initialized: boolean = false;
    private static _layouts: LayoutsSettings | null = null;
    private static _version: VersionSettings | null = null;
    private static _windowMemory: WindowMemorySettings | null = null;
    private static _spacing: SpacingSettings | null = null;
    private static _appearance: AppearanceSettings | null = null;
    private static _behaviour: BehaviourSettings | null = null;
    private static _shortcuts: ShortcutsSettings | null = null;

    // keys the settings export leaves out
    static KEY_LAST_VERSION_NAME_INSTALLED = KEY_LAST_VERSION_NAME_INSTALLED;
    static KEY_REMEMBERED_WINDOWS = KEY_REMEMBERED_WINDOWS;

    static initialize(settings: Gio.Settings) {
        if (this._is_initialized) return;

        this._is_initialized = true;
        this._settings = settings;
        const storage = new GnomeStorage(settings);
        this._layouts = new LayoutsSettings(storage);
        this._version = new VersionSettings(storage);
        this._windowMemory = new WindowMemorySettings(storage);
        this._spacing = new SpacingSettings(storage);
        this._appearance = new AppearanceSettings(storage);
        this._behaviour = new BehaviourSettings(storage);
        this._shortcuts = new ShortcutsSettings(storage);
    }

    static destroy() {
        if (this._is_initialized) {
            this._is_initialized = false;
            this._layouts?.destroy();
            this._spacing?.destroy();
            this._appearance?.destroy();
            this._behaviour?.destroy();
            this._shortcuts?.destroy();
            this._layouts = null;
            this._version = null;
            this._windowMemory = null;
            this._spacing = null;
            this._appearance = null;
            this._behaviour = null;
            this._shortcuts = null;
            this._settings = null;
        }
    }

    static get layouts(): LayoutsSettings {
        if (!this._layouts) throw new Error('Settings are not initialized');
        return this._layouts;
    }

    static get version(): VersionSettings {
        if (!this._version) throw new Error('Settings are not initialized');
        return this._version;
    }

    static get windowMemory(): WindowMemorySettings {
        if (!this._windowMemory)
            throw new Error('Settings are not initialized');
        return this._windowMemory;
    }

    static get spacing(): SpacingSettings {
        if (!this._spacing) throw new Error('Settings are not initialized');
        return this._spacing;
    }

    static get appearance(): AppearanceSettings {
        if (!this._appearance) throw new Error('Settings are not initialized');
        return this._appearance;
    }

    static get behaviour(): BehaviourSettings {
        if (!this._behaviour) throw new Error('Settings are not initialized');
        return this._behaviour;
    }

    static get shortcuts(): ShortcutsSettings {
        if (!this._shortcuts) throw new Error('Settings are not initialized');
        return this._shortcuts;
    }

    // Documented exception (ADR 0008): binds one key to a property of a widget or actor. This
    // needs the GNOME settings object, so it stays here instead of in a group.
    static bind(
        key: string,
        object: GObject.Object | any,
        property: string,
        flags: Gio.SettingsBindFlags = Gio.SettingsBindFlags.DEFAULT
    ): void {
        this._settings?.bind(key, object, property, flags);
    }
}
