import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    tileOf,
    isTiled,
    sizeBeforeTile,
    tiledWindows,
    isInTile,
    rememberSizeBeforeTile,
    assignTile,
    tileWindow,
    forgetTile,
    setSizeBeforeTile,
    releaseFromTile,
    releaseOnDrag,
    vacant,
    occupyingFrames,
    leftToRight,
    bestVacantTile,
    maximizeAsTile,
    windowMaximized,
    windowUnmaximized,
} from '../src/components/tileState/tileState.ts';

const win = (extra: object = {}) => ({ ...extra });
const tile = (x: number, y: number, width = 0.5, height = 1) => ({
    x,
    y,
    width,
    height,
    groups: [],
});
const rect = (x: number, y: number, width: number, height: number) => ({
    x,
    y,
    width,
    height,
});

test('a new window is not tiled and has no size before tiling', () => {
    const w = win();
    assert.equal(isTiled(w), false);
    assert.equal(tileOf(w), undefined);
    assert.equal(sizeBeforeTile(w), undefined);
});

test('tileWindow tiles the window and remembers the size it had', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(5, 5, 300, 200), { maximized: false });
    assert.equal(isTiled(w), true);
    assert.deepEqual(sizeBeforeTile(w), rect(5, 5, 300, 200));
});

test('the tile is stored as a copy', () => {
    const w = win();
    const t = tile(0, 0);
    assignTile(w, t);
    t.x = 0.9;
    assert.equal(tileOf(w)?.x, 0);
});

test('the size before tiling is remembered only once', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(5, 5, 300, 200), { maximized: false });
    tileWindow(w, tile(0.5, 0), rect(0, 0, 960, 1080), { maximized: false });
    assert.deepEqual(sizeBeforeTile(w), rect(5, 5, 300, 200));
    assert.equal(tileOf(w)?.x, 0.5);
});

test('a maximised window does not get its size remembered', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(0, 0, 1920, 1080), { maximized: true });
    assert.equal(isTiled(w), true);
    assert.equal(sizeBeforeTile(w), undefined);
});

test('rememberSizeBeforeTile alone does not tile (keyboard move to the centre)', () => {
    const w = win();
    rememberSizeBeforeTile(w, rect(1, 2, 3, 4), { maximized: false });
    assert.equal(isTiled(w), false);
    assert.deepEqual(sizeBeforeTile(w), rect(1, 2, 3, 4));
});

test('forgetTile forgets the tile and keeps the size', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(1, 2, 3, 4), { maximized: false });
    forgetTile(w);
    assert.equal(isTiled(w), false);
    assert.deepEqual(sizeBeforeTile(w), rect(1, 2, 3, 4));
});

test('releaseFromTile gives the size back and forgets the tile', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(1, 2, 3, 4), { maximized: false });
    assert.deepEqual(releaseFromTile(w), rect(1, 2, 3, 4));
    assert.equal(isTiled(w), false);
});

test('releaseFromTile of a window without a size does nothing', () => {
    const w = win();
    assignTile(w, tile(0, 0));
    assert.equal(releaseFromTile(w), undefined);
    assert.equal(isTiled(w), true);
});

test('dragging a tiled window forgets the tile at once', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(1, 2, 3, 4), { maximized: false });
    assert.equal(releaseOnDrag(w, 10), undefined);
    assert.equal(isTiled(w), false);
    assert.deepEqual(sizeBeforeTile(w), rect(1, 2, 3, 4));
});

test('dragging far enough gives the size back once', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(1, 2, 3, 4), { maximized: false });
    assert.deepEqual(releaseOnDrag(w, 91), rect(1, 2, 3, 4));
    assert.equal(sizeBeforeTile(w), undefined);
    assert.equal(releaseOnDrag(w, 500), undefined);
});

test('dragging exactly the minimum distance does not give the size back', () => {
    const w = win();
    setSizeBeforeTile(w, rect(1, 2, 3, 4));
    assert.equal(releaseOnDrag(w, 90), undefined);
});

test('setSizeBeforeTile overwrites the remembered size', () => {
    const w = win();
    tileWindow(w, tile(0, 0), rect(1, 2, 3, 4), { maximized: false });
    setSizeBeforeTile(w, rect(9, 9, 9, 9));
    assert.deepEqual(sizeBeforeTile(w), rect(9, 9, 9, 9));
});

test('tiledWindows keeps only tiled windows, in order', () => {
    const a = win();
    const b = win();
    const c = win();
    assignTile(a, tile(0, 0));
    assignTile(c, tile(0.5, 0));
    assert.deepEqual(tiledWindows([a, b, c]), [a, c]);
});

test('isInTile compares position and size, not identity', () => {
    const w = win();
    assignTile(w, tile(0, 0));
    assert.equal(isInTile(w, tile(0, 0)), true);
    assert.equal(isInTile(w, tile(0.5, 0)), false);
    assert.equal(isInTile(w, tile(0, 0, 0.5, 0.5)), false);
    assert.equal(isInTile(win(), tile(0, 0)), false);
});

