import { Clutter, Mtk, Meta, GLib } from '../../gi/ext';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { logger } from '../../utils/logger';
import {
    buildMargin,
    buildRectangle,
    buildTileGaps,
    getScalingFactorOf,
    getWindows,
    isPointInsideRect,
    isTileOnContainerBorder,
    squaredEuclideanDistance,
} from '../../utils/ui';
import TilingLayout from '../../components/tilingsystem/tilingLayout';
import SnapAssist from '../snapassist/snapAssist';
import SelectionTilePreview from '../tilepreview/selectionTilePreview';
import { ActivationKey, EdgeTilingMode } from '../../settings/settings';
import Settings from '../../settings/settings';
import { SIGNAL_SELECTED_CHANGED } from '../../settings/layoutsSettings';
import SignalHandling from '../../utils/signalHandling';
import Layout from '../layout/Layout';
import Tile from '../layout/Tile';
import TileUtils from '../layout/TileUtils';
import GlobalState from '../../utils/globalState';
import { Monitor } from 'resource:///org/gnome/shell/ui/layout.js';
import {
    assignTile,
    bestVacantTile,
    forgetTile,
    isInTile,
    isTiled,
    maximizeAsTile,
    releaseFromTile,
    releaseOnDrag,
    rememberSizeBeforeTile,
    setSizeBeforeTile,
    tileOf,
    tileWindow,
} from '../tileState/tileState';
import { vacantTilesOf } from '../tileState/vacantTiles';
import EdgeTilingManager from './edgeTilingManager';
import { decideDrag, decideDrop, type DragState } from './dropDecision';
import TouchPointer from './touchPointer';
import { KeyBindingsDirection } from '../../keybindings';
import TilingShellWindowManager from '../../components/windowManager/tilingShellWindowManager';
import TilingLayoutWithSuggestions from '../windowsSuggestions/tilingLayoutWithSuggestions';
import { maximizeWindow, unmaximizeWindow } from '../../utils/gnomesupport';
import { liveActor } from '../windowLifetime/windowLifetime';
import { isNormalTopLevel } from '../windowPlacement/windowFacts';
import { displayScale } from '../displayScale/gnomeDisplayScale';

// the fixed layout window suggestions use after edge tiling in default mode
const quartersLayout = () =>
    new Layout(
        [
            [0, 0],
            [0.5, 0],
            [0, 0.5],
            [0.5, 0.5],
        ].map(
            ([x, y]) => new Tile({ x, y, height: 0.5, width: 0.5, groups: [] })
        ),
        'quarters'
    );

class SnapAssistingInfo {
    private _snapAssistantLayoutId: string | undefined;

    constructor() {
        this._snapAssistantLayoutId = undefined;
    }

    public get layoutId(): string {
        return this._snapAssistantLayoutId ?? '';
    }

    public get isSnapAssisting(): boolean {
        return this._snapAssistantLayoutId !== undefined;
    }

    public update(layoutId: string | undefined) {
        this._snapAssistantLayoutId =
            !layoutId || layoutId.length === 0 ? undefined : layoutId;
    }
}

export class TilingManager {
    private readonly _monitor: Monitor;

    private _selectedTilesPreview: SelectionTilePreview;
    private _snapAssist: SnapAssist;
    private _workspaceTilingLayout: Map<Meta.Workspace, TilingLayout>;
    private _edgeTilingManager: EdgeTilingManager;
    private _tilingSuggestionsLayout: TilingLayoutWithSuggestions;

    private _workArea: Mtk.Rectangle;

    private _isGrabbingWindow: boolean;
    private _movingWindowTimerDuration: number = 15;
    private _grabStartPosition: { x: number; y: number } | null = null;
    private _dragState: DragState = {
        tilingSystemKeyHeld: false,
        spanKeyHeld: false,
        pointer: null,
    };

    private _snapAssistingInfo: SnapAssistingInfo;

    private _movingWindowTimerId: number | null = null;

    private readonly _signals: SignalHandling;
    private readonly _debug: (..._content: unknown[]) => void;

    /**
     * Constructs a new TilingManager instance.
     * @param monitor The monitor to manage tiling for.
     */
    constructor(monitor: Monitor) {
        this._isGrabbingWindow = false;
        this._snapAssistingInfo = new SnapAssistingInfo();
        this._monitor = monitor;
        this._signals = new SignalHandling();

        this._debug = logger(`TilingManager ${monitor.index}`);

        // get the monitor's workarea
        this._workArea = Main.layoutManager.getWorkAreaForMonitor(
            this._monitor.index
        );
        this._debug(
            `Work area for monitor ${this._monitor.index}: ${this._workArea.x} ${this._workArea.y} ${this._workArea.width}x${this._workArea.height}`
        );
        this._edgeTilingManager = new EdgeTilingManager(this._workArea);
        this._edgeTilingManager.monitorIndex = this._monitor.index;

        // handle scale factor of the monitor
        const monitorScalingFactor = displayScale().styleScaleOf(monitor.index);

        // build a tiling layout for each workspace
        this._workspaceTilingLayout = new Map();
        for (let i = 0; i < global.workspaceManager.get_n_workspaces(); i++) {
            const ws = global.workspaceManager.get_workspace_by_index(i);
            if (!ws) continue;

            const innerGaps = buildMargin(Settings.get_inner_gaps());
            const outerGaps = buildMargin(Settings.get_outer_gaps());
            const layout = GlobalState.get().getSelectedLayoutOfMonitor(
                monitor.index,
                ws.index()
            );
            this._workspaceTilingLayout.set(
                ws,
                new TilingLayout(
                    layout,
                    innerGaps,
                    outerGaps,
                    this._workArea,
                    monitorScalingFactor
                )
            );
        }

        this._tilingSuggestionsLayout = new TilingLayoutWithSuggestions(
            buildMargin(Settings.get_inner_gaps()),
            buildMargin(Settings.get_outer_gaps()),
            this._workArea,
            monitorScalingFactor
        );

        // build the selection tile
        this._selectedTilesPreview = new SelectionTilePreview({
            parent: global.windowGroup,
        });

        // build the snap assistant
        this._snapAssist = new SnapAssist(
            Main.uiGroup,
            this._workArea,
            this._monitor.index,
            monitorScalingFactor
        );
    }

