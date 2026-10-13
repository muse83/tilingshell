import { Meta } from '../../gi/ext';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Settings from '../../settings/settings';
import SignalHandling from '../../utils/signalHandling';
import { logger } from '../../utils/logger';
import { buildRectangle } from '../../utils/ui';
import { maximizeWindow } from '../../utils/gnomesupport';
import Tile from '../layout/Tile';
import ExtendedWindow from '../tilingsystem/extendedWindow';

const debug = logger('WindowMemory');

// how many applications are remembered at most, the least recently used are dropped
const MAX_REMEMBERED_APPS = 200;
// offset applied to a window that would cover another window of the same application
const CASCADE_OFFSET = 30;
const MAX_CASCADE_STEPS = 10;

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface RememberedWindow {
    // size and position the window has when it is not tiled
    frame: Rect;
    tile?: Rect & { groups: number[] };
    maximized?: boolean;
}

type RememberedWindows = { [appId: string]: RememberedWindow };

/**
 * Reopens the windows of an application where the last window of that application was
 * closed: same size, same position, same tile (like macOS does). Monitor independent: if the
 * remembered position is no longer on a monitor, the window is moved onto the nearest one.
 */
export default class WindowMemory {
    private static _instance: WindowMemory | null = null;

    private readonly _signals: SignalHandling;
    private readonly _tileWindow: (window: Meta.Window, tile: Tile) => void;
    private readonly _unmanagingIds: Map<Meta.Window, number>;

    /**
     * @param tileWindow tiles the window into the given tile on the monitor the window is on
     */
    constructor(tileWindow: (window: Meta.Window, tile: Tile) => void) {
        this._signals = new SignalHandling();
        this._tileWindow = tileWindow;
        this._unmanagingIds = new Map();
    }

    /** Whether a window of this application will be restored by this module. */
    public static hasEntryFor(window: Meta.Window): boolean {
        const instance = WindowMemory._instance;
        if (!instance || !Settings.REMEMBER_WINDOWS) return false;

        const appId = instance._appIdOf(window);
        return appId !== null && instance._load()[appId] !== undefined;
    }

    public enable(): void {
        WindowMemory._instance = this;

        global.get_window_actors().forEach((actor) => {
            if (this._appIdOf(actor.metaWindow) !== null)
                this._trackClosing(actor.metaWindow);
        });

        this._signals.connect(
            global.display,
            'window-created',
            (_display: Meta.Display, window: Meta.Window) =>
                this._onWindowCreated(window),
        );
    }

