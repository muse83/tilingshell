// Shared base of the simple settings groups (ADR 0008): holds the storage and offers
// `connect`/`disconnect` in the shape of GObject signals, so `SignalHandling` can hold a
// connection. The signal name is the storage key; the callback runs after that key changed.
// Free of any GNOME API so it can be tested with plain Node.
import type { SettingsStorage } from './storage.ts';

export default class SettingsGroup {
    protected readonly _storage: SettingsStorage;
    private _disconnects = new Map<number, () => void>();
    private _nextId = 1;

    constructor(storage: SettingsStorage) {
        this._storage = storage;
    }

    connect(key: string, listener: (..._args: unknown[]) => void): number {
        const id = this._nextId++;
        this._disconnects.set(
            id,
            this._storage.onChange(key, () => listener())
        );
        return id;
    }

    disconnect(id: number) {
        this._disconnects.get(id)?.();
        this._disconnects.delete(id);
    }

    destroy() {
        this._disconnects.forEach(disconnect => disconnect());
        this._disconnects.clear();
    }
}