    /**
     * Enables tiling manager by setting up event listeners:
     *  - handle any window's grab begin.
     *  - handle any window's grab end.
     *  - handle grabbed window's movement.
     */
    public enable() {
        this._signals.connect(Settings.layouts, SIGNAL_SELECTED_CHANGED, () => {
            const ws = global.workspaceManager.get_active_workspace();
            if (!ws) return;

            const layout = GlobalState.get().getSelectedLayoutOfMonitor(
                this._monitor.index,
                ws.index()
            );
            this._workspaceTilingLayout.get(ws)?.relayout({ layout });
        });
        this._signals.connect(
            GlobalState.get(),
            GlobalState.SIGNAL_LAYOUTS_CHANGED,
            () => {
                const ws = global.workspaceManager.get_active_workspace();
                if (!ws) return;

                const layout = GlobalState.get().getSelectedLayoutOfMonitor(
                    this._monitor.index,
                    ws.index()
                );
                this._workspaceTilingLayout.get(ws)?.relayout({ layout });
            }
        );

        this._signals.connect(Settings, Settings.KEY_INNER_GAPS, () => {
            const innerGaps = buildMargin(Settings.get_inner_gaps());
            this._workspaceTilingLayout.forEach(tilingLayout =>
                tilingLayout.relayout({ innerGaps })
            );
        });
        this._signals.connect(Settings, Settings.KEY_OUTER_GAPS, () => {
            const outerGaps = buildMargin(Settings.get_outer_gaps());
            this._workspaceTilingLayout.forEach(tilingLayout =>
                tilingLayout.relayout({ outerGaps })
            );
        });

        this._signals.connect(
            global.display,
            'grab-op-begin',
            (
                _display: Meta.Display,
                window: Meta.Window,
                grabOp: Meta.GrabOp
            ) => {
                const moving = (grabOp & ~1024) === 1;
                if (!moving) return;

                this._onWindowGrabBegin(window);
            }
        );

        this._signals.connect(
            global.display,
            'grab-op-end',
            (_display: Meta.Display, window: Meta.Window) => {
                if (!this._isGrabbingWindow) return;

                this._onWindowGrabEnd(window);
            }
        );

        this._signals.connect(
            this._snapAssist,
            'snap-assist',
            this._onSnapAssist.bind(this)
        );

        this._signals.connect(
            global.workspaceManager,
            'active-workspace-changed',
            () => {
                const ws = global.workspaceManager.get_active_workspace();
                if (this._workspaceTilingLayout.has(ws)) return;

                const monitorScalingFactor = displayScale().styleScaleOf(
                    this._monitor.index
                );
                const layout: Layout =
                    GlobalState.get().getSelectedLayoutOfMonitor(
                        this._monitor.index,
                        ws.index()
                    );
                const innerGaps = buildMargin(Settings.get_inner_gaps());
                const outerGaps = buildMargin(Settings.get_outer_gaps());

                this._debug('created new tiling layout for active workspace');
                this._workspaceTilingLayout.set(
                    ws,
                    new TilingLayout(
                        layout,
                        innerGaps,
                        outerGaps,
                        this._workArea,
                        monitorScalingFactor
                    )
                );
            }
        );

        this._signals.connect(
            global.workspaceManager,
            'workspace-removed',
            _ => {
                const newMap: Map<Meta.Workspace, TilingLayout> = new Map();
                const n_workspaces = global.workspaceManager.get_n_workspaces();
                for (let i = 0; i < n_workspaces; i++) {
                    const ws =
                        global.workspaceManager.get_workspace_by_index(i);
                    if (!ws) continue;
                    const tl = this._workspaceTilingLayout.get(ws);
                    if (!tl) continue;

                    this._workspaceTilingLayout.delete(ws);
                    newMap.set(ws, tl);
                }

                [...this._workspaceTilingLayout.values()].forEach(tl =>
                    tl.destroy()
                );
                this._workspaceTilingLayout.clear();
                this._workspaceTilingLayout = newMap;
                this._debug('deleted workspace');
            }
        );

        this._signals.connect(
            TilingShellWindowManager.get(),
            'unmaximized',
            (_, window: Meta.Window) => {
                // a window that got its tile back from before the maximise stays there
                if (Settings.ENABLE_AUTO_TILING && !isTiled(window))
                    this.autoTile(window);
            }
        );
    }

