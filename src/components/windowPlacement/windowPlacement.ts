import { GLib, Meta } from '../../gi/ext';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Settings from '../../settings/settings';
import SignalHandling from '../../utils/signalHandling';
import { logger } from '../../utils/logger';
import { buildRectangle } from '../../utils/ui';
import { maximizeWindow } from '../../utils/gnomesupport';
import Tile from '../layout/Tile';
import { maximizeAsTile, setSizeBeforeTile } from '../tileState/tileState';
import { TilingManager } from '../tilingsystem/tilingManager';
import WindowMemory from '../windowMemory/windowMemory';
import { liveActor } from '../windowLifetime/windowLifetime';
import { Rect } from '../windowMemory/frameMemory';
import { decidePlacement, PlacementDecision } from './placementDecision';
import { appIdOf, isNormalTopLevel } from './windowFacts';

const debug = logger('WindowPlacement');

// A window that never reaches its final frame (the client does not answer) is shown anyway.
// Measured on GNOME 51: a window reaches its final frame 21-28 ms after it was created, so
// this is roughly ten times the slowest measurement, a safety net and not an expected wait.
const MAX_HIDDEN_MS = 250;

interface Hold {
    windowIds: number[];
    timeoutId: number;
}

/**
 * Decides once per new window where it goes (see placementDecision) and carries it out. The
 * application of a window is only known once it is shown, so that is the moment of the
 * decision: first-frame follows a few ms later, so nothing has been drawn yet. The window is
 * kept hidden from then on until it has its final frame, so it is never seen at a wrong place.
 */
export default class WindowPlacement {
    private readonly _signals: SignalHandling;
    private readonly _memory: WindowMemory;
    private readonly _tilingManagerOf: (
        monitorIndex: number
    ) => TilingManager | undefined;

    private readonly _watched: Map<Meta.Window, number[]>;
    private readonly _holds: Map<Meta.Window, Hold>;

    constructor(
        memory: WindowMemory,
        tilingManagerOf: (monitorIndex: number) => TilingManager | undefined
    ) {
        this._signals = new SignalHandling();
        this._memory = memory;
        this._tilingManagerOf = tilingManagerOf;
        this._watched = new Map();
        this._holds = new Map();
    }

    public enable(): void {
        this._signals.connect(
            global.display,
            'window-created',
            (_display: Meta.Display, window: Meta.Window) => this._watch(window)
        );
    }

    public destroy(): void {
        this._signals.disconnect();
        this._watched.forEach((ids, window) =>
            ids.forEach(id => window.disconnect(id))
        );
        this._watched.clear();
        [...this._holds.keys()].forEach(window => this._revealAndDrop(window));
    }

    private _watch(window: Meta.Window): void {
        const ids: number[] = [];
        const stop = () => {
            ids.forEach(id => window.disconnect(id));
            this._watched.delete(window);
        };
        ids.push(
            window.connect('shown', () => {
                stop();
                this._place(window);
            })
        );
        // a window closed before it was shown never fires 'shown'
        ids.push(window.connect('unmanaging', stop));
        this._watched.set(window, ids);
    }

    private _place(window: Meta.Window): void {
        const appId = appIdOf(window);
        const decision = decidePlacement(
            {
                placeable: isNormalTopLevel(window),
                appId,
                canMoveResize: window.allows_move() && window.allows_resize(),
                minimized: window.minimized,
                maximized:
                    window.maximizedHorizontally || window.maximizedVertically,
                monitorIndex: window.get_monitor(),
            },
            {
                rememberEnabled: Settings.REMEMBER_WINDOWS,
                autoTilingEnabled: Settings.ENABLE_AUTO_TILING,
                entries: this._memory.entries(),
                workAreas: Main.layoutManager.monitors.map((_m, i) =>
                    Main.layoutManager.getWorkAreaForMonitor(i)
                ),
                sameAppFrames: this._framesOfSameApp(window, appId),
                tileRect: (tile, monitorIndex) =>
                    this._tilingManagerOf(monitorIndex)?.tileDestinationOf(
                        new Tile(tile),
                        window
                    ) ?? null,
            }
        );
        debug('decision for', appId, JSON.stringify(decision));
        if (decision.kind === 'leave') return;

        this._hold(window);
        const target = this._carryOut(window, decision);
        // maximising has no known frame, the client's answer ends the wait; in any other case
        // without a target nothing was moved (e.g. no vacant tile), so there is nothing to wait for
        const maximizing = decision.kind === 'restore' && decision.maximized;
        if (!target && !maximizing) this._revealAndDrop(window);
        else this._revealWhenPlaced(window, target);
    }

