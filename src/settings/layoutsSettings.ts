// The layouts group of the settings module (ADR 0008): the list of layouts and the layout selected
// per workspace and monitor. It repairs broken data, and reloads and announces changes itself, so
// nobody else re-reads layouts on a signal.
// Free of any GNOME API at runtime (types only) so it can be tested with plain Node.
import type Layout from '../components/layout/Layout';
import type { SettingsStorage } from './storage';

export const KEY_LAYOUTS_JSON = 'layouts-json';
export const KEY_SELECTED_LAYOUTS = 'selected-layouts';
export const SIGNAL_LAYOUTS_CHANGED = 'layouts-changed';
export const SIGNAL_SELECTED_CHANGED = 'selected-changed';

type TileData = {
    x: number;
    y: number;
    width: number;
    height: number;
    groups: number[];
};

// plain data with the same JSON as Layout and Tile instances, so this module needs neither
function makeLayout(id: string, tiles: TileData[]): Layout {
    return { id, tiles } as Layout;
}

export function defaultLayouts(): Layout[] {
    return [
        makeLayout('Layout 1', [
            { x: 0, y: 0, height: 0.5, width: 0.22, groups: [1, 2] }, // top-left
            { x: 0, y: 0.5, height: 0.5, width: 0.22, groups: [1, 2] }, // bottom-left
            { x: 0.22, y: 0, height: 1, width: 0.56, groups: [2, 3] }, // center
            { x: 0.78, y: 0, height: 0.5, width: 0.22, groups: [3, 4] }, // top-right
            { x: 0.78, y: 0.5, height: 0.5, width: 0.22, groups: [3, 4] }, // bottom-right
        ]),
        makeLayout('Layout 2', [
            { x: 0, y: 0, height: 1, width: 0.22, groups: [1] },
            { x: 0.22, y: 0, height: 1, width: 0.56, groups: [1, 2] },
            { x: 0.78, y: 0, height: 1, width: 0.22, groups: [2] },
        ]),
        makeLayout('Layout 3', [
            { x: 0, y: 0, height: 1, width: 0.33, groups: [1] },
            { x: 0.33, y: 0, height: 1, width: 0.67, groups: [1] },
        ]),
        makeLayout('Layout 4', [
            { x: 0, y: 0, height: 1, width: 0.67, groups: [1] },
            { x: 0.67, y: 0, height: 1, width: 0.33, groups: [1] },
        ]),
    ];
}

export default class LayoutsSettings {
    private readonly _storage: SettingsStorage;
    private _layouts: Layout[];
    private _listeners = new Map<
        number,
        { signal: string; listener: () => void }
    >();

    private _nextId = 1;
    private _disconnects: (() => void)[];
    private _repairing = false;

    constructor(storage: SettingsStorage) {
        this._storage = storage;
        this._layouts = this._load();
        this._disconnects = [
            storage.onChange(KEY_LAYOUTS_JSON, () => {
                // our own repair writes the key as well; its result is already loaded
                if (this._repairing) return;
                this._layouts = this._load();
                this._emit(SIGNAL_LAYOUTS_CHANGED);
            }),
            storage.onChange(KEY_SELECTED_LAYOUTS, () =>
                this._emit(SIGNAL_SELECTED_CHANGED)
            ),
        ];
    }

    destroy() {
        this._disconnects.forEach(disconnect => disconnect());
        this._disconnects = [];
        this._listeners.clear();
    }

    // the current layouts; broken or empty stored data was already repaired
    get layouts(): Layout[] {
        return this._layouts;
    }

    // writes the layouts; listeners are told once the storage reports the change
    setLayouts(layouts: Layout[]) {
        this._storage.setString(KEY_LAYOUTS_JSON, JSON.stringify(layouts));
    }

    resetLayouts() {
        this.setLayouts(defaultLayouts());
    }

    // selected layout ids: one list per workspace, one id per monitor
    get selected(): string[][] {
        return this._storage.getStringLists(KEY_SELECTED_LAYOUTS);
    }

    setSelected(ids: string[][]) {
        if (ids.length === 0) this._storage.reset(KEY_SELECTED_LAYOUTS);
        else this._storage.setStringLists(KEY_SELECTED_LAYOUTS, ids);
    }

    // same shape as GObject signals, so SignalHandling can hold the connection
    connect(
        signal: typeof SIGNAL_LAYOUTS_CHANGED | typeof SIGNAL_SELECTED_CHANGED,
        listener: () => void
    ): number {
        const id = this._nextId++;
        this._listeners.set(id, { signal, listener });
        return id;
    }

    disconnect(id: number) {
        this._listeners.delete(id);
    }

    private _emit(signal: string) {
        [...this._listeners.values()]
            .filter(l => l.signal === signal)
            .forEach(l => l.listener());
    }

    private _load(): Layout[] {
        try {
            const layouts = JSON.parse(
                this._storage.getString(KEY_LAYOUTS_JSON) || '[]'
            ) as Layout[];
            if (layouts.length === 0)
                throw new Error('At least one layout is required');
            return layouts.filter(layout => layout.tiles.length > 0);
        } catch (_unused) {
            // broken or empty data: back to the default layouts
            const layouts = defaultLayouts();
            this._repairing = true;
            try {
                this._storage.setString(
                    KEY_LAYOUTS_JSON,
                    JSON.stringify(layouts)
                );
            } finally {
                this._repairing = false;
            }
            return layouts;
        }
    }
}
