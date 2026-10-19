// Where a window dragged to a screen edge ends up: pointer, work area, layout and the edge
// tiling settings in, zone and target rectangle out.
// Free of any GNOME API at runtime (types only) so it can be tested with plain Node.
import type { EdgeTilingMode } from '../../settings/settings';

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Point {
    x: number;
    y: number;
}

// A tile of a layout, relative to the work area (0..1).
type RelativeTile = Rect;

export type EdgeZone =
    | 'topLeft'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomRight'
    | 'topCenter'
    | 'leftCenter'
    | 'rightCenter';

export interface EdgeTileInput {
    pointer: Point;
    workArea: Rect;
    // share of the work area (in percent) a corner zone covers
    quarterPercentage: number;
    mode: `${EdgeTilingMode}`;
    // tiles of the selected layout, null when there is none
    tiles: RelativeTile[] | null;
    // the zone the drag is already in, if any
    activeZone: EdgeZone | null;
}

export interface EdgeTileResult {
    changed: boolean;
    // the zone now hit; null when the pointer is in no zone
    zone: EdgeZone | null;
    // where the window goes; meaningful only when `changed`
    rect: Rect;
}

const TOP_EDGE_TILING_OFFSET = 8;
const HALF = 0.5;
// how far a tile may be from the work area border and still touch it (relative units)
const BORDER_TOLERANCE = 0.01;

// GNOME rectangles hold whole pixels: every value stored in one is cut, so we cut too.
const px = Math.trunc;

const isInside = (point: Point, rect: Rect) =>
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height;

