// The one place that knows which tile a window sits in and what size it had before it was
// tiled. Nobody else reads or writes these two facts.
// Free of any GNOME API at runtime (types only) so it can be tested with plain Node.
import type Tile from '../layout/Tile';
import type { Mtk } from '../../gi/ext';

// A window dragged further than this (squared distance, pixels) gets its old size back.
const MINIMUM_DISTANCE_TO_RESTORE_SIZE = 90;

interface TileStateOfWindow {
    tile?: Tile;
    sizeBeforeTile?: Mtk.Rectangle;
}

// Keyed by the window object, so the state disappears together with the window.
const _states = new WeakMap<object, TileStateOfWindow>();

function stateOf(window: object): TileStateOfWindow {
    let state = _states.get(window);
    if (!state) {
        state = {};
        _states.set(window, state);
    }
    return state;
}

// ---- queries ----

export function tileOf(window: object): Tile | undefined {
    return _states.get(window)?.tile;
}

export function isTiled(window: object): boolean {
    return tileOf(window) !== undefined;
}

export function sizeBeforeTile(window: object): Mtk.Rectangle | undefined {
    return _states.get(window)?.sizeBeforeTile;
}

/** The tiled ones among `windows`, in the same order. */
export function tiledWindows<W extends object>(windows: W[]): W[] {
    return windows.filter(isTiled);
}

/** Is the window in a tile of exactly this position and size? */
export function isInTile(window: object, tile: Tile): boolean {
    const current = tileOf(window);
    return (
        current !== undefined &&
        current.x === tile.x &&
        current.y === tile.y &&
        current.width === tile.width &&
        current.height === tile.height
    );
}

// ---- changes ----

/**
 * Remember the size the window has now, but only if it is not tiled yet and not maximised:
 * a tiled window must keep the size from before the first tile.
 */
export function rememberSizeBeforeTile(
    window: object,
    frame: Mtk.Rectangle,
    { maximized }: { maximized: boolean }
): void {
    if (isTiled(window) || maximized) return;
    stateOf(window).sizeBeforeTile = frame;
}

/** Put the window into the tile (a copy of it is stored). */
export function assignTile(window: object, tile: Tile): void {
    stateOf(window).tile = { ...tile, groups: [...tile.groups] };
}

/** Tile the window and remember the size it had, see `rememberSizeBeforeTile`. */
export function tileWindow(
    window: object,
    tile: Tile,
    frame: Mtk.Rectangle,
    { maximized }: { maximized: boolean }
): void {
    rememberSizeBeforeTile(window, frame, { maximized });
    assignTile(window, tile);
}

/** The window is not in a tile any more. The size from before tiling is kept. */
export function forgetTile(window: object): void {
    const state = _states.get(window);
    if (state) state.tile = undefined;
}

/** Overwrite the size to give back when the window leaves its tile. */
export function setSizeBeforeTile(
    window: object,
    frame: Mtk.Rectangle | undefined
): void {
    stateOf(window).sizeBeforeTile = frame;
}

/**
 * The window leaves its tile on purpose (keyboard, menu): return the size to restore and
 * forget the tile. Without a remembered size nothing happens, the tile stays. The size stays
 * remembered.
 */
export function releaseFromTile(window: object): Mtk.Rectangle | undefined {
    const size = sizeBeforeTile(window);
    if (size) forgetTile(window);
    return size;
}

/**
 * The window is being dragged: forget the tile at once. Once it was dragged far enough
 * (squared distance in pixels) return the size to restore, exactly once.
 */
export function releaseOnDrag(
    window: object,
    squaredDistanceDragged: number
): Mtk.Rectangle | undefined {
    forgetTile(window);
    const size = sizeBeforeTile(window);
    if (!size || squaredDistanceDragged <= MINIMUM_DISTANCE_TO_RESTORE_SIZE)
        return undefined;
    setSizeBeforeTile(window, undefined);
    return size;
}

// ---- vacant tiles ----

interface WindowView<W> {
    frameOf(window: W): Mtk.Rectangle;
    isMinimized(window: W): boolean;
    isMaximized(window: W): boolean;
}

/**
 * The frames that keep tiles occupied: tiled windows that are neither minimised nor
 * maximised. For the window that is being dragged `moving.frame` counts instead of its frame.
 */
export function occupyingFrames<W extends object>(
    windows: W[],
    view: WindowView<W>,
    moving?: { window: W; frame: Mtk.Rectangle }
): Mtk.Rectangle[] {
    return tiledWindows(windows)
        .filter(w => !view.isMinimized(w) && !view.isMaximized(w))
        .map(w =>
            moving && w === moving.window ? moving.frame : view.frameOf(w)
        );
}

/** The candidates (tiles or their previews) that no occupying frame overlaps. */
export function vacant<C>(
    candidates: C[],
    rectOf: (candidate: C) => Mtk.Rectangle,
    occupying: Mtk.Rectangle[],
    overlap: (a: Mtk.Rectangle, b: Mtk.Rectangle) => boolean
): C[] {
    return candidates.filter(
        c => !occupying.some(frame => overlap(rectOf(c), frame))
    );
}

/** A copy of the tiles, sorted from the left edge of the screen to the right. */
export function leftToRight(tiles: Tile[]): Tile[] {
    return [...tiles].sort((a, b) => a.x - b.x);
}

/**
 * Of tiles sorted left to right, the one nearest to the centre of the screen.
 * The starting distance of the first tile is computed with the sum unbracketed (0.5 - x + w/2)
 * while the others use 0.5 - (x + w/2); kept as it was so the choice does not change.
 */
export function bestVacantTile(sortedTiles: Tile[]): Tile | undefined {
    if (sortedTiles.length === 0) return undefined;
    let best = 0;
    let bestDistance = Math.abs(
        0.5 - sortedTiles[0].x + sortedTiles[0].width / 2
    );
    for (let index = 1; index < sortedTiles.length; index++) {
        const distance = Math.abs(
            0.5 - (sortedTiles[index].x + sortedTiles[index].width / 2)
        );
        if (bestDistance > distance) {
            best = index;
            bestDistance = distance;
        }
    }
    return sortedTiles[best];
}
