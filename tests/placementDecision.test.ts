import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    decidePlacement,
    type NewWindow,
    type PlacementContext,
} from '../src/components/windowPlacement/placementDecision.ts';

const frame = { x: 300, y: 200, width: 500, height: 350 };
const tile = { x: 0, y: 0, width: 0.5, height: 1, groups: [] };
const left = { x: 0, y: 0, width: 1920, height: 1080 };
const right = { x: 1920, y: 0, width: 1920, height: 1080 };
// where the left half tile ends up in pixels on the left monitor
const leftHalf = { x: 8, y: 40, width: 944, height: 1032 };

const window: NewWindow = {
    placeable: true,
    appId: 'org.example.App',
    canMoveResize: true,
    minimized: false,
    maximized: false,
    monitorIndex: 0,
};

function context(over: Partial<PlacementContext> = {}): PlacementContext {
    return {
        rememberEnabled: true,
        autoTilingEnabled: false,
        entries: {},
        workAreas: [left, right],
        sameAppFrames: [],
        tileRect: () => leftHalf,
        ...over,
    };
}

const remembered = (entry: object) => ({ 'org.example.App': entry });

test('a window without entry stays where the application put it', () => {
    assert.deepEqual(decidePlacement(window, context()), { kind: 'leave' });
});

test('a window without entry is auto-tiled when auto-tiling is on', () => {
    assert.deepEqual(
        decidePlacement(window, context({ autoTilingEnabled: true })),
        { kind: 'auto-tile' }
    );
});

test('the remembered entry wins over auto-tiling', () => {
    const decision = decidePlacement(
        window,
        context({ autoTilingEnabled: true, entries: remembered({ frame }) })
    );

    assert.equal(decision.kind, 'restore');
});

test('with the memory off the entry is ignored and auto-tiling applies', () => {
    const decision = decidePlacement(
        window,
        context({
            rememberEnabled: false,
            autoTilingEnabled: true,
            entries: remembered({ frame }),
        })
    );

    assert.deepEqual(decision, { kind: 'auto-tile' });
});

test('a window that cannot be moved or resized is not restored', () => {
    const decision = decidePlacement(
        { ...window, canMoveResize: false },
        context({ autoTilingEnabled: true, entries: remembered({ frame }) })
    );

    assert.deepEqual(decision, { kind: 'auto-tile' });
});

test('dialogs and other windows that do not count are left alone', () => {
    const decision = decidePlacement(
        { ...window, placeable: false },
        context({ autoTilingEnabled: true, entries: remembered({ frame }) })
    );

    assert.deepEqual(decision, { kind: 'leave' });
});

test('a window without application id has no entry but can be auto-tiled', () => {
    const decision = decidePlacement(
        { ...window, appId: null },
        context({ autoTilingEnabled: true, entries: remembered({ frame }) })
    );

    assert.deepEqual(decision, { kind: 'auto-tile' });
});

test('minimised or maximised windows are not auto-tiled', () => {
    const ctx = context({ autoTilingEnabled: true });

    assert.deepEqual(decidePlacement({ ...window, minimized: true }, ctx), {
        kind: 'leave',
    });
    assert.deepEqual(decidePlacement({ ...window, maximized: true }, ctx), {
        kind: 'leave',
    });
});

test('a remembered free frame is restored on the monitor it lies on', () => {
    const onRight = { x: 2000, y: 50, width: 500, height: 400 };

    assert.deepEqual(
        decidePlacement(window, context({ entries: remembered({ frame }) })),
        { kind: 'restore', frame, monitorIndex: 0 }
    );
    assert.deepEqual(
        decidePlacement(
            window,
            context({ entries: remembered({ frame: onRight }) })
        ),
        { kind: 'restore', frame: onRight, monitorIndex: 1 }
    );
});

test('a frame from a vanished monitor is moved onto the nearest one', () => {
    const away = { x: 9000, y: 100, width: 500, height: 400 };

    assert.deepEqual(
        decidePlacement(
            window,
            context({ entries: remembered({ frame: away }) })
        ),
        {
            kind: 'restore',
            frame: { ...away, x: 3340 },
            monitorIndex: 1,
        }
    );
});

test('a second window of the same app is cascaded, not put on top', () => {
    const decision = decidePlacement(
        window,
        context({ entries: remembered({ frame }), sameAppFrames: [frame] })
    );

    assert.deepEqual(decision, {
        kind: 'restore',
        frame: { ...frame, x: 330, y: 230 },
        monitorIndex: 0,
    });
});

test('a remembered tile is restored, the free frame is kept for dragging out', () => {
    const decision = decidePlacement(
        window,
        context({ entries: remembered({ frame, tile }) })
    );

    assert.deepEqual(decision, {
        kind: 'restore',
        frame,
        monitorIndex: 0,
        tile,
    });
});

test('a tile of an app with an unknown free size uses the monitor of the window', () => {
    const decision = decidePlacement(
        { ...window, monitorIndex: 1 },
        context({ entries: remembered({ tile }) })
    );

    assert.deepEqual(decision, { kind: 'restore', monitorIndex: 1, tile });
});

test('a tile already taken by the same app gives a cascaded, untiled window', () => {
    const decision = decidePlacement(
        window,
        context({
            entries: remembered({ frame, tile }),
            sameAppFrames: [leftHalf],
        })
    );

    assert.deepEqual(decision, {
        kind: 'restore',
        frame: { ...leftHalf, x: 38, y: 48 },
        monitorIndex: 0,
    });
});

test('a tile taken only by another app is used as remembered', () => {
    // windows of other apps are not part of the context at all
    const decision = decidePlacement(
        window,
        context({ entries: remembered({ frame, tile }), sameAppFrames: [] })
    );

    assert.equal(decision.kind === 'restore' && decision.tile?.width, 0.5);
});

test('a remembered maximised window is restored maximised', () => {
    assert.deepEqual(
        decidePlacement(
            window,
            context({ entries: remembered({ frame, maximized: true }) })
        ),
        { kind: 'restore', frame, monitorIndex: 0, maximized: true }
    );
});

test('a remembered window maximised as tile is restored maximised and tiled', () => {
    const whole = { x: 0, y: 0, width: 1, height: 1, groups: [] };
    assert.deepEqual(
        decidePlacement(
            window,
            context({
                entries: remembered({ frame, tile: whole, maximized: true }),
            })
        ),
        {
            kind: 'restore',
            frame,
            monitorIndex: 0,
            tile: whole,
            maximized: true,
        }
    );
});
