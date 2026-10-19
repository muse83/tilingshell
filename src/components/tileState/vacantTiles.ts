// The GNOME side of the tile state module: asks real windows for their frame and state.
import type Tile from '../layout/Tile';
import { Meta, Mtk } from '../../gi/ext';
import TileUtils from '../layout/TileUtils';
import { leftToRight, occupyingFrames, vacant } from './tileState';

export const windowView = {
    frameOf: (window: Meta.Window): Mtk.Rectangle => window.get_frame_rect(),
    isMinimized: (window: Meta.Window): boolean => window.minimized,
};

/**
 * The tiles of a layout no tiled window covers, sorted from left to right.
 * @param workArea the work area of the monitor the tiles are laid out on
 */
export function vacantTilesOf(
    windows: Meta.Window[],
    tiles: Tile[],
    workArea: Mtk.Rectangle
): Tile[] {
    return leftToRight(
        vacant(
            tiles,
            t => TileUtils.apply_props(t, workArea),
            occupyingFrames(
                windows.filter(w => !!w),
                windowView
            ),
            (a, b) => a.overlap(b)
        )
    );
}
