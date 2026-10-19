import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    canActivateEdgeTiling,
    edgeTileAt,
    type EdgeTileInput,
} from '../src/components/tilingsystem/edgeTilingGeometry.ts';

const workArea = { x: 0, y: 0, width: 1000, height: 800 };
const tile = (x: number, y: number, width: number, height: number) => ({
    x,
    y,
    width,
    height,
});

// With 40% the corner zones are 400x320, so on a 1000x800 area:
// left/right centre zones span y 320..480, the top centre zone spans x 400..600.
const at = (
    pointer: { x: number; y: number },
    extra: Partial<EdgeTileInput> = {}
) =>
    edgeTileAt({
        pointer,
        workArea,
        quarterPercentage: 40,
        mode: 'default',
        tiles: null,
        activeZone: null,
        ...extra,
    });

const rect = (x: number, y: number, width: number, height: number) => ({
    x,
    y,
    width,
    height,
});

describe('canActivateEdgeTiling', () => {
    const can = (x: number, y: number, area = workArea) =>
        canActivateEdgeTiling({ x, y }, area, 16);

    test('is true near each of the four edges', () => {
        assert.equal(can(10, 400), true);
        assert.equal(can(990, 400), true);
        assert.equal(can(500, 5), true);
        assert.equal(can(500, 790), true);
    });

    test('is false in the middle of the work area', () => {
        assert.equal(can(500, 400), false);
    });

    test('uses the edge offset on three sides but a fixed 8px at the top', () => {
        assert.equal(can(500, 8), true);
        assert.equal(can(500, 9), false);
        assert.equal(can(16, 400), true);
        assert.equal(can(17, 400), false);
        assert.equal(can(984, 400), true);
        assert.equal(can(983, 400), false);
        assert.equal(can(500, 784), true);
        assert.equal(can(500, 783), false);
    });

    test('is measured from the work area, not from the screen origin', () => {
        const area = { x: 100, y: 50, width: 1000, height: 800 };
        assert.equal(can(110, 400, area), true);
        assert.equal(can(120, 400, area), false);
        assert.equal(can(500, 55, area), true);
        assert.equal(can(500, 60, area), false);
    });
});

