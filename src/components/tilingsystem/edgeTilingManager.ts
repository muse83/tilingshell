import { buildRectangle } from '../../utils/ui';
import { GObject, Mtk } from '../../gi/ext';
import Settings from '../../settings/settings';
import { registerGObjectClass } from '../../utils/gjs';
import Layout from '../layout/Layout';
import GlobalState from '../../utils/globalState';
import {
    canActivateEdgeTiling,
    edgeTileAt,
    type EdgeZone,
} from './edgeTilingGeometry';

export default class EdgeTilingManager extends GObject.Object {
    static {
        registerGObjectClass(this, {
            GTypeName: 'EdgeTilingManager',
            Properties: {
                quarterActivationPercentage: GObject.ParamSpec.uint(
                    'quarterActivationPercentage',
                    'quarterActivationPercentage',
                    'Threshold to trigger quarter tiling',
                    GObject.ParamFlags.READWRITE,
                    1,
                    50,
                    40
                ),
                edgeTilingOffset: GObject.ParamSpec.uint(
                    'edgeTilingOffset',
                    'edgeTilingOffset',
                    'Offset to trigger edge tiling',
                    GObject.ParamFlags.READWRITE,
                    1,
                    250,
                    16
                ),
            },
        });
    }

    private _workArea: Mtk.Rectangle;
    private _quarterActivationPercentage: number;
    private _edgeTilingOffset: number;
    private _currentLayout: Layout | null;
    private _monitorIndex: number = 0;
    private _workspaceIndex: number = 0;

    // an edge tiling is in progress, and the zone it is currently in (if any)
    private _performing: boolean;
    private _activeZone: EdgeZone | null;

    constructor(initialWorkArea: Mtk.Rectangle) {
        super();
        this._workArea = buildRectangle();
        this._performing = false;
        this._activeZone = null;
        this._currentLayout = null;
        this.workarea = initialWorkArea;
        this._quarterActivationPercentage =
            Settings.behaviour.quarterTilingThreshold;
        Settings.bind(
            Settings.behaviour.keys.QUARTER_TILING_THRESHOLD,
            this,
            'quarterActivationPercentage'
        );
        this._edgeTilingOffset = Settings.behaviour.edgeTilingOffset;
        Settings.bind(
            Settings.behaviour.keys.EDGE_TILING_OFFSET,
            this,
            'edgeTilingOffset'
        );
    }

    private set quarterActivationPercentage(value: number) {
        this._quarterActivationPercentage = value;
    }

    private set edgeTilingOffset(value: number) {
        this._edgeTilingOffset = value;
    }

    public set workarea(newWorkArea: Mtk.Rectangle) {
        this._workArea.x = newWorkArea.x;
        this._workArea.y = newWorkArea.y;
        this._workArea.width = newWorkArea.width;
        this._workArea.height = newWorkArea.height;
    }

    public set monitorIndex(index: number) {
        this._monitorIndex = index;
    }

    public set workspaceIndex(index: number) {
        this._workspaceIndex = index;
        this._updateCurrentLayout();
    }

    private _updateCurrentLayout() {
        this._currentLayout = GlobalState.get().getSelectedLayoutOfMonitor(
            this._monitorIndex,
            this._workspaceIndex
        );
    }

    public canActivateEdgeTiling(pointerPos: {
        x: number;
        y: number;
    }): boolean {
        return canActivateEdgeTiling(
            pointerPos,
            this._workArea,
            this._edgeTilingOffset
        );
    }

    public isPerformingEdgeTiling(): boolean {
        return this._performing;
    }

    public startEdgeTiling(pointerPos: { x: number; y: number }): {
        changed: boolean;
        rect: Mtk.Rectangle;
    } {
        // a pointer in no zone still counts as edge tiling in progress
        this._performing = true;

        const result = edgeTileAt({
            pointer: pointerPos,
            workArea: this._workArea,
            quarterPercentage: this._quarterActivationPercentage,
            mode: Settings.behaviour.edgeTilingMode,
            tiles: this._currentLayout?.tiles ?? null,
            activeZone: this._activeZone,
        });
        if (result.zone) this._activeZone = result.zone;

        return {
            changed: result.changed,
            rect: result.changed
                ? buildRectangle(result.rect)
                : buildRectangle(),
        };
    }

    public needMaximize(): boolean {
        return (
            this._performing &&
            Settings.behaviour.topEdgeMaximize &&
            this._activeZone === 'topCenter'
        );
    }

    public abortEdgeTiling() {
        this._performing = false;
        this._activeZone = null;
    }
}
