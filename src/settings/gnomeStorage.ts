import { Gio, GLib } from '../gi/shared';
import type { SettingsStorage } from './storage';

export default class GnomeStorage implements SettingsStorage {
    private readonly _settings: Gio.Settings;

    constructor(settings: Gio.Settings) {
        this._settings = settings;
    }

    getString(key: string): string {
        return this._settings.get_string(key);
    }

    setString(key: string, value: string): void {
        this._settings.set_string(key, value);
    }

    getStringLists(key: string): string[][] {
        const variant = this._settings.get_value(key);
        const result: string[][] = [];
        for (let i = 0; i < variant.n_children(); i++) {
            const listVariant = variant.get_child_value(i);
            if (!listVariant) continue;

            const list: string[] = [];
            for (let j = 0; j < listVariant.n_children(); j++) {
                const item = listVariant.get_child_value(j);
                if (!item) continue;

                list.push(item.get_string()[0]);
            }
            result.push(list);
        }
        return result;
    }

    setStringLists(key: string, value: string[][]): void {
        const variants = value.map(list => GLib.Variant.new_strv(list));
        this._settings.set_value(key, GLib.Variant.new_array(null, variants));
    }

    getBoolean(key: string): boolean {
        return this._settings.get_boolean(key);
    }

    setBoolean(key: string, value: boolean): void {
        this._settings.set_boolean(key, value);
    }

    getNumber(key: string): number {
        const variant = this._settings.get_value(key);
        return variant.get_type_string() === 'i'
            ? variant.get_int32()
            : variant.get_uint32();
    }

    setNumber(key: string, value: number): void {
        const signed = this._settings.get_value(key).get_type_string() === 'i';
        this._settings.set_value(
            key,
            signed
                ? GLib.Variant.new_int32(value)
                : GLib.Variant.new_uint32(value)
        );
    }

    getStrv(key: string): string[] {
        return this._settings.get_strv(key);
    }

    setStrv(key: string, value: string[]): void {
        this._settings.set_strv(key, value);
    }

    reset(key: string): void {
        this._settings.reset(key);
    }

    onChange(key: string, callback: () => void): () => void {
        const id = this._settings.connect(`changed::${key}`, callback);
        return () => this._settings.disconnect(id);
    }
}