describe('edgeTileAt, default mode', () => {
    test('top centre fills the whole work area', () => {
        const r = at({ x: 500, y: 5 });
        assert.equal(r.changed, true);
        assert.equal(r.zone, 'topCenter');
        assert.deepEqual(r.rect, rect(0, 0, 1000, 800));
    });

    test('left and right centre take a half, full height', () => {
        const left = at({ x: 5, y: 400 });
        assert.equal(left.zone, 'leftCenter');
        assert.deepEqual(left.rect, rect(0, 0, 500, 800));
        const right = at({ x: 995, y: 400 });
        assert.equal(right.zone, 'rightCenter');
        assert.deepEqual(right.rect, rect(500, 0, 500, 800));
    });

    test('each corner takes its quarter', () => {
        const cases = [
            [{ x: 5, y: 5 }, 'topLeft', rect(0, 0, 500, 400)],
            [{ x: 5, y: 795 }, 'bottomLeft', rect(0, 400, 500, 400)],
            [{ x: 995, y: 5 }, 'topRight', rect(500, 0, 500, 400)],
            [{ x: 995, y: 795 }, 'bottomRight', rect(500, 400, 500, 400)],
        ] as const;
        for (const [pointer, zone, expected] of cases) {
            const r = at(pointer);
            assert.equal(r.changed, true);
            assert.equal(r.zone, zone);
            assert.deepEqual(r.rect, expected);
        }
    });

    test('a pointer outside every zone changes nothing and has no zone', () => {
        const r = at({ x: 500, y: 400 });
        assert.equal(r.changed, false);
        assert.equal(r.zone, null);
    });

    test('a pointer outside the work area is clamped onto its border', () => {
        assert.equal(at({ x: -50, y: 400 }).zone, 'leftCenter');
        assert.equal(at({ x: 2000, y: -10 }).zone, 'topRight');
        // the middle of the bottom edge has no zone
        assert.equal(at({ x: 500, y: 5000 }).zone, null);
    });

    test('a smaller threshold makes the corner zones smaller', () => {
        // 10% -> corners are 100 wide, so x=150 on the top edge is top centre
        assert.equal(
            at({ x: 150, y: 5 }, { quarterPercentage: 10 }).zone,
            'topCenter'
        );
        assert.equal(at({ x: 150, y: 5 }).zone, 'topLeft');
    });

    test('follows an offset work area', () => {
        const area = { x: 100, y: 50, width: 1000, height: 800 };
        const r = at({ x: 1095, y: 845 }, { workArea: area });
        assert.equal(r.zone, 'bottomRight');
        assert.deepEqual(r.rect, rect(600, 450, 500, 400));
    });

    test('odd sizes are cut to whole pixels like GNOME rectangles', () => {
        const odd = { x: 0, y: 0, width: 1001, height: 801 };
        const right = at({ x: 995, y: 400 }, { workArea: odd });
        assert.equal(right.zone, 'rightCenter');
        // half is 500 (not 500.5), so the right half starts at 1001 - 500
        assert.deepEqual(right.rect, rect(501, 0, 500, 801));
        const br = at({ x: 995, y: 795 }, { workArea: odd });
        assert.deepEqual(br.rect, rect(501, 401, 500, 400));
    });

    test('is unchanged while the pointer stays in the active zone', () => {
        const r = at({ x: 10, y: 10 }, { activeZone: 'topLeft' });
        assert.equal(r.changed, false);
        assert.equal(r.zone, 'topLeft');
    });

    test('changes when the pointer moves to another zone', () => {
        const r = at({ x: 995, y: 5 }, { activeZone: 'topLeft' });
        assert.equal(r.changed, true);
        assert.equal(r.zone, 'topRight');
    });

    test('ignores the layout in default mode', () => {
        const tiles = [tile(0, 0, 0.3, 1), tile(0.3, 0, 0.7, 1)];
        assert.deepEqual(
            at({ x: 5, y: 400 }, { tiles }).rect,
            rect(0, 0, 500, 800)
        );
    });
});

