import { Meta } from '../../gi/ext';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Settings from '../../settings/settings';
import SignalHandling from '../../utils/signalHandling';
import { logger } from '../../utils/logger';
import { buildRectangle } from '../../utils/ui';
import { maximizeWindow } from '../../utils/gnomesupport';
import Tile from '../layout/Tile';
import ExtendedWindow from '../tilingsystem/extendedWindow';
import {
    parseRememberedFrames,
    placeRestored,
    RememberedFrame,
    rememberClosing,
    Rect,
} from './frameMemory';

const debug = logger('WindowMemory');

/**
 * Reopens the windows of an application where the last window of that application was
 * closed: same size, same position, same tile (like macOS does). Monitor independent: if the
 * remembered position is no longer on a monitor, the window is moved onto the nearest one.
 * The decisions live in frameMemory; this class only connects them to the windows.
 */
export default class WindowMemory {
    private static _instance: WindowMemory | null = null;

    private readonly _signals: SignalHandling;
    private readonly _tileWindow: (
        window: Meta.Window,
        tile: Tile,
        monitorIndex: number
    ) => void;
    private readonly _unmanagingIds: Map<Meta.Window, number>;
    private readonly _shownIds: Map<Meta.Window, number>;

    /**
     * @param tileWindow tiles the window into the given tile on the given monitor
     */
    constructor(
        tileWindow: (
            window: Meta.Window,
            tile: Tile,
            monitorIndex: number
        ) => void
    ) {
        this._signals = new SignalHandling();
        this._tileWindow = tileWindow;
        this._unmanagingIds = new Map();
        this._shownIds = new Map();
    }

    /** Whether a window of this application will be restored by this module. */
    public static hasEntryFor(window: Meta.Window): boolean {
        const instance = WindowMemory._instance;
        if (!instance || !Settings.REMEMBER_WINDOWS) return false;
        if (!window.allows_move() || !window.allows_resize()) return false;

        const appId = instance._appIdOf(window);
        return appId !== null && instance._load()[appId] !== undefined;
    }

    public enable(): void {
        WindowMemory._instance = this;

        global.get_window_actors().forEach(actor => {
            const window = actor.metaWindow;
            if (window && this._appIdOf(window) !== null)
                this._trackClosing(window);
        });

        this._signals.connect(
            global.display,
            'window-created',
            (_display: Meta.Display, window: Meta.Window) =>
                this._onWindowCreated(window)
        );
    }

    public destroy(): void {
        if (WindowMemory._instance === this) WindowMemory._instance = null;
        this._signals.disconnect();

        this._rememberOpenWindows();

        this._unmanagingIds.forEach((id, window) => window.disconnect(id));
        this._unmanagingIds.clear();
        this._shownIds.forEach((id, window) => window.disconnect(id));
        this._shownIds.clear();
    }

    /**
     * On shutdown or disable the windows are not closed one by one, so remember what is open.
     * The most recently used window of an app is saved last and therefore wins.
     */
    private _rememberOpenWindows(): void {
        const recentFirst = global.display.get_tab_list(
            Meta.TabList.NORMAL,
            null
        );
        [...recentFirst]
            .reverse()
            .filter(window => this._unmanagingIds.has(window))
            .forEach(window => {
                try {
                    this._remember(window);
                } catch (e) {
                    // shutting down: never let saving block the cleanup
                    debug('could not remember window on shutdown', e);
                }
            });
    }

    private _appIdOf(window: Meta.Window): string | null {
        if (
            window.windowType !== Meta.WindowType.NORMAL ||
            window.get_transient_for() !== null ||
            window.is_attached_dialog()
        )
            return null;

        return window.get_gtk_application_id() || window.get_wm_class() || null;
    }

    private _load() {
        return parseRememberedFrames(Settings.REMEMBERED_WINDOWS);
    }

    private _onWindowCreated(window: Meta.Window): void {
        this._trackClosing(window);
        if (!Settings.REMEMBER_WINDOWS) return;

        // the application id is only known once the window is shown
        const id = window.connect('shown', () => {
            window.disconnect(id);
            this._shownIds.delete(window);
            this._restore(window);
        });
        this._shownIds.set(window, id);
    }

    private _trackClosing(window: Meta.Window): void {
        if (this._unmanagingIds.has(window)) return;

        const id = window.connect('unmanaging', () => {
            this._remember(window);
            window.disconnect(id);
            this._unmanagingIds.delete(window);

            // a window closed before it was shown never fires 'shown'
            const shownId = this._shownIds.get(window);
            if (shownId !== undefined) window.disconnect(shownId);
            this._shownIds.delete(window);
        });
        this._unmanagingIds.set(window, id);
    }

    private _remember(window: Meta.Window): void {
        if (!Settings.REMEMBER_WINDOWS) return;

        const appId = this._appIdOf(window);
        if (appId === null || window.is_fullscreen()) {
            debug('not remembering window', window.get_title(), appId);
            return;
        }

        const extWin = window as ExtendedWindow;
        const updated = rememberClosing(this._load(), appId, {
            frame: window.get_frame_rect(),
            maximized:
                window.maximizedHorizontally && window.maximizedVertically,
            tile: extWin.assignedTile,
            sizeBeforeTile: extWin.originalSize,
        });

        Settings.REMEMBERED_WINDOWS = JSON.stringify(updated);
        debug('remembered', appId, JSON.stringify(updated[appId]));
    }

    private _restore(window: Meta.Window): void {
        if (!Settings.REMEMBER_WINDOWS) return;

        const appId = this._appIdOf(window);
        if (appId === null) {
            debug('not restoring window without application id');
            return;
        }
        const entry: RememberedFrame | undefined = this._load()[appId];
        if (!entry || !window.allows_move() || !window.allows_resize()) {
            debug('nothing to restore for', appId, 'known:', !!entry);
            return;
        }
        debug('restoring', appId, JSON.stringify(entry));

        // no remembered free size: leave the window at the size the application chose
        let monitorIndex = window.get_monitor();
        let frame: Rect | undefined;
        if (entry.frame) {
            const placed = this._place(
                { ...entry, frame: entry.frame },
                window,
                appId
            );
            frame = placed.frame;
            monitorIndex = placed.monitorIndex;
            window.move_resize_frame(
                false,
                frame.x,
                frame.y,
                frame.width,
                frame.height
            );
        }

        if (entry.tile) {
            // the move above is asynchronous: name the monitor instead of asking the window
            this._tileWindow(window, new Tile(entry.tile), monitorIndex);
            // tiling captured the old size: dragging the window out of the tile must
            // bring back the remembered size
            if (frame)
                (window as ExtendedWindow).originalSize = buildRectangle(frame);
        } else if (entry.maximized) maximizeWindow(window);
    }

    private _place(
        entry: RememberedFrame & { frame: Rect },
        window: Meta.Window,
        appId: string
    ) {
        const workAreas: Rect[] = Main.layoutManager.monitors.map((_m, i) =>
            Main.layoutManager.getWorkAreaForMonitor(i)
        );
        const occupied = global
            .get_window_actors()
            .map(actor => actor.metaWindow)
            .filter(
                (w): w is Meta.Window =>
                    !!w && w !== window && this._appIdOf(w) === appId
            )
            .map(w => w.get_frame_rect());
        return placeRestored(entry, workAreas, occupied);
    }
}