    public onUntileWindow(window: Meta.Window, force: boolean): void {
        const destination = releaseFromTile(window);
        if (!destination) return;

        this._easeWindowRect(window, destination, false, force);
    }

    public onKeyboardMoveWindow(
        window: Meta.Window,
        direction: KeyBindingsDirection,
        force: boolean,
        spanFlag: boolean,
        clamp: boolean
    ): boolean {
        let destination: { rect: Mtk.Rectangle; tile: Tile } | undefined;
        const isMaximized =
            window.maximizedHorizontally || window.maximizedVertically;
        if (spanFlag && isMaximized) return false;

        const currentWs = window.get_workspace();
        const tilingLayout = this._workspaceTilingLayout.get(currentWs);
        if (!tilingLayout) return false;
        const windowRectCopy = window.get_frame_rect().copy();

        if (isMaximized) {
            switch (direction) {
                case KeyBindingsDirection.NODIRECTION:
                case KeyBindingsDirection.LEFT:
                case KeyBindingsDirection.RIGHT:
                    break;
                case KeyBindingsDirection.DOWN:
                    unmaximizeWindow(window);
                    return true;
                case KeyBindingsDirection.UP:
                    return false;
            }
        }

        // maximize the window using keybindings
        if (
            direction === KeyBindingsDirection.UP &&
            tileOf(window)?.y === 0 &&
            window.can_maximize()
        ) {
            maximizeAsTile(window);
            maximizeWindow(window);
            return true;
        }

        // find the nearest tile
        // direction is NODIRECTION -> move to the center of the screen
        if (direction === KeyBindingsDirection.NODIRECTION) {
            const rect = buildRectangle({
                x:
                    this._workArea.x +
                    this._workArea.width / 2 -
                    windowRectCopy.width / 2,
                y:
                    this._workArea.y +
                    this._workArea.height / 2 -
                    windowRectCopy.height / 2,
                width: windowRectCopy.width,
                height: windowRectCopy.height,
            });
            destination = {
                rect,
                tile: TileUtils.build_tile(rect, this._workArea),
            };
        } else if (window.get_monitor() === this._monitor.index) {
            const enlargeFactor = Math.max(
                64, // if the gaps are all 0 we choose 64 instead
                tilingLayout.innerGaps.right,
                tilingLayout.innerGaps.left,
                tilingLayout.innerGaps.right,
                tilingLayout.innerGaps.bottom
            );
            destination = tilingLayout.findNearestTileDirection(
                windowRectCopy,
                direction,
                clamp,
                enlargeFactor
            );
        } else {
            destination = tilingLayout.findNearestTile(windowRectCopy);
        }

        // if the window is already on the desired tile
        if (
            window.get_monitor() === this._monitor.index &&
            destination &&
            !window.maximizedHorizontally &&
            !window.maximizedVertically &&
            isInTile(window, destination.tile)
        )
            return true;

        // there isn't a tile near the window
        if (!destination) {
            if (spanFlag) return false;

            // handle maximize of window
            if (
                direction === KeyBindingsDirection.UP &&
                window.can_maximize()
            ) {
                maximizeAsTile(window);
                maximizeWindow(window);
                return true;
            }
            return false;
        }

        rememberSizeBeforeTile(window, windowRectCopy, {
            maximized: isMaximized,
        });

        if (spanFlag) {
            destination.rect = destination.rect.union(windowRectCopy);
            destination.tile = TileUtils.build_tile(
                destination.rect,
                this._workArea
            );
        }

        if (isMaximized) unmaximizeWindow(window);

        this._easeWindowRect(window, destination.rect, false, force);

        if (direction !== KeyBindingsDirection.NODIRECTION) {
            assignTile(window, destination.tile);
        }
        return true;
    }

    /**
     * Destroys the tiling manager and cleans up resources.
     */
    public destroy() {
        if (this._movingWindowTimerId) {
            GLib.Source.remove(this._movingWindowTimerId);
            this._movingWindowTimerId = null;
        }
        this._signals.disconnect();
        this._isGrabbingWindow = false;
        this._snapAssistingInfo.update(undefined);
        this._edgeTilingManager.abortEdgeTiling();
        this._workspaceTilingLayout.forEach(tl => tl.destroy());
        this._workspaceTilingLayout.clear();
        this._snapAssist.destroy();
        this._selectedTilesPreview.destroy();
        this._tilingSuggestionsLayout.destroy();
    }

    public set workArea(newWorkArea: Mtk.Rectangle) {
        if (newWorkArea.equal(this._workArea)) return;

        this._workArea = newWorkArea;
        this._debug(
            `new work area for monitor ${this._monitor.index}: ${newWorkArea.x} ${newWorkArea.y} ${newWorkArea.width}x${newWorkArea.height}`
        );

        // notify the tiling layout that the workarea changed and trigger a new relayout
        // so we will have the layout already computed to be shown quickly when needed
        this._workspaceTilingLayout.forEach(tl =>
            tl.relayout({ containerRect: this._workArea })
        );
        this._snapAssist.workArea = this._workArea;
        this._edgeTilingManager.workarea = this._workArea;
    }