describe('edgeTileAt, layout based modes', () => {
    // left column A/B (30% wide), middle C, right column D/E (30% wide)
    const tiles = [
        tile(0, 0, 0.3, 0.5),
        tile(0, 0.5, 0.3, 0.5),
        tile(0.3, 0, 0.4, 1),
        tile(0.7, 0, 0.3, 0.5),
        tile(0.7, 0.5, 0.3, 0.5),
    ];

    for (const mode of ['adaptive', 'granular'] as const) {
        describe(mode, () => {
            const go = (
                pointer: { x: number; y: number },
                layout: ReturnType<typeof tile>[] | null = tiles
            ) => at(pointer, { mode, tiles: layout });

            test('top centre still fills the work area', () => {
                assert.deepEqual(
                    go({ x: 500, y: 5 }).rect,
                    rect(0, 0, 1000, 800)
                );
            });

            test('corners snap to the layout tile in that corner', () => {
                assert.deepEqual(go({ x: 5, y: 5 }).rect, rect(0, 0, 300, 400));
                assert.deepEqual(
                    go({ x: 5, y: 795 }).rect,
                    rect(0, 400, 300, 400)
                );
                assert.deepEqual(
                    go({ x: 995, y: 5 }).rect,
                    rect(700, 0, 300, 400)
                );
                assert.deepEqual(
                    go({ x: 995, y: 795 }).rect,
                    rect(700, 400, 300, 400)
                );
                assert.equal(go({ x: 995, y: 795 }).zone, 'bottomRight');
            });

            test('without a layout it behaves like default mode', () => {
                assert.deepEqual(
                    go({ x: 5, y: 400 }, null).rect,
                    rect(0, 0, 500, 800)
                );
                assert.deepEqual(
                    go({ x: 995, y: 795 }, null).rect,
                    rect(500, 400, 500, 400)
                );
            });

            test('missing corner tiles fall back to the quarter', () => {
                const noCorners = [tile(0.2, 0.2, 0.6, 0.6)];
                assert.deepEqual(
                    go({ x: 5, y: 5 }, noCorners).rect,
                    rect(0, 0, 500, 400)
                );
                assert.deepEqual(
                    go({ x: 5, y: 795 }, noCorners).rect,
                    rect(0, 400, 500, 400)
                );
                assert.deepEqual(
                    go({ x: 995, y: 5 }, noCorners).rect,
                    rect(500, 0, 500, 400)
                );
                assert.deepEqual(
                    go({ x: 995, y: 795 }, noCorners).rect,
                    rect(500, 400, 500, 400)
                );
            });

            test('a layout without edge tiles gives top-half quarters at the sides', () => {
                const middleOnly = [tile(0.2, 0.2, 0.6, 0.6)];
                assert.deepEqual(
                    go({ x: 5, y: 400 }, middleOnly).rect,
                    rect(0, 0, 500, 400)
                );
                assert.deepEqual(
                    go({ x: 995, y: 400 }, middleOnly).rect,
                    rect(500, 0, 500, 400)
                );
                assert.deepEqual(
                    go({ x: 5, y: 400 }, []).rect,
                    rect(0, 0, 500, 400)
                );
            });

            test('a tile within 0.01 of the edge counts as touching it', () => {
                const nearly = [
                    tile(0.005, 0, 0.3, 1),
                    tile(0.7, 0, 0.2955, 1),
                ];
                assert.equal(go({ x: 5, y: 5 }, nearly).rect.width, 300);
                assert.equal(go({ x: 995, y: 5 }, nearly).rect.x, 700);
            });

            test('unchanged while in the active zone, zone is kept', () => {
                const r = at(
                    { x: 5, y: 5 },
                    { mode, tiles, activeZone: 'topLeft' }
                );
                assert.equal(r.changed, false);
                assert.equal(r.zone, 'topLeft');
            });
        });
    }

    describe('adaptive', () => {
        const go = (pointer: { x: number; y: number }, layout = tiles) =>
            at(pointer, { mode: 'adaptive', tiles: layout });

        test('side zones snap to the whole column, full height', () => {
            const left = go({ x: 5, y: 400 });
            assert.equal(left.zone, 'leftCenter');
            assert.deepEqual(left.rect, rect(0, 0, 300, 800));
            const right = go({ x: 995, y: 400 });
            assert.equal(right.zone, 'rightCenter');
            assert.deepEqual(right.rect, rect(700, 0, 300, 800));
        });

        test('the column is as wide as its widest tile', () => {
            const uneven = [tile(0, 0, 0.2, 0.5), tile(0, 0.5, 0.3, 0.5)];
            assert.deepEqual(
                go({ x: 5, y: 400 }, uneven).rect,
                rect(0, 0, 300, 800)
            );
        });

        test('the right column starts at its leftmost tile', () => {
            const stacked = [tile(0.5, 0, 0.5, 1), tile(0.8, 0, 0.2, 1)];
            assert.deepEqual(
                go({ x: 995, y: 400 }, stacked).rect,
                rect(500, 0, 500, 800)
            );
        });

        test('only tiles ending at the outermost edge belong to the right column', () => {
            const ragged = [tile(0.6, 0, 0.4, 0.5), tile(0.6, 0.5, 0.395, 0.5)];
            // second tile ends at 0.995, within tolerance, so both count
            assert.deepEqual(
                go({ x: 995, y: 400 }, ragged).rect,
                rect(600, 0, 400, 800)
            );
        });
    });

    describe('granular', () => {
        const go = (pointer: { x: number; y: number }, layout = tiles) =>
            at(pointer, { mode: 'granular', tiles: layout });

        test('side zones snap to the one tile next to the pointer', () => {
            // left centre zone spans y 320..480; relative 0.4 is inside tile A
            assert.deepEqual(go({ x: 5, y: 330 }).rect, rect(0, 0, 300, 400));
            assert.deepEqual(go({ x: 5, y: 470 }).rect, rect(0, 400, 300, 400));
            assert.deepEqual(
                go({ x: 995, y: 330 }).rect,
                rect(700, 0, 300, 400)
            );
            assert.deepEqual(
                go({ x: 995, y: 470 }).rect,
                rect(700, 400, 300, 400)
            );
            assert.equal(go({ x: 5, y: 330 }).zone, 'leftCenter');
        });

        test('on the border between two tiles the first one in the layout wins', () => {
            assert.deepEqual(go({ x: 5, y: 400 }).rect, rect(0, 0, 300, 400));
        });

        test('without a tile under the pointer, the closest tile is used', () => {
            const gap = [tile(0, 0, 0.3, 0.2), tile(0, 0.8, 0.3, 0.2)];
            // y=470 is closer to the lower tile's centre than to the upper
            assert.deepEqual(
                go({ x: 5, y: 470 }, gap).rect,
                rect(0, 640, 300, 160)
            );
            assert.deepEqual(
                go({ x: 5, y: 330 }, gap).rect,
                rect(0, 0, 300, 160)
            );
        });

        test('a tie between two equally close tiles goes to the first', () => {
            const gap = [tile(0, 0, 0.3, 0.2), tile(0, 0.8, 0.3, 0.2)];
            assert.deepEqual(
                go({ x: 5, y: 400 }, gap).rect,
                rect(0, 0, 300, 160)
            );
        });
    });
});

