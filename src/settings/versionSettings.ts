// The version and migration group of the settings module (ADR 0008): remembers which version of
// the extension last ran and applies the compatibility changes to stored settings when it differs.
// Free of any GNOME API so it can be tested with plain Node.
import type { SettingsStorage } from './storage';

export const KEY_LAST_VERSION_NAME_INSTALLED = 'last-version-name-installed';
const KEY_ENABLE_WINDOW_BORDER = 'enable-window-border';
const KEY_WINDOW_USE_CUSTOM_BORDER_COLOR = 'window-use-custom-border-color';
const KEY_CYCLE_LAYOUTS = 'cycle-layouts';
const KEY_CYCLE_LAYOUTS_BACKWARD = 'cycle-layouts-backward';

export default class VersionSettings {
    private readonly _storage: SettingsStorage;

    constructor(storage: SettingsStorage) {
        this._storage = storage;
    }

    get lastVersionInstalled(): string {
        return this._storage.getString(KEY_LAST_VERSION_NAME_INSTALLED);
    }

    set lastVersionInstalled(version: string) {
        this._storage.setString(KEY_LAST_VERSION_NAME_INSTALLED, version);
    }

    // Called at every start with the running version (undefined when unknown). The very first
    // run only records the version; the compatibility changes then look at the recorded one.
    migrate(runningVersion: string | undefined) {
        if (this.lastVersionInstalled === '0' && runningVersion)
            this.lastVersionInstalled = runningVersion;

        if (this.lastVersionInstalled === '17.0') {
            // users who enabled the window border set it custom in the past: keep the custom
            // border instead of the accent color
            this._storage.setBoolean(
                KEY_WINDOW_USE_CUSTOM_BORDER_COLOR,
                this._storage.getBoolean(KEY_ENABLE_WINDOW_BORDER)
            );
        }

        if (this.lastVersionInstalled !== '17.3') {
            // users of the cycle layouts keybinding get the backwards one as well
            this._storage.setStrv(KEY_CYCLE_LAYOUTS_BACKWARD, [
                `<Shift>${this._storage.getStrv(KEY_CYCLE_LAYOUTS)}`,
            ]);
        }
    }
}
