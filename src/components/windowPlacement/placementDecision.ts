// Where a new window goes, decided once. Free of any GNOME API so it can be tested with plain Node.
// Ranking: (1) the remembered entry of the application, (2) auto-tiling, (3) leave the window
// where the application put it. Auto-tiling never runs for a window that has an entry.

import {
    placeRestored,
    type Rect,
    type RememberedFrames,
    type TileRect,
} from '../windowMemory/frameMemory.ts';

/** What is known about the new window once it is shown (the application id exists only now). */
export interface NewWindow {
    // a normal top-level window: not a dialog, not transient for another window
    placeable: boolean;
    appId: string | null;
    canMoveResize: boolean;
    minimized: boolean;
    maximized: boolean;
    monitorIndex: number;
}

export interface PlacementContext {
    rememberEnabled: boolean;
    autoTilingEnabled: boolean;
    entries: RememberedFrames;
    workAreas: Rect[];
    // frames of the other windows of the same application; windows of other applications at
    // the same place are fine and are not part of the context
    sameAppFrames: Rect[];
    // the pixel rect a tile takes on a monitor, null when that monitor has no layout
    tileRect: (tile: TileRect, monitorIndex: number) => Rect | null;
}

export type PlacementDecision =
    | { kind: 'leave' }
    | { kind: 'auto-tile' }
    | {
          kind: 'restore';
          // where the window goes; missing when the free size is unknown and the application
          // keeps its own size. With a tile it is the free size to come back to when dragged out
          frame?: Rect;
          monitorIndex: number;
          tile?: TileRect;
          maximized?: boolean;
      };

export function decidePlacement(
    window: NewWindow,
    context: PlacementContext
): PlacementDecision {
    if (!window.placeable) return { kind: 'leave' };

    const entry =
        context.rememberEnabled && window.canMoveResize && window.appId
            ? context.entries[window.appId]
            : undefined;
    if (entry) return restore(window, context, entry);

    if (context.autoTilingEnabled && !window.minimized && !window.maximized)
        return { kind: 'auto-tile' };
    return { kind: 'leave' };
}

function restore(
    window: NewWindow,
    context: PlacementContext,
    entry: NonNullable<RememberedFrames[string]>
): PlacementDecision {
    const { workAreas, sameAppFrames } = context;

    let monitorIndex = window.monitorIndex;
    let frame: Rect | undefined;
    if (entry.frame) {
        const placed = placeRestored(
            { ...entry, frame: entry.frame },
            workAreas,
            sameAppFrames
        );
        frame = placed.frame;
        monitorIndex = placed.monitorIndex;
    }

    if (entry.tile && entry.maximized) {
        // maximised by edge or keyboard: tiled in the whole-screen tile
        return {
            kind: 'restore',
            ...(frame ? { frame } : {}),
            monitorIndex,
            tile: entry.tile,
            maximized: true,
        };
    }

    if (entry.tile) {
        // a tile cannot be offset: when a window of the same app already fills it, the new
        // window gets the size of the tile, cascaded and untiled
        const tileRect = context.tileRect(entry.tile, monitorIndex);
        if (
            tileRect &&
            sameAppFrames.some(r => r.x === tileRect.x && r.y === tileRect.y)
        ) {
            const placed = placeRestored(
                { frame: tileRect },
                workAreas,
                sameAppFrames
            );
            return {
                kind: 'restore',
                frame: placed.frame,
                monitorIndex: placed.monitorIndex,
            };
        }
        return {
            kind: 'restore',
            ...(frame ? { frame } : {}),
            monitorIndex,
            tile: entry.tile,
        };
    }

    return {
        kind: 'restore',
        ...(frame ? { frame } : {}),
        monitorIndex,
        ...(entry.maximized ? { maximized: true } : {}),
    };
}