    private _framesOfSameApp(
        window: Meta.Window,
        appId: string | null
    ): Rect[] {
        if (appId === null) return [];
        return global
            .get_window_actors()
            .map(actor => actor.metaWindow)
            .filter(
                (other): other is Meta.Window =>
                    !!other && other !== window && appIdOf(other) === appId
            )
            .map(other => other.get_frame_rect());
    }

    /** @returns the frame the window ends up in, null when that is not known */
    private _carryOut(
        window: Meta.Window,
        decision: Exclude<PlacementDecision, { kind: 'leave' }>
    ): Rect | null {
        if (decision.kind === 'auto-tile') {
            return (
                this._tilingManagerOf(window.get_monitor())?.autoTile(window) ??
                null
            );
        }

        const { frame, tile } = decision;
        if (frame)
            window.move_resize_frame(
                false,
                frame.x,
                frame.y,
                frame.width,
                frame.height
            );

        if (tile && decision.maximized) {
            // maximised by edge or keyboard: the size is the one to come back to
            if (frame) setSizeBeforeTile(window, buildRectangle(frame));
            if (!window.maximizedHorizontally && !window.maximizedVertically)
                maximizeAsTile(window);
            maximizeWindow(window);
            return null;
        }

        if (tile) {
            // the move above is asynchronous: name the monitor instead of asking the window
            const tiled = this._tilingManagerOf(
                decision.monitorIndex
            )?.restoreTile(new Tile(tile), window);
            // tiling captured the old size: dragging the window out of the tile must
            // bring back the remembered size
            if (frame) setSizeBeforeTile(window, buildRectangle(frame));
            return tiled ?? frame ?? null;
        }
        if (decision.maximized) {
            maximizeWindow(window);
            return null;
        }
        return frame ?? null;
    }

    private _hold(window: Meta.Window): void {
        liveActor<Meta.WindowActor>(window)?.hide();
        const timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            MAX_HIDDEN_MS,
            () => {
                debug('window did not reach its frame in time, showing it');
                const hold = this._holds.get(window);
                if (hold) hold.timeoutId = 0; // this source ends by returning REMOVE
                this._revealAndDrop(window);
                return GLib.SOURCE_REMOVE;
            }
        );
        const unmanagingId = window.connect('unmanaging', () => {
            this._dropHold(window);
        });
        this._holds.set(window, { windowIds: [unmanagingId], timeoutId });
    }

    private _revealWhenPlaced(window: Meta.Window, target: Rect | null): void {
        const hold = this._holds.get(window);
        if (!hold) return;

        const atTarget = () => {
            if (!target) return false;
            const r = window.get_frame_rect();
            return (
                r.x === target.x &&
                r.y === target.y &&
                r.width === target.width &&
                r.height === target.height
            );
        };
        if (atTarget()) {
            this._revealAndDrop(window);
            return;
        }

        // the client answers a resize with its final size, which can differ from the target
        // (minimum size), so its answer ends the wait as well; without a known target
        // (maximising) the answer or the timeout ends it
        const reveal = () => this._revealAndDrop(window);
        hold.windowIds.push(
            window.connect('size-changed', reveal),
            window.connect('position-changed', reveal)
        );
    }

    private _revealAndDrop(window: Meta.Window): void {
        const hold = this._dropHold(window);
        if (hold) liveActor<Meta.WindowActor>(window)?.show();
    }

    private _dropHold(window: Meta.Window): Hold | undefined {
        const hold = this._holds.get(window);
        if (!hold) return undefined;
        this._holds.delete(window);
        hold.windowIds.forEach(id => window.disconnect(id));
        if (hold.timeoutId !== 0) GLib.source_remove(hold.timeoutId);
        return hold;
    }
}