describe('edgeTileAt, seam between corner zones', () => {
    // 50% threshold on an odd width: both top corner zones reach across the middle
    const odd = { x: 0, y: 0, width: 1001, height: 800 };
    const seam = { x: 501, y: 5 };

    test('default mode gives the pointer to the corner of its own screen half', () => {
        const r = at(seam, { workArea: odd, quarterPercentage: 50 });
        assert.equal(r.zone, 'topRight');
    });

    test('layout based modes prefer the left corner', () => {
        const r = at(seam, {
            workArea: odd,
            quarterPercentage: 50,
            mode: 'adaptive',
            tiles: [],
        });
        assert.equal(r.zone, 'topLeft');
    });
});

describe('edgeTileAt, layout modes on odd and offset work areas', () => {
    const tiles = [
        tile(0, 0, 0.3, 0.5),
        tile(0, 0.5, 0.3, 0.5),
        tile(0.7, 0, 0.3, 0.5),
    ];
    const odd = { x: 100, y: 50, width: 1001, height: 801 };

    test('adaptive column and corner tile follow the offset and cut to whole pixels', () => {
        const col = at(
            { x: 105, y: 450 },
            { mode: 'adaptive', tiles, workArea: odd }
        );
        assert.deepEqual(col.rect, rect(100, 50, 300, 801));
        const corner = at(
            { x: 1095, y: 55 },
            { mode: 'adaptive', tiles, workArea: odd }
        );
        assert.deepEqual(corner.rect, rect(800, 50, 300, 400));
    });

    test('granular side tile follows the offset', () => {
        const r = at(
            { x: 105, y: 450 },
            { mode: 'granular', tiles, workArea: odd }
        );
        assert.deepEqual(r.rect, rect(100, 50, 300, 400));
    });

    test('an unknown mode behaves like default mode', () => {
        const r = at({ x: 5, y: 400 }, { mode: 'nonsense' as never, tiles });
        assert.deepEqual(r.rect, rect(0, 0, 500, 800));
    });
});
