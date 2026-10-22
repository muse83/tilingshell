// Where settings values live. Production uses GNOME settings (gnomeStorage.ts), tests use the
// in-memory adapter below. Free of any GNOME API so it runs under plain Node (ADR 0008).
// Read and write only; `onChange` exists for the layouts group, the one group that is changed
// from two sides (preferences window and running extension).

export interface SettingsStorage {
    getString(key: string): string;
    setString(key: string, value: string): void;
    // list of string lists, e.g. the selected layouts per workspace and monitor
    getStringLists(key: string): string[][];
    setStringLists(key: string, value: string[][]): void;
    getBoolean(key: string): boolean;
    setBoolean(key: string, value: boolean): void;
    // whole numbers, signed or unsigned depending on the key
    getNumber(key: string): number;
    setNumber(key: string, value: number): void;
    // list of strings, e.g. a keybinding
    getStrv(key: string): string[];
    setStrv(key: string, value: string[]): void;
    reset(key: string): void;
    // calls back after the key changed, also when this process wrote it. Returns the disconnect.
    onChange(key: string, callback: () => void): () => void;
}

export class MemoryStorage implements SettingsStorage {
    private _strings = new Map<string, string>();
    private _lists = new Map<string, string[][]>();
    private _booleans = new Map<string, boolean>();
    private _numbers = new Map<string, number>();
    private _strvs = new Map<string, string[]>();
    private _callbacks = new Map<string, Set<() => void>>();

    getString(key: string): string {
        return this._strings.get(key) ?? '';
    }

    setString(key: string, value: string): void {
        if (this._strings.get(key) === value) return;
        this._strings.set(key, value);
        this._notify(key);
    }

    getStringLists(key: string): string[][] {
        // copies, so a caller cannot change the stored value by accident
        return (this._lists.get(key) ?? []).map(list => [...list]);
    }

    setStringLists(key: string, value: string[][]): void {
        // like GNOME settings, an unchanged value is no change
        if (
            JSON.stringify(this._lists.get(key) ?? []) === JSON.stringify(value)
        )
            return;
        this._lists.set(
            key,
            value.map(list => [...list])
        );
        this._notify(key);
    }

    getBoolean(key: string): boolean {
        return this._booleans.get(key) ?? false;
    }

    setBoolean(key: string, value: boolean): void {
        if (this.getBoolean(key) === value) return;
        this._booleans.set(key, value);
        this._notify(key);
    }

    getNumber(key: string): number {
        return this._numbers.get(key) ?? 0;
    }

    setNumber(key: string, value: number): void {
        if (this.getNumber(key) === value) return;
        this._numbers.set(key, value);
        this._notify(key);
    }

    getStrv(key: string): string[] {
        return [...(this._strvs.get(key) ?? [])];
    }

    setStrv(key: string, value: string[]): void {
        if (
            JSON.stringify(this._strvs.get(key) ?? []) === JSON.stringify(value)
        )
            return;
        this._strvs.set(key, [...value]);
        this._notify(key);
    }

    reset(key: string): void {
        const removed = [
            this._strings.delete(key),
            this._lists.delete(key),
            this._booleans.delete(key),
            this._numbers.delete(key),
            this._strvs.delete(key),
        ];
        if (!removed.some(Boolean)) return;
        this._notify(key);
    }

    onChange(key: string, callback: () => void): () => void {
        let set = this._callbacks.get(key);
        if (!set) this._callbacks.set(key, (set = new Set()));
        set.add(callback);
        return () => set.delete(callback);
    }

    private _notify(key: string) {
        [...(this._callbacks.get(key) ?? [])].forEach(callback => callback());
    }
}
