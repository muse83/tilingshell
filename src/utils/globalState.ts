import { registerGObjectClass } from '../utils/gjs';
import Layout from '../components/layout/Layout';
import Settings from '../settings/settings';
import {
    SIGNAL_LAYOUTS_CHANGED,
    SIGNAL_SELECTED_CHANGED,
} from '../settings/layoutsSettings';
import SignalHandling from './signalHandling';
import { GObject, Meta, Gio } from '../gi/ext';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { logger } from './logger';
import { getWindows } from './ui';
import { isTiled } from '../components/tileState/tileState';

const debug = logger('GlobalState');

export default class GlobalState extends GObject.Object {
    static {
        registerGObjectClass(this, {
            GTypeName: 'GlobalState',
            Signals: {
                'layouts-changed': {
                    param_types: [],
                },
            },
            Properties: {
                tilePreviewAnimationTime: GObject.ParamSpec.uint(
                    'tilePreviewAnimationTime',
                    'tilePreviewAnimationTime',
                    'Animation time of tile previews in milliseconds',
                    GObject.ParamFlags.READWRITE,
                    0,
                    2000,
                    100
                ),
            },
        });
    }

    public static SIGNAL_LAYOUTS_CHANGED = 'layouts-changed';

    private static _instance: GlobalState | null;

    private _signals: SignalHandling;
    private _tilePreviewAnimationTime: number;
    // if workspaces are reordered, we use this map to know which layouts where selected
    // to each workspace and we save the new ordering in the settings
    private _selected_layouts: Map<Meta.Workspace, string[]>; // used to handle reordering of workspaces

    static get(): GlobalState {
        if (!this._instance) this._instance = new GlobalState();

        return this._instance;
    }

    static destroy() {
        if (this._instance) {
            this._instance._signals.disconnect();
            this._instance = null;
        }
    }

    constructor() {
        super();

        this._signals = new SignalHandling();
        this._tilePreviewAnimationTime = 100;
        this._selected_layouts = new Map();
        this.validate_selected_layouts();

        Settings.bind(
            Settings.KEY_TILE_PREVIEW_ANIMATION_TIME,
            this,
            'tilePreviewAnimationTime',
            Gio.SettingsBindFlags.GET
        );
        // the layouts group reloads; this only forwards its announcement
        this._signals.connect(Settings.layouts, SIGNAL_LAYOUTS_CHANGED, () =>
            this.emit(GlobalState.SIGNAL_LAYOUTS_CHANGED)
        );

        this._signals.connect(Settings.layouts, SIGNAL_SELECTED_CHANGED, () => {
            const selected_layouts = Settings.layouts.selected;
            if (selected_layouts.length === 0) {
                this.validate_selected_layouts();
                return;
            }

            const defaultLayout: Layout = this.layouts[0];
            const n_monitors = Main.layoutManager.monitors.length;
            const n_workspaces = global.workspaceManager.get_n_workspaces();
            for (let i = 0; i < n_workspaces; i++) {
                const ws = global.workspaceManager.get_workspace_by_index(i);
                if (!ws) continue;

                const monitors_layouts =
                    i < selected_layouts.length
                        ? selected_layouts[i]
                        : [defaultLayout.id];
                while (monitors_layouts.length < n_monitors)
                    monitors_layouts.push(defaultLayout.id);
                while (monitors_layouts.length > n_monitors)
                    monitors_layouts.pop();

                this._selected_layouts.set(ws, monitors_layouts);
            }
        });

        this._signals.connect(
            global.workspaceManager,
            'workspace-added',
            (_, index: number) => {
                const n_workspaces = global.workspaceManager.get_n_workspaces();
                const newWs =
                    global.workspaceManager.get_workspace_by_index(index);
                if (!newWs) return;

                debug(`added workspace ${index}`);

                const secondLastWs =
                    global.workspaceManager.get_workspace_by_index(
                        n_workspaces - 2
                    );

                // the new workspace must start with the same layout of the last workspace
                // use the layout at index 0 if for some reason we cannot find the layout
                // of the last workspace
                const secondLastWsLayoutsId = secondLastWs
                    ? (this._selected_layouts.get(secondLastWs) ?? [])
                    : [];
                if (secondLastWsLayoutsId.length === 0) {
                    secondLastWsLayoutsId.push(
                        ...Main.layoutManager.monitors.map(
                            () => this.layouts[0].id
                        )
                    );
                }

                this._selected_layouts.set(
                    newWs,
                    secondLastWsLayoutsId // Main.layoutManager.monitors.map(() => layout.id),
                );

                const to_be_saved: string[][] = [];
                for (let i = 0; i < n_workspaces; i++) {
                    const ws =
                        global.workspaceManager.get_workspace_by_index(i);
                    if (!ws) continue;
                    const monitors_layouts = this._selected_layouts.get(ws);
                    if (!monitors_layouts) continue;
                    to_be_saved.push(monitors_layouts);
                }

                Settings.layouts.setSelected(to_be_saved);
            }
        );

        this._signals.connect(
            global.workspaceManager,
            'workspace-removed',
            () => {
                const newMap: Map<Meta.Workspace, string[]> = new Map();
                const n_workspaces = global.workspaceManager.get_n_workspaces();
                const to_be_saved: string[][] = [];
                for (let i = 0; i < n_workspaces; i++) {
                    const ws =
                        global.workspaceManager.get_workspace_by_index(i);
                    if (!ws) continue;
                    const monitors_layouts = this._selected_layouts.get(ws);
                    if (!monitors_layouts) continue;

                    this._selected_layouts.delete(ws);
                    newMap.set(ws, monitors_layouts);
                    to_be_saved.push(monitors_layouts);
                }
                Settings.layouts.setSelected(to_be_saved);

                this._selected_layouts.clear();
                this._selected_layouts = newMap;
                debug('deleted workspace');
            }
        );

        this._signals.connect(
            global.workspaceManager,
            'workspaces-reordered',
            () => {
                this._save_selected_layouts();
                debug('reordered workspaces');
            }
        );
    }