const clampInside = (point: Point, rect: Rect): Point => ({
    x: Math.min(Math.max(point.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(point.y, rect.y), rect.y + rect.height),
});

export function canActivateEdgeTiling(
    pointer: Point,
    workArea: Rect,
    edgeTilingOffset: number
): boolean {
    return (
        pointer.x <= workArea.x + edgeTilingOffset ||
        pointer.y <= workArea.y + TOP_EDGE_TILING_OFFSET ||
        pointer.x >= workArea.x + workArea.width - edgeTilingOffset ||
        pointer.y >= workArea.y + workArea.height - edgeTilingOffset
    );
}

function activationZones(
    workArea: Rect,
    quarterFraction: number
): Record<EdgeZone, Rect> {
    const width = Math.ceil(workArea.width * quarterFraction);
    const height = Math.ceil(workArea.height * quarterFraction);
    const right = workArea.x + workArea.width - width;
    const bottom = workArea.y + workArea.height - height;
    return {
        topLeft: { x: workArea.x, y: workArea.y, width, height },
        topRight: { x: right, y: workArea.y, width, height },
        bottomLeft: { x: workArea.x, y: bottom, width, height },
        bottomRight: { x: right, y: bottom, width, height },
        topCenter: {
            x: workArea.x + width,
            y: workArea.y,
            width: right - (workArea.x + width),
            height,
        },
        leftCenter: {
            x: workArea.x,
            y: workArea.y + height,
            width,
            height: bottom - (workArea.y + height),
        },
        rightCenter: {
            x: right,
            y: workArea.y + height,
            width,
            height: bottom - (workArea.y + height),
        },
    };
}

// The order matters only where zones touch; the centre zones win over the corners.
const CENTRE_ZONES: EdgeZone[] = ['topCenter', 'leftCenter', 'rightCenter'];

// Default mode looks at the corners of the pointer's screen half only, so a pointer on the
// seam between two corner zones (threshold of 50%) goes to its own half. The layout based
// modes check the left corners first.
function zoneAt(
    point: Point,
    zones: Record<EdgeZone, Rect>,
    workArea: Rect,
    layoutMode: boolean
): EdgeZone | null {
    const centre = CENTRE_ZONES.find(z => isInside(point, zones[z]));
    if (centre) return centre;

    const inLeftHalf = point.x <= workArea.x + workArea.width / 2;
    const corners: EdgeZone[] = layoutMode
        ? ['topLeft', 'bottomLeft', 'topRight', 'bottomRight']
        : inLeftHalf
          ? ['topLeft', 'bottomLeft']
          : ['topRight', 'bottomRight'];
    return corners.find(z => isInside(point, zones[z])) ?? null;
}

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const touchesLeft = (t: RelativeTile) => Math.abs(t.x) < BORDER_TOLERANCE;
const touchesRight = (t: RelativeTile) =>
    Math.abs(t.x + t.width - 1) < BORDER_TOLERANCE;
const touchesTop = (t: RelativeTile) => Math.abs(t.y) < BORDER_TOLERANCE;
const touchesBottom = (t: RelativeTile) =>
    Math.abs(t.y + t.height - 1) < BORDER_TOLERANCE;

function tileAtCorner(tiles: RelativeTile[], corner: Corner) {
    const horizontal = corner.endsWith('Left') ? touchesLeft : touchesRight;
    const vertical = corner.startsWith('top') ? touchesTop : touchesBottom;
    return tiles.find(t => horizontal(t) && vertical(t));
}

// The tile of the left/right edge the pointer is level with; failing that, the nearest by
// distance to its centre. The first tile of the layout wins ties.
function tileAtSideEdge(
    tiles: RelativeTile[],
    side: 'left' | 'right',
    pointer: Point,
    workArea: Rect
): RelativeTile | null {
    const edgeTiles = tiles.filter(
        side === 'left' ? touchesLeft : touchesRight
    );
    if (edgeTiles.length === 0) return null;

    const relativeY = (pointer.y - workArea.y) / workArea.height;
    const level = edgeTiles.find(
        t => relativeY >= t.y && relativeY <= t.y + t.height
    );
    if (level) return level;

    const distanceToCentre = (t: RelativeTile) =>
        (pointer.x - (workArea.x + (t.x + t.width / 2) * workArea.width)) ** 2 +
        (pointer.y - (workArea.y + (t.y + t.height / 2) * workArea.height)) **
            2;
    return edgeTiles.reduce((closest, t) =>
        distanceToCentre(t) < distanceToCentre(closest) ? t : closest
    );
}

function rectOfTile(tile: RelativeTile, workArea: Rect): Rect {
    return {
        x: px(workArea.x + workArea.width * tile.x),
        y: px(workArea.y + workArea.height * tile.y),
        width: px(workArea.width * tile.width),
        height: px(workArea.height * tile.height),
    };
}

// The quarter of the work area in the given corner.
function quarterRect(workArea: Rect, corner: Corner): Rect {
    const width = px(workArea.width * HALF);
    const height = px(workArea.height * HALF);
    return {
        x: corner.endsWith('Left')
            ? workArea.x
            : workArea.x + workArea.width - width,
        y: corner.startsWith('top')
            ? workArea.y
            : workArea.y + workArea.height - height,
        width,
        height,
    };
}

function sideHalfRect(workArea: Rect, side: 'left' | 'right'): Rect {
    const width = px(workArea.width * HALF);
    return {
        x: side === 'left' ? workArea.x : workArea.x + workArea.width - width,
        y: workArea.y,
        width,
        height: px(workArea.height),
    };
}

// What a layout based mode shows on a side when the layout has no tile there.
function sideFallbackRect(workArea: Rect, side: 'left' | 'right'): Rect {
    return quarterRect(workArea, side === 'left' ? 'topLeft' : 'topRight');
}

// The whole column of tiles touching the left/right edge: as wide as its widest tile,
// as tall as the work area.
function columnRect(
    tiles: RelativeTile[],
    side: 'left' | 'right',
    workArea: Rect
): Rect | null {
    const edgeTiles = tiles.filter(
        side === 'left' ? touchesLeft : touchesRight
    );
    if (edgeTiles.length === 0) return null;

    let column: RelativeTile[];
    if (side === 'left') {
        const minX = Math.min(...edgeTiles.map(t => t.x));
        column = edgeTiles.filter(t => Math.abs(t.x - minX) < BORDER_TOLERANCE);
    } else {
        const maxEnd = Math.max(...edgeTiles.map(t => t.x + t.width));
        column = edgeTiles.filter(
            t => Math.abs(t.x + t.width - maxEnd) < BORDER_TOLERANCE
        );
    }
    const left = Math.min(...column.map(t => t.x));
    const widest = Math.max(...column.map(t => t.width));
    return {
        x: px(workArea.x + workArea.width * left),
        y: workArea.y,
        width: px(workArea.width * widest),
        height: px(workArea.height),
    };
}

function rectForZone(
    zone: EdgeZone,
    pointer: Point,
    workArea: Rect,
    mode: `${EdgeTilingMode}`,
    tiles: RelativeTile[] | null,
    layoutMode: boolean
): Rect {
    if (zone === 'topCenter') {
        return {
            x: workArea.x,
            y: workArea.y,
            width: px(workArea.width),
            height: px(workArea.height),
        };
    }

    if (zone === 'leftCenter' || zone === 'rightCenter') {
        const side = zone === 'leftCenter' ? 'left' : 'right';
        if (!layoutMode || !tiles) return sideHalfRect(workArea, side);

        let found: Rect | null = null;
        if (mode === 'adaptive') {
            found = columnRect(tiles, side, workArea);
        } else {
            const tile = tileAtSideEdge(tiles, side, pointer, workArea);
            if (tile) found = rectOfTile(tile, workArea);
        }
        return found ?? sideFallbackRect(workArea, side);
    }

    if (layoutMode && tiles) {
        const tile = tileAtCorner(tiles, zone);
        if (tile) return rectOfTile(tile, workArea);
    }
    return quarterRect(workArea, zone);
}

export function edgeTileAt({
    pointer,
    workArea,
    quarterPercentage,
    mode,
    tiles,
    activeZone,
}: EdgeTileInput): EdgeTileResult {
    const point = clampInside(pointer, workArea);
    const zones = activationZones(workArea, quarterPercentage / 100);

    if (activeZone && isInside(point, zones[activeZone])) {
        return {
            changed: false,
            zone: activeZone,
            rect: quarterRect(workArea, 'topLeft'),
        };
    }

    const layoutMode =
        tiles !== null && (mode === 'adaptive' || mode === 'granular');
    const zone = zoneAt(point, zones, workArea, layoutMode);
    if (!zone) {
        return {
            changed: false,
            zone: null,
            rect: quarterRect(workArea, 'topLeft'),
        };
    }
    return {
        changed: true,
        zone,
        rect: rectForZone(zone, point, workArea, mode, tiles, layoutMode),
    };
}