const framed = (
    frame: ReturnType<typeof rect>,
    extra: { minimized?: boolean; maximized?: boolean } = {}
) => {
    const w = {
        frame,
        minimized: extra.minimized ?? false,
        maximized: extra.maximized ?? false,
    };
    assignTile(w, tile(0, 0));
    return w;
};
const view = {
    frameOf: (w: { frame: ReturnType<typeof rect> }) => w.frame,
    isMinimized: (w: { minimized: boolean }) => w.minimized,
};
const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

test('occupyingFrames skips untiled and minimised windows, a tiled maximised one occupies', () => {
    const plain = {
        frame: rect(0, 0, 1, 1),
        minimized: false,
        maximized: false,
    };
    const list = [
        framed(rect(0, 0, 10, 10)),
        framed(rect(20, 0, 10, 10), { minimized: true }),
        framed(rect(40, 0, 10, 10), { maximized: true }),
        plain,
    ];
    assert.deepEqual(occupyingFrames(list, view), [
        rect(0, 0, 10, 10),
        rect(40, 0, 10, 10),
    ]);
});

test('occupyingFrames uses the wanted frame for the dragged window', () => {
    const dragged = framed(rect(0, 0, 10, 10));
    const other = framed(rect(100, 0, 10, 10));
    assert.deepEqual(
        occupyingFrames([dragged, other], view, {
            window: dragged,
            frame: rect(50, 0, 10, 10),
        }),
        [rect(50, 0, 10, 10), rect(100, 0, 10, 10)]
    );
});

test('vacant returns the candidates no occupying frame overlaps', () => {
    const candidates = [rect(0, 0, 50, 100), rect(50, 0, 50, 100)];
    assert.deepEqual(
        vacant(candidates, c => c, [rect(10, 10, 20, 20)], overlap),
        [candidates[1]]
    );
    assert.deepEqual(
        vacant(candidates, c => c, [], overlap),
        candidates
    );
    assert.deepEqual(
        vacant(candidates, c => c, [rect(0, 0, 100, 100)], overlap),
        []
    );
});

test('leftToRight sorts a copy by the left edge', () => {
    const tiles = [tile(0.66, 0, 0.34), tile(0, 0, 0.33), tile(0.33, 0, 0.33)];
    assert.deepEqual(
        leftToRight(tiles).map(t => t.x),
        [0, 0.33, 0.66]
    );
    assert.equal(tiles[0].x, 0.66);
});

test('bestVacantTile is the tile nearest to the centre of the screen', () => {
    const sorted = leftToRight([
        tile(0, 0, 0.33),
        tile(0.33, 0, 0.34),
        tile(0.67, 0, 0.33),
    ]);
    assert.equal(bestVacantTile(sorted)?.x, 0.33);
});

test('bestVacantTile of nothing is undefined, of one tile that tile', () => {
    assert.equal(bestVacantTile([]), undefined);
    const only = tile(0.5, 0);
    assert.equal(bestVacantTile([only]), only);
});

// ---- maximising ----

test('maximising by the window button forgets the tile', () => {
    const w = win();
    assignTile(w, tile(0, 0));
    windowMaximized(w);
    assert.equal(isTiled(w), false);
});

test('maximising by edge or keyboard makes the window tiled in the whole-screen tile', () => {
    const w = win();
    maximizeAsTile(w);
    windowMaximized(w);
    assert.equal(isTiled(w), true);
    assert.deepEqual(tileOf(w), tile(0, 0, 1, 1));
});

test('the wish to keep the tile counts for one maximise only', () => {
    const w = win();
    maximizeAsTile(w);
    windowMaximized(w);
    windowUnmaximized(w);
    windowMaximized(w);
    assert.equal(isTiled(w), false);
});

test('unmaximising brings back the tile the window had before', () => {
    const w = win();
    assignTile(w, tile(0.5, 0));
    maximizeAsTile(w);
    windowMaximized(w);
    windowUnmaximized(w);
    assert.deepEqual(tileOf(w), tile(0.5, 0));
});

test('unmaximising a window that had no tile before leaves it untiled', () => {
    const w = win();
    maximizeAsTile(w);
    windowMaximized(w);
    windowUnmaximized(w);
    assert.equal(isTiled(w), false);
});

test('a tile given while maximised wins over the one from before', () => {
    const w = win();
    assignTile(w, tile(0, 0));
    maximizeAsTile(w);
    windowMaximized(w);
    assignTile(w, tile(0.5, 0));
    windowUnmaximized(w);
    assert.deepEqual(tileOf(w), tile(0.5, 0));
});

test('forgetting the tile while maximised is not undone by unmaximising', () => {
    const w = win();
    assignTile(w, tile(0, 0));
    maximizeAsTile(w);
    windowMaximized(w);
    forgetTile(w);
    windowUnmaximized(w);
    assert.equal(isTiled(w), false);
});

test('unmaximising a window maximised by the window button changes nothing', () => {
    const w = win();
    windowMaximized(w);
    windowUnmaximized(w);
    assert.equal(isTiled(w), false);
});