    private _onWindowGrabBegin(window: Meta.Window) {
        if (this._isGrabbingWindow) return;

        TouchPointer.get().updateWindowPosition(window.get_frame_rect());
        this._signals.connect(
            global.stage,
            'touch-event',
            (_source, event: Clutter.Event) => {
                const [x, y] = event.get_coords();
                TouchPointer.get().onTouchEvent(x, y);
            }
        );
        // Add Wacom tablet support, listen to tablet events
        this._signals.connect(
            global.stage,
            'captured-event',
            (_source, event: Clutter.Event) => {
                const device = event.get_source_device();
                if (!device) return;

                const deviceType = device.get_device_type();

                // Check for tablet device types
                if (
                    deviceType === Clutter.InputDeviceType.TABLET_DEVICE ||
                    deviceType === Clutter.InputDeviceType.PEN_DEVICE
                ) {
                    const eventType = event.type();
                    // Capture motion events from tablet
                    if (eventType === Clutter.EventType.MOTION) {
                        const [x, y] = event.get_coords();
                        TouchPointer.get().onTouchEvent(x, y);
                        // Move the actual mouse cursor to match tablet position
                        const seat =
                            Clutter.get_default_backend().get_default_seat();
                        seat.warp_pointer(x, y);
                    }
                }
            }
        );

        // workaround for gnome-shell bug https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/2857
        if (
            Settings.ENABLE_BLUR_SNAP_ASSISTANT ||
            Settings.ENABLE_BLUR_SELECTED_TILEPREVIEW
        ) {
            this._signals.connect(window, 'position-changed', () => {
                if (Settings.ENABLE_BLUR_SELECTED_TILEPREVIEW) {
                    this._selectedTilesPreview
                        .get_effect('blur')
                        ?.queue_repaint();
                }
                if (Settings.ENABLE_BLUR_SNAP_ASSISTANT) {
                    this._snapAssist
                        .get_first_child()
                        ?.get_effect('blur')
                        ?.queue_repaint();
                }
            });
        }

        this._isGrabbingWindow = true;
        this._movingWindowTimerId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT_IDLE,
            this._movingWindowTimerDuration,
            this._onMovingWindow.bind(this, window)
        );

