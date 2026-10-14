import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseRememberedFrames,
    placeRestored,
    rememberClosing,
    type ClosingWindow,
} from '../src/components/windowMemory/frameMemory.ts';

const frame = { x: 10, y: 20, width: 800, height: 600 };

test('loading keeps valid entries including tile and maximised flag', () => {
    const tile = { x: 0, y: 0, width: 0.5, height: 1, groups: [1, 2] };
    const raw = JSON.stringify({
        'org.gnome.Nautilus': { frame, tile },
        firefox: { frame, maximized: true },
    });

    assert.deepEqual(parseRememberedFrames(raw), {
        'org.gnome.Nautilus': { frame, tile },
        firefox: { frame, maximized: true },
    });
});

test('loading drops corrupt entries and survives unreadable data', () => {
    assert.deepEqual(parseRememberedFrames('not json'), {});
    assert.deepEqual(parseRememberedFrames('[1,2]'), {});
    assert.deepEqual(parseRememberedFrames('null'), {});

    const raw = JSON.stringify({
        ok: { frame },
        noFrame: {},
        zeroSize: { frame: { ...frame, width: 0 } },
        textCoordinate: { frame: { ...frame, x: 'left' } },
        brokenTile: { frame, tile: { x: 0, y: 0, width: 1, height: 1 } },
        notAnObject: 5,
    });

    assert.deepEqual(parseRememberedFrames(raw), { ok: { frame } });
});

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
const free: ClosingWindow = { frame, maximized: false, workArea };
const halfTile = { x: 0, y: 0, width: 0.5, height: 1, groups: [1] };

test('a free window is remembered by its frame', () => {
    assert.deepEqual(rememberClosing({}, 'app', free), { app: { frame } });
});

test('a tiled window keeps the size it had before tiling', () => {
    const before = { x: 300, y: 200, width: 700, height: 500 };
    const closing = {
        ...free,
        frame: { x: 0, y: 0, width: 960, height: 1080 },
        tile: halfTile,
        sizeBeforeTile: before,
    };

    assert.deepEqual(rememberClosing({}, 'app', closing), {
        app: { frame: before, tile: halfTile },
    });
});

test('a tiled window of unknown free size reuses the earlier free frame', () => {
    const earlier = { app: { frame } };
    const closing = {
        ...free,
        frame: { x: 0, y: 0, width: 960, height: 1080 },
        tile: halfTile,
    };

    assert.deepEqual(rememberClosing(earlier, 'app', closing), {
        app: { frame, tile: halfTile },
    });
});

test('a tiled window of unknown free size without history gets a centred free frame', () => {
    const closing = {
        ...free,
        frame: { x: 0, y: 0, width: 960, height: 1080 },
        tile: halfTile,
    };

    const { app } = rememberClosing({}, 'app', closing);

    assert.deepEqual(app.frame, { x: 240, y: 135, width: 1440, height: 810 });
    assert.deepEqual(app.tile, halfTile);
});

test('a maximised window without history comes back smaller than the work area', () => {
    const closing = { ...free, frame: workArea, maximized: true };

    const { app } = rememberClosing({}, 'app', closing);

    assert.equal(app.maximized, true);
    assert.ok(app.frame.width < workArea.width);
    assert.ok(app.frame.height < workArea.height);
    assert.ok(app.frame.x >= 0 && app.frame.x + app.frame.width <= 1920);
});

test('a maximised window keeps the free frame from before', () => {
    const closing = { ...free, frame: workArea, maximized: true };

    assert.deepEqual(rememberClosing({ app: { frame } }, 'app', closing), {
        app: { frame, maximized: true },
    });
});

test('the least recently used apps are dropped beyond 200', () => {
    let entries = {};
    for (let i = 0; i < 201; i++)
        entries = rememberClosing(entries, `app${i}`, free);

    const ids = Object.keys(entries);
    assert.equal(ids.length, 200);
    assert.ok(!ids.includes('app0'));
    assert.equal(ids[ids.length - 1], 'app200');
});

test('closing an app again makes it the most recent', () => {
    let entries = rememberClosing({}, 'a', free);
    entries = rememberClosing(entries, 'b', free);
    entries = rememberClosing(entries, 'a', free);

    assert.deepEqual(Object.keys(entries), ['b', 'a']);
});

const left = { x: 0, y: 0, width: 1920, height: 1080 };
const right = { x: 1920, y: 0, width: 1920, height: 1080 };

test('a frame inside a work area stays where it was', () => {
    assert.deepEqual(placeRestored({ frame }, [left], []), {
        frame,
        monitorIndex: 0,
    });
});

test('a frame from a vanished monitor lands on the nearest one', () => {
    const away = { x: 5000, y: 100, width: 800, height: 600 };

    const placed = placeRestored({ frame: away }, [left, right], []);

    assert.equal(placed.monitorIndex, 1);
    assert.deepEqual(placed.frame, {
        x: 3040,
        y: 100,
        width: 800,
        height: 600,
    });
});

test('a frame bigger than the work area is shrunk to it', () => {
    const huge = { x: -50, y: -50, width: 4000, height: 3000 };

    assert.deepEqual(placeRestored({ frame: huge }, [left], []).frame, left);
});

test('the monitor is the one the frame is placed on', () => {
    const onRight = { x: 2000, y: 50, width: 500, height: 400 };

    assert.equal(
        placeRestored({ frame: onRight }, [left, right], []).monitorIndex,
        1
    );
});

test('a window of the same app on the same spot makes the new one cascade', () => {
    const placed = placeRestored(
        { frame },
        [left],
        [frame, { ...frame, x: 40, y: 50 }]
    );

    assert.deepEqual(placed.frame, { ...frame, x: 70, y: 80 });
});

test('a tiled entry is not cascaded', () => {
    const tile = { x: 0, y: 0, width: 0.5, height: 1, groups: [] };

    assert.deepEqual(
        placeRestored({ frame, tile }, [left], [frame]).frame,
        frame
    );
});

test('without monitors the frame is returned unchanged', () => {
    assert.deepEqual(placeRestored({ frame }, [], []), {
        frame,
        monitorIndex: 0,
    });
});