    public destroy(): void {
        if (WindowMemory._instance === this) WindowMemory._instance = null;
        this._signals.disconnect();

        this._unmanagingIds.forEach((id, window) => window.disconnect(id));
        this._unmanagingIds.clear();
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

    private _load(): RememberedWindows {
        try {
            const parsed = JSON.parse(Settings.REMEMBERED_WINDOWS);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {
            debug('ignoring unreadable remembered windows', e);
        }
        return {};
    }

    private _onWindowCreated(window: Meta.Window): void {
        this._trackClosing(window);
        if (!Settings.REMEMBER_WINDOWS) return;

        // the application id is only known once the window is shown
        const id = window.connect('shown', () => {
            window.disconnect(id);
            this._restore(window);
        });
    }

    private _trackClosing(window: Meta.Window): void {
        if (this._unmanagingIds.has(window)) return;

        const id = window.connect('unmanaging', () => {
            this._remember(window);
            window.disconnect(id);
            this._unmanagingIds.delete(window);
        });
        this._unmanagingIds.set(window, id);
    }

    private _remember(window: Meta.Window): void {
        if (!Settings.REMEMBER_WINDOWS) return;

        const appId = this._appIdOf(window);
        if (appId === null || window.is_fullscreen()) return;

        const extWin = window as ExtendedWindow;
        const maximized =
            window.maximizedHorizontally && window.maximizedVertically;
        const remembered = this._load();
        const previous = remembered[appId];

        // a tiled window forgets its tile when closed, but the size it had before
        // being tiled is what the user would expect after dragging it out of the tile
        let frame: Rect = window.get_frame_rect();
        if (extWin.assignedTile && extWin.originalSize)
            frame = extWin.originalSize;
        else if (maximized && previous) frame = previous.frame;

        const entry: RememberedWindow = {
            frame: {
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height,
            },
        };
        if (maximized) entry.maximized = true;
        else if (extWin.assignedTile)
            entry.tile = {
                x: extWin.assignedTile.x,
                y: extWin.assignedTile.y,
                width: extWin.assignedTile.width,
                height: extWin.assignedTile.height,
                groups: [...extWin.assignedTile.groups],
            };

        // re-insert to keep the most recently used application last
        delete remembered[appId];
        remembered[appId] = entry;
        Object.keys(remembered)
            .slice(0, -MAX_REMEMBERED_APPS)
            .forEach((key) => delete remembered[key]);

        Settings.REMEMBERED_WINDOWS = JSON.stringify(remembered);
    }

    private _restore(window: Meta.Window): void {
        if (!Settings.REMEMBER_WINDOWS) return;

        const appId = this._appIdOf(window);
        if (appId === null) return;
        const entry = this._load()[appId];
        if (!entry || !window.allows_move() || !window.allows_resize()) return;

        const frame = this._fitOnMonitors(entry.frame);
        if (!entry.tile) this._avoidCovering(window, appId, frame);

        window.move_resize_frame(
            false,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
        );

        if (entry.tile) {
            this._tileWindow(window, new Tile(entry.tile));
            // the resize above is asynchronous, so tiling captured the old size: dragging
            // the window out of the tile must bring back the remembered size
            (window as ExtendedWindow).originalSize = buildRectangle(frame);
        } else if (entry.maximized) maximizeWindow(window);
    }

    /** Move and shrink the rect so it is fully inside the work area of the nearest monitor. */
    private _fitOnMonitors(frame: Rect): Rect {
        const centerX = frame.x + frame.width / 2;
        const centerY = frame.y + frame.height / 2;

        let bestWorkArea: Rect | null = null;
        let bestDistance = Infinity;
        Main.layoutManager.monitors.forEach((_monitor, index) => {
            const area = Main.layoutManager.getWorkAreaForMonitor(index);
            const dx = Math.max(area.x - centerX, 0, centerX - (area.x + area.width));
            const dy = Math.max(area.y - centerY, 0, centerY - (area.y + area.height));
            const distance = dx * dx + dy * dy;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestWorkArea = area;
            }
        });
        if (bestWorkArea === null) return frame;

        const area: Rect = bestWorkArea;
        const width = Math.min(frame.width, area.width);
        const height = Math.min(frame.height, area.height);
        return {
            x: Math.min(Math.max(frame.x, area.x), area.x + area.width - width),
            y: Math.min(Math.max(frame.y, area.y), area.y + area.height - height),
            width,
            height,
        };
    }

    /** Cascade the rect while it sits exactly on top of another window of the same app. */
    private _avoidCovering(window: Meta.Window, appId: string, frame: Rect): void {
        const others = global
            .get_window_actors()
            .map((actor) => actor.metaWindow)
            .filter((w) => w !== window && this._appIdOf(w) === appId)
            .map((w) => w.get_frame_rect());

        for (let step = 0; step < MAX_CASCADE_STEPS; step++) {
            const covered = others.some(
                (r) => r.x === frame.x && r.y === frame.y,
            );
            if (!covered) return;

            const moved = this._fitOnMonitors({
                ...frame,
                x: frame.x + CASCADE_OFFSET,
                y: frame.y + CASCADE_OFFSET,
            });
            frame.x = moved.x;
            frame.y = moved.y;
        }
    }
}