        this._onMovingWindow(window);
    }

    private _activationKeyStatus(
        modifier: number,
        key: ActivationKey
    ): boolean {
        if (key === ActivationKey.NONE) return true;

        let mask = Clutter.ModifierType.CONTROL_MASK;
        switch (key) {
            case ActivationKey.CTRL:
                mask = Clutter.ModifierType.CONTROL_MASK;
                break;
            case ActivationKey.ALT:
                mask = Clutter.ModifierType.MOD1_MASK;
                break;
            case ActivationKey.SUPER:
                mask = Clutter.ModifierType.SUPER_MASK;
                break;
        }
        return (modifier & mask) === mask;
    }

    private _onMovingWindow(window: Meta.Window) {
        // if the window is no longer grabbed, disable handler
        if (!this._isGrabbingWindow) {
            this._movingWindowTimerId = null;
            return GLib.SOURCE_REMOVE;
        }

        const currentWs = window.get_workspace();
        const tilingLayout = this._workspaceTilingLayout.get(currentWs);
        if (!tilingLayout) return GLib.SOURCE_REMOVE;

        this._edgeTilingManager.workspaceIndex = currentWs.index();

        const [x, y, modifier] = TouchPointer.get().isTouchDeviceActive()
            ? TouchPointer.get().get_pointer(window)
            : global.get_pointer();
        const currPointerPos = { x, y };

        const deactivationKey = Settings.TILING_SYSTEM_DEACTIVATION_KEY;
        const { decision, state } = decideDrag({
            previous: this._dragState,
            pointer: currPointerPos,
            windowMovable: window.allows_resize() && window.allows_move(),
            pointerOnThisMonitor: this._isPointerInsideThisMonitor(window),
            tilingSystemKeyHeld: this._activationKeyStatus(
                modifier,
                Settings.TILING_SYSTEM_ACTIVATION_KEY
            ),
            tilingSystemDeactivationKeyHeld:
                deactivationKey !== ActivationKey.NONE &&
                this._activationKeyStatus(modifier, deactivationKey),
            spanKeyHeld: this._activationKeyStatus(
                modifier,
                Settings.SPAN_MULTIPLE_TILES_ACTIVATION_KEY
            ),
            tilingSystemEnabled: Settings.TILING_SYSTEM,
            spanMultipleTilesEnabled: Settings.SPAN_MULTIPLE_TILES,
            activeScreenEdgesEnabled: Settings.ACTIVE_SCREEN_EDGES,
            snapAssistEnabled: Settings.SNAP_ASSIST,
            snapAssisting: this._snapAssistingInfo.isSnapAssisting,
            pointerNearEdge:
                this._edgeTilingManager.canActivateEdgeTiling(currPointerPos),
        });

        // if the window was moved into another monitor and it is still grabbed
        if (decision.kind === 'closeAll') {
            tilingLayout.close();
            this._selectedTilesPreview.close(true);
            this._snapAssist.close(true);
            this._snapAssistingInfo.update(undefined);
            this._edgeTilingManager.abortEdgeTiling();

            return GLib.SOURCE_CONTINUE;
        }

        if (this._grabStartPosition === null)
            this._grabStartPosition = { x, y };

        // the window leaves its tile. If it was tiled and this is the first time it is
        // moved far enough, change window's size to the size it had before it were tiled
        const sizeBeforeTile = releaseOnDrag(
            window,
            squaredEuclideanDistance(currPointerPos, this._grabStartPosition)
        );
        if (sizeBeforeTile) {
            if (Settings.RESTORE_WINDOW_ORIGINAL_SIZE) {
                const windowRect = window.get_frame_rect();
                const offsetX = (x - windowRect.x) / windowRect.width;
                const offsetY = (y - windowRect.y) / windowRect.height;

                const newSize = buildRectangle({
                    x: x - sizeBeforeTile.width * offsetX,
                    y: y - sizeBeforeTile.height * offsetY,
                    width: sizeBeforeTile.width,
                    height: sizeBeforeTile.height,
                });

                this._easeWindowRect(window, newSize);
                TouchPointer.get().updateWindowPosition(newSize);
            }
            this._grabStartPosition = null;
        }

        if (decision.kind === 'unchanged') return GLib.SOURCE_CONTINUE;
        this._dragState = state;

        // the layout is not shown (disabled, key not pressed or deactivation key held):
        // close it, then show the edge preview, the snap assistant or nothing
        if (decision.kind !== 'showLayout') {
            if (tilingLayout.showing) {
                tilingLayout.close();
                this._selectedTilesPreview.close(true);
            }

            if (decision.kind === 'showEdgePreview') {
                const { changed, rect } =
                    this._edgeTilingManager.startEdgeTiling(currPointerPos);
                if (changed)
                    this._showEdgeTiling(window, rect, x, y, tilingLayout);
                this._snapAssist.close(true);
            } else {
                if (this._edgeTilingManager.isPerformingEdgeTiling()) {
                    this._selectedTilesPreview.close(true);
                    this._edgeTilingManager.abortEdgeTiling();
                }

                if (decision.kind === 'showSnapAssistant') {
                    this._snapAssist.onMovingWindow(
                        window,
                        currPointerPos,
                        true
                    );
                }
            }

            return GLib.SOURCE_CONTINUE;
        }

        const { allowSpanMultipleTiles, changedSpanMultipleTiles } = decision;

        // we know that the layout must be shown, snap assistant must be closed
        if (!tilingLayout.showing) {
            // this._debug("open layout below grabbed window");
            tilingLayout.openAbove(window);
            this._snapAssist.close(true);
            // close selection tile if we were performing edge-tiling
            if (this._edgeTilingManager.isPerformingEdgeTiling()) {
                this._selectedTilesPreview.close(true);
                this._edgeTilingManager.abortEdgeTiling();
            }
        }
        // if it was snap assisting then close the selection tile preview. We may reopen it if that's the case
        if (this._snapAssistingInfo.isSnapAssisting) {
            this._selectedTilesPreview.close(true);
            this._snapAssistingInfo.update(undefined);
        }

        // if the pointer is inside the current selection and ALT key status is not changed, then there is nothing to do
        if (
            !changedSpanMultipleTiles &&
            isPointInsideRect(currPointerPos, this._selectedTilesPreview.rect)
        )
            return GLib.SOURCE_CONTINUE;

        let selectionRect = tilingLayout.getTileBelow(
            currPointerPos,
            changedSpanMultipleTiles && !allowSpanMultipleTiles
        );
        if (!selectionRect) return GLib.SOURCE_CONTINUE;

        selectionRect = selectionRect.copy();
        if (allowSpanMultipleTiles && this._selectedTilesPreview.showing) {
            selectionRect = selectionRect.union(
                this._selectedTilesPreview.rect
            );
        }
        tilingLayout.hoverTilesInRect(selectionRect, !allowSpanMultipleTiles);

        this.openSelectionTilePreview(selectionRect, true, true, window);

        return GLib.SOURCE_CONTINUE;
    }

    private _onWindowGrabEnd(window: Meta.Window) {
        this._isGrabbingWindow = false;
        this._grabStartPosition = null;

        this._signals.disconnect(window);
        TouchPointer.get().reset();

        const currentWs = window.get_workspace();
        const tilingLayout = this._workspaceTilingLayout.get(currentWs);
        if (tilingLayout) tilingLayout.close();
        const desiredWindowRect = buildRectangle({
            x: this._selectedTilesPreview.innerX,
            y: this._selectedTilesPreview.innerY,
            width: this._selectedTilesPreview.innerWidth,
            height: this._selectedTilesPreview.innerHeight,
        });
        const selectedTilesRect = this._selectedTilesPreview.rect.copy();
        this._selectedTilesPreview.close(true);
        this._snapAssist.close(true);
        this._dragState = { ...this._dragState, pointer: null };

        const wasSnapAssistingLayout = this._snapAssistingInfo.isSnapAssisting
            ? GlobalState.get().layouts.find(
                  lay => lay.id === this._snapAssistingInfo.layoutId
              )
            : undefined;
        const wasEdgeTiling = this._edgeTilingManager.isPerformingEdgeTiling();

        const decision = decideDrop({
            tilingSystemKeyHeld: this._activationKeyStatus(
                global.get_pointer()[2],
                Settings.TILING_SYSTEM_ACTIVATION_KEY
            ),
            snapAssisting: this._snapAssistingInfo.isSnapAssisting,
            snapAssistLayoutId: wasSnapAssistingLayout?.id,
            edgeTilingInProgress: wasEdgeTiling,
            edgeNeedsMaximize: this._edgeTilingManager.needMaximize(),
            windowCanMaximize: window.can_maximize(),
            edgeModeIsDefault:
                Settings.EDGE_TILING_MODE === EdgeTilingMode.DEFAULT,
            suggestionsForSnapAssistant:
                Settings.ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS,
            suggestionsForEdgeTiling:
                Settings.ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS,
            suggestionsForTilingSystem:
                Settings.ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS,
            syncLayoutWithSnapAssistant: Settings.SNAP_ASSIST_SYNC_LAYOUT,
            // abort if the pointer is moving on another monitor: the user moved
            // the window to another monitor not handled by this tiling manager
            pointerOnThisMonitor: this._isPointerInsideThisMonitor(window),
            selectionValid:
                desiredWindowRect.width > 0 && desiredWindowRect.height > 0,
            windowMaximized:
                window.maximizedHorizontally || window.maximizedVertically,
            hasTilingLayout: !!tilingLayout,
        });

        // disable snap assistance and edge-tiling
        this._snapAssistingInfo.update(undefined);
        this._edgeTilingManager.abortEdgeTiling();

        if (decision.kind === 'nothing') return;

        // the maximise is reported later and gives the window its whole-screen tile; do not
        // give it another tile or move it meanwhile
        if (decision.kind === 'maximiseByEdge') {
            maximizeAsTile(window);
            maximizeWindow(window);
            return;
        }

        setSizeBeforeTile(window, window.get_frame_rect().copy());
        assignTile(
            window,
            TileUtils.build_tile(selectedTilesRect, this._workArea)
        );
        this._easeWindowRect(window, desiredWindowRect);

        // Sync the desktop layout to match the snap-assisted layout if enabled
        if (decision.syncMonitorLayout && wasSnapAssistingLayout) {
            GlobalState.get().setSelectedLayoutOfMonitor(
                wasSnapAssistingLayout.id,
                this._monitor.index
            );
        }

        if (!tilingLayout || !decision.suggestions) return;

        const layout =
            decision.suggestions === 'quarters'
                ? quartersLayout()
                : decision.suggestions === 'snapAssistLayout' &&
                    wasSnapAssistingLayout
                  ? wasSnapAssistingLayout
                  : GlobalState.get().getSelectedLayoutOfMonitor(
                        this._monitor.index,
                        window.get_workspace().index()
                    );
        this._openWindowsSuggestions(
            window,
            desiredWindowRect,
            window.get_monitor(),
            layout,
            tilingLayout.innerGaps,
            tilingLayout.outerGaps,
            tilingLayout.scalingFactor
        );
    }

    private _openWindowsSuggestions(
        window: Meta.Window,
        windowDesiredRect: Mtk.Rectangle,
        monitorIndex: number,
        layout: Layout,
        innerGaps: Clutter.Margin,
        outerGaps: Clutter.Margin,
        scalingFactor: number
    ): void {
        const tiledWindows: Meta.Window[] = [];
        const nontiledWindows: Meta.Window[] = [];
        getWindows().forEach(extWin => {
            if (extWin && !extWin.minimized && isTiled(extWin))
                tiledWindows.push(extWin);
            else nontiledWindows.push(extWin);
        });

        if (nontiledWindows.length === 0) return;

        this._tilingSuggestionsLayout.destroy();
        this._tilingSuggestionsLayout = new TilingLayoutWithSuggestions(
            innerGaps,
            outerGaps,
            this._workArea,
            scalingFactor
        );
        this._tilingSuggestionsLayout.relayout({ layout });
        /* this._tilingSuggestionsLayout.relayout({
            containerRect: this._workArea,
            innerGaps,
            outerGaps,
            layout,
        });*/
        this._tilingSuggestionsLayout.open(
            tiledWindows,
            nontiledWindows,
            window,
            windowDesiredRect,
            monitorIndex
        );
    }

    private _easeWindowRect(
        window: Meta.Window,
        destRect: Mtk.Rectangle,
        user_op: boolean = false,
        force: boolean = false
    ) {
        const windowActor = liveActor<Clutter.Actor>(window);
        if (!windowActor) return;

        const beforeRect = window.get_frame_rect();
        // do not animate the window if it will not move or scale
        if (
            destRect.x === beforeRect.x &&
            destRect.y === beforeRect.y &&
            destRect.width === beforeRect.width &&
            destRect.height === beforeRect.height
        )
            return;

        // apply animations when tiling the window
        windowActor.remove_all_transitions();
        // @ts-expect-error "Main.wm has the "private" function _prepareAnimationInfo"
        Main.wm._prepareAnimationInfo(
            global.windowManager,
            windowActor,
            beforeRect.copy(),
            Meta.SizeChange.UNMAXIMIZE
        );

        // move and resize the window to the current selection
        window.move_to_monitor(this._monitor.index);
        if (force) window.move_frame(user_op, destRect.x, destRect.y);
        window.move_resize_frame(
            user_op,
            destRect.x,
            destRect.y,
            destRect.width,
            destRect.height
        );
    }

    private _onSnapAssist(_: SnapAssist, tile: Tile, layoutId: string) {
        // if there isn't a tile hovered, then close selection
        if (tile.width === 0 || tile.height === 0) {
            this._selectedTilesPreview.close(true);
            this._snapAssistingInfo.update(undefined);
            return;
        }

        // We apply the proportions to get tile size and position relative to the work area
        const scaledRect = TileUtils.apply_props(tile, this._workArea);
        // ensure the rect doesn't go horizontally beyond the workarea
        if (
            scaledRect.x + scaledRect.width >
            this._workArea.x + this._workArea.width
        ) {
            scaledRect.width -=
                scaledRect.x +
                scaledRect.width -
                this._workArea.x -
                this._workArea.width;
        }
        // ensure the rect doesn't go vertically beyond the workarea
        if (
            scaledRect.y + scaledRect.height >
            this._workArea.y + this._workArea.height
        ) {
            scaledRect.height -=
                scaledRect.y +
                scaledRect.height -
                this._workArea.y -
                this._workArea.height;
        }

        const currentWs = global.workspaceManager.get_active_workspace();
        const tilingLayout = this._workspaceTilingLayout.get(currentWs);
        if (!tilingLayout) return;

        this._selectedTilesPreview
            .get_parent()
            ?.set_child_above_sibling(this._selectedTilesPreview, null);

        this.openSelectionTilePreview(scaledRect, false, true, undefined);
        this._snapAssistingInfo.update(layoutId);
    }

    private openSelectionTilePreview(
        position: Mtk.Rectangle,
        isAboveLayout: boolean,
        ease: boolean,
        window?: Meta.Window
    ) {
        const currentWs = global.workspaceManager.get_active_workspace();
        const tilingLayout = this._workspaceTilingLayout.get(currentWs);
        if (!tilingLayout) return;

        this._selectedTilesPreview.gaps = buildTileGaps(
            position,
            tilingLayout.innerGaps,
            tilingLayout.outerGaps,
            this._workArea,
            displayScale().isPhysical
                ? getScalingFactorOf(tilingLayout)[1]
                : undefined
        ).gaps;
        this._selectedTilesPreview
            .get_parent()
            ?.set_child_above_sibling(this._selectedTilesPreview, null);

        const gaps = this._selectedTilesPreview.gaps;
        if (isAboveLayout) {
            this._selectedTilesPreview.updateBorderRadius(
                gaps.top > 0,
                gaps.right > 0,
                gaps.bottom > 0,
                gaps.left > 0
            );
        } else {
            const { isTop, isRight, isBottom, isLeft } =
                isTileOnContainerBorder(
                    buildRectangle({
                        x: position.x + gaps.left,
                        y: position.y + gaps.top,
                        width: position.width - gaps.left - gaps.right,
                        height: position.height - gaps.top - gaps.bottom,
                    }),
                    this._workArea
                );
            this._selectedTilesPreview.updateBorderRadius(
                !isTop,
                !isRight,
                !isBottom,
                !isLeft
            );
        }
        if (window)
            this._selectedTilesPreview.openAbove(window, position, ease);
        else this._selectedTilesPreview.open(position, ease);
    }

    /**
     * Checks if pointer is inside the current monitor
     * @returns true if the pointer is inside the current monitor, false otherwise
     */
    private _isPointerInsideThisMonitor(window: Meta.Window): boolean {
        const [x, y] = TouchPointer.get().isTouchDeviceActive()
            ? TouchPointer.get().get_pointer(window)
            : global.get_pointer();

        const pointerMonitorIndex = global.display.get_monitor_index_for_rect(
            buildRectangle({
                x,
                y,
                width: 1,
                height: 1,
            })
        );
        return this._monitor.index === pointerMonitorIndex;
    }

    private _showEdgeTiling(
        window: Meta.Window,
        edgeTile: Mtk.Rectangle,
        pointerX: number,
        pointerY: number,
        tilingLayout: TilingLayout
    ) {
        this._selectedTilesPreview.gaps = buildTileGaps(
            edgeTile,
            tilingLayout.innerGaps,
            tilingLayout.outerGaps,
            this._workArea,
            displayScale().isPhysical
                ? getScalingFactorOf(tilingLayout)[1]
                : undefined
        ).gaps;

        if (!this._selectedTilesPreview.showing) {
            const { left, right, top, bottom } =
                this._selectedTilesPreview.gaps;
            const initialRect = buildRectangle({
                x: pointerX,
                y: pointerY,
                width: left + right + 8, // width without gaps will be 8
                height: top + bottom + 8, // height without gaps will be 8
            });
            initialRect.x -= initialRect.width / 2;
            initialRect.y -= initialRect.height / 2;
            this._selectedTilesPreview.open(initialRect, false);
        }

        this.openSelectionTilePreview(edgeTile, false, true, window);
    }

    /** The frame (gaps included) a window gets in the tile, null without layout or room. */
    public tileDestinationOf(
        tile: Tile,
        window: Meta.Window
    ): Mtk.Rectangle | null {
        return this._tileGeometry(tile, window)?.destinationRect ?? null;
    }

    private _tileGeometry(
        tile: Tile,
        window: Meta.Window
    ): { scaledRect: Mtk.Rectangle; destinationRect: Mtk.Rectangle } | null {
        const currentWs = window.get_workspace();
        const tilingLayout = this._workspaceTilingLayout.get(currentWs);
        if (!tilingLayout) return null;

        // We apply the proportions to get tile size and position relative to the work area
        const scaledRect = TileUtils.apply_props(tile, this._workArea);
        // ensure the rect doesn't go horizontally beyond the workarea
        if (
            scaledRect.x + scaledRect.width >
            this._workArea.x + this._workArea.width
        ) {
            scaledRect.width -=
                scaledRect.x +
                scaledRect.width -
                this._workArea.x -
                this._workArea.width;
        }
        // ensure the rect doesn't go vertically beyond the workarea
        if (
            scaledRect.y + scaledRect.height >
            this._workArea.y + this._workArea.height
        ) {
            scaledRect.height -=
                scaledRect.y +
                scaledRect.height -
                this._workArea.y -
                this._workArea.height;
        }

        const gaps = buildTileGaps(
            scaledRect,
            tilingLayout.innerGaps,
            tilingLayout.outerGaps,
            this._workArea,
            displayScale().isPhysical
                ? getScalingFactorOf(tilingLayout)[1]
                : undefined
        ).gaps;

        const destinationRect = buildRectangle({
            x: scaledRect.x + gaps.left,
            y: scaledRect.y + gaps.top,
            width: scaledRect.width - gaps.left - gaps.right,
            height: scaledRect.height - gaps.top - gaps.bottom,
        });

        // abort if there is an invalid selection
        if (destinationRect.width <= 0 || destinationRect.height <= 0)
            return null;
        return { scaledRect, destinationRect };
    }

    private _easeWindowRectFromTile(
        tile: Tile,
        window: Meta.Window,
        skipAnimation: boolean = false
    ): Mtk.Rectangle | null {
        const geometry = this._tileGeometry(tile, window);
        if (!geometry) return null;
        const { scaledRect, destinationRect } = geometry;

        const isMaximized =
            window.maximizedHorizontally || window.maximizedVertically;
        const rememberOriginalSize = !isMaximized;
        if (isMaximized) unmaximizeWindow(window);

        tileWindow(
            window,
            TileUtils.build_tile(
                buildRectangle({
                    x: scaledRect.x,
                    y: scaledRect.y,
                    width: scaledRect.width,
                    height: scaledRect.height,
                }),
                this._workArea
            ),
            window.get_frame_rect().copy(),
            { maximized: !rememberOriginalSize }
        );
        if (skipAnimation) {
            window.move_resize_frame(
                false,
                destinationRect.x,
                destinationRect.y,
                destinationRect.width,
                destinationRect.height
            );
        } else {
            this._easeWindowRect(window, destinationRect);
        }
        return destinationRect;
    }

    public onTileFromWindowMenu(tile: Tile, window: Meta.Window) {
        this._easeWindowRectFromTile(tile, window);
    }

    /**
     * Tile a window right away, without animation, e.g. when its app is reopened.
     * @returns the frame the window is moved to, null when it could not be tiled
     */
    public restoreTile(tile: Tile, window: Meta.Window): Mtk.Rectangle | null {
        return this._easeWindowRectFromTile(tile, window, true);
    }

    public onSpanAllTiles(window: Meta.Window) {
        this._easeWindowRectFromTile(
            new Tile({
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                groups: [],
            }),
            window
        );
    }

    /**
     * Put the window into a vacant tile, right away and without animation.
     * @returns the frame the window is moved to, null when it was left alone
     */
    public autoTile(window: Meta.Window): Mtk.Rectangle | null {
        if (window === null) return null;
        // do not handle windows in monitors not managed by this manager
        if (window.get_monitor() !== this._monitor.index) return null;

        // also called when a window is unmaximized, not only for new windows
        if (
            !isNormalTopLevel(window) ||
            window.minimized ||
            window.maximizedHorizontally ||
            window.maximizedVertically
        )
            return null;

        forgetTile(window);
        const vacantTile = this._findEmptyTile(window);
        if (!vacantTile) return null;

        return this._easeWindowRectFromTile(vacantTile, window, true);
    }

    private _findEmptyTile(window: Meta.Window): Tile | undefined {
        const tiles = GlobalState.get().getSelectedLayoutOfMonitor(
            window.get_monitor(),
            global.workspaceManager.get_active_workspace_index()
        ).tiles;
        const workArea = Main.layoutManager.getWorkAreaForMonitor(
            window.get_monitor()
        );

        // finally find the nearest tile to the center of the screen
        return bestVacantTile(vacantTilesOf(getWindows(), tiles, workArea));
    }
}