    public validate_selected_layouts() {
        const n_monitors = Main.layoutManager.monitors.length;
        const old_selected_layouts = Settings.layouts.selected;
        for (let i = 0; i < global.workspaceManager.get_n_workspaces(); i++) {
            const ws = global.workspaceManager.get_workspace_by_index(i);
            if (!ws) continue;

            const monitors_layouts =
                i < old_selected_layouts.length ? old_selected_layouts[i] : [];
            while (monitors_layouts.length < n_monitors)
                monitors_layouts.push(this.layouts[0].id);
            while (monitors_layouts.length > n_monitors) monitors_layouts.pop();

            monitors_layouts.forEach((_, ind) => {
                if (
                    this.layouts.findIndex(
                        lay => lay.id === monitors_layouts[ind]
                    ) === -1
                )
                    monitors_layouts[ind] = monitors_layouts[0];
            });

            this._selected_layouts.set(ws, monitors_layouts);
        }

        this._save_selected_layouts();
    }

    private _save_selected_layouts() {
        const to_be_saved: string[][] = [];
        const n_workspaces = global.workspaceManager.get_n_workspaces();
        for (let i = 0; i < n_workspaces; i++) {
            const ws = global.workspaceManager.get_workspace_by_index(i);
            if (!ws) continue;
            const monitors_layouts = this._selected_layouts.get(ws);
            if (!monitors_layouts) continue;
            to_be_saved.push(monitors_layouts);
        }

        Settings.layouts.setSelected(to_be_saved);
    }

    get layouts(): Layout[] {
        return Settings.layouts.layouts;
    }

    public addLayout(newLay: Layout) {
        this.layouts = [...this.layouts, newLay];
    }

    public deleteLayout(layoutToDelete: Layout) {
        const layFoundIndex = this.layouts.findIndex(
            lay => lay.id === layoutToDelete.id
        );
        if (layFoundIndex === -1) return;

        this.layouts = this.layouts.filter(
            (_, index) => index !== layFoundIndex
        );

        this._selected_layouts.forEach(monitors_selected => {
            if (
                layoutToDelete.id ===
                monitors_selected[Main.layoutManager.primaryIndex]
            ) {
                monitors_selected[Main.layoutManager.primaryIndex] =
                    this.layouts[0].id;
                this._save_selected_layouts();
            }
        });
    }

    public editLayout(newLay: Layout) {
        const layFoundIndex = this.layouts.findIndex(
            lay => lay.id === newLay.id
        );
        if (layFoundIndex === -1) return;

        this.layouts = this.layouts.map((lay, index) =>
            index === layFoundIndex ? newLay : lay
        );
    }

    public swapLayouts(first: number, second: number) {
        const layouts = [...this.layouts];
        [layouts[first], layouts[second]] = [layouts[second], layouts[first]];
        this.layouts = layouts;
    }

    // saving makes the layouts group reload and announce, which we forward
    set layouts(layouts: Layout[]) {
        Settings.layouts.setLayouts(layouts);
    }

    public getSelectedLayoutOfMonitor(
        monitorIndex: number,
        workspaceIndex: number
    ): Layout {
        const selectedLayouts = Settings.layouts.selected;
        if (workspaceIndex < 0 || workspaceIndex >= selectedLayouts.length)
            workspaceIndex = 0;

        const monitors_selected =
            workspaceIndex < selectedLayouts.length
                ? selectedLayouts[workspaceIndex]
                : GlobalState.get().layouts[0].id;
        if (monitorIndex < 0 || monitorIndex >= monitors_selected.length)
            monitorIndex = 0;

        return (
            this.layouts.find(
                lay => lay.id === monitors_selected[monitorIndex]
            ) || this.layouts[0]
        );
    }

    public get tilePreviewAnimationTime(): number {
        return this._tilePreviewAnimationTime;
    }

    public set tilePreviewAnimationTime(value: number) {
        this._tilePreviewAnimationTime = value;
    }

    public setSelectedLayoutOfMonitor(
        layoutToSelectId: string,
        monitorIndex: number
    ) {
        // get the currently selected layouts
        const selected = Settings.layouts.selected;
        // select the layout for the given monitor
        selected[global.workspaceManager.get_active_workspace_index()][
            monitorIndex
        ] = layoutToSelectId;

        // if there are 2 or more workspaces, if the last workspace is empty
        // it must follow the layout of the second-last workspace
        // if we changed the second-last workspace we take care of changing
        // the last workspace as well, if there aren't tiled windows (is empty)
        const n_workspaces = global.workspaceManager.get_n_workspaces();
        if (
            global.workspaceManager.get_active_workspace_index() ===
            n_workspaces - 2
        ) {
            const lastWs = global.workspaceManager.get_workspace_by_index(
                n_workspaces - 1
            );
            if (!lastWs) return;

            // check if there are tiled windows on that monitor and in the last workspace
            const tiledWindows = getWindows(lastWs).find(
                win => isTiled(win) && win.get_monitor() === monitorIndex
            );
            if (!tiledWindows) {
                // the last workspace, on that monitor, is empty
                // select the same layout for last workspace as well
                selected[lastWs.index()][monitorIndex] = layoutToSelectId;
            }
        }

        Settings.layouts.setSelected(selected);
    }
}
