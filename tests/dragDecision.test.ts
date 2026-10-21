import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    decideDrag,
    type DragFacts,
    type DragState,
} from '../src/components/tilingsystem/dropDecision.ts';

const idle: DragState = {
    tilingSystemKeyHeld: false,
    spanKeyHeld: false,
    pointer: { x: 10, y: 10 },
};

// the pointer moved, no key held, all features on, pointer far from every edge
function facts(over: Partial<DragFacts> = {}): DragFacts {
    return {
        previous: idle,
        pointer: { x: 20, y: 20 },
        windowMovable: true,
        pointerOnThisMonitor: true,
        tilingSystemKeyHeld: false,
        tilingSystemDeactivationKeyHeld: false,
        spanKeyHeld: false,
        tilingSystemEnabled: true,
        spanMultipleTilesEnabled: true,
        activeScreenEdgesEnabled: true,
        snapAssistEnabled: true,
        snapAssisting: false,
        pointerNearEdge: false,
        ...over,
    };
}

test('window that cannot move or resize closes everything', () => {
    const r = decideDrag(facts({ windowMovable: false }));
    assert.deepEqual(r.decision, { kind: 'closeAll' });
    assert.deepEqual(r.state, idle);
});

test('pointer on another monitor closes everything, even with the key held', () => {
    const r = decideDrag(
        facts({ pointerOnThisMonitor: false, tilingSystemKeyHeld: true })
    );
    assert.deepEqual(r.decision, { kind: 'closeAll' });
    assert.deepEqual(r.state, idle);
});

test('same keys and same pointer: nothing to do, state kept', () => {
    const r = decideDrag(facts({ pointer: { x: 10, y: 10 } }));
    assert.deepEqual(r.decision, { kind: 'unchanged' });
    assert.deepEqual(r.state, idle);
});

test('first tick without a last pointer is never "unchanged"', () => {
    const r = decideDrag(
        facts({
            previous: { ...idle, pointer: null },
            snapAssistEnabled: false,
        })
    );
    assert.deepEqual(r.decision, { kind: 'showNothing' });
});

test('tiling system key pressed without moving shows the layout', () => {
    const r = decideDrag(
        facts({ pointer: { x: 10, y: 10 }, tilingSystemKeyHeld: true })
    );
    assert.deepEqual(r.decision, {
        kind: 'showLayout',
        allowSpanMultipleTiles: false,
        changedSpanMultipleTiles: false,
    });
    assert.deepEqual(r.state, {
        tilingSystemKeyHeld: true,
        spanKeyHeld: false,
        pointer: { x: 10, y: 10 },
    });
});

test('key change is ignored while the tiling system is disabled', () => {
    const r = decideDrag(
        facts({
            pointer: { x: 10, y: 10 },
            tilingSystemKeyHeld: true,
            tilingSystemEnabled: false,
        })
    );
    assert.deepEqual(r.decision, { kind: 'unchanged' });
});

test('moving with the key held shows the layout', () => {
    const r = decideDrag(
        facts({
            previous: { ...idle, tilingSystemKeyHeld: true },
            tilingSystemKeyHeld: true,
        })
    );
    assert.equal(r.decision.kind, 'showLayout');
});

test('layout stays hidden while the tiling system is disabled', () => {
    const r = decideDrag(
        facts({ tilingSystemKeyHeld: true, tilingSystemEnabled: false })
    );
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('deactivation key hides the layout', () => {
    const r = decideDrag(
        facts({
            tilingSystemKeyHeld: true,
            tilingSystemDeactivationKeyHeld: true,
        })
    );
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('span key with the setting on allows spanning and reports the change', () => {
    const r = decideDrag(
        facts({
            previous: { ...idle, tilingSystemKeyHeld: true },
            tilingSystemKeyHeld: true,
            spanKeyHeld: true,
        })
    );
    assert.deepEqual(r.decision, {
        kind: 'showLayout',
        allowSpanMultipleTiles: true,
        changedSpanMultipleTiles: true,
    });
});

test('releasing the span key reports the change without allowing spanning', () => {
    const r = decideDrag(
        facts({
            previous: { ...idle, tilingSystemKeyHeld: true, spanKeyHeld: true },
            tilingSystemKeyHeld: true,
            pointer: { x: 10, y: 10 },
        })
    );
    assert.deepEqual(r.decision, {
        kind: 'showLayout',
        allowSpanMultipleTiles: false,
        changedSpanMultipleTiles: true,
    });
});

test('span key with the setting off neither spans nor counts as a change', () => {
    const r = decideDrag(
        facts({
            tilingSystemKeyHeld: true,
            spanKeyHeld: true,
            spanMultipleTilesEnabled: false,
        })
    );
    assert.deepEqual(r.decision, {
        kind: 'showLayout',
        allowSpanMultipleTiles: false,
        changedSpanMultipleTiles: false,
    });
});

test('span key alone with the setting off and no move does nothing', () => {
    const r = decideDrag(
        facts({
            pointer: { x: 10, y: 10 },
            spanKeyHeld: true,
            spanMultipleTilesEnabled: false,
        })
    );
    assert.deepEqual(r.decision, { kind: 'unchanged' });
});

test('near an edge without the layout shows the edge preview', () => {
    const r = decideDrag(facts({ pointerNearEdge: true }));
    assert.deepEqual(r.decision, { kind: 'showEdgePreview' });
});

test('edge tiling disabled falls through to the snap assistant', () => {
    const r = decideDrag(
        facts({ pointerNearEdge: true, activeScreenEdgesEnabled: false })
    );
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('an active snap assistant wins over the edge preview', () => {
    const r = decideDrag(facts({ pointerNearEdge: true, snapAssisting: true }));
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('away from edges the snap assistant takes over', () => {
    assert.deepEqual(decideDrag(facts()).decision, {
        kind: 'showSnapAssistant',
    });
});

test('snap assistant disabled: only edge tiling gets cleaned up', () => {
    const r = decideDrag(facts({ snapAssistEnabled: false }));
    assert.deepEqual(r.decision, { kind: 'showNothing' });
});

test('the layout wins over the edge preview', () => {
    const r = decideDrag(
        facts({ tilingSystemKeyHeld: true, pointerNearEdge: true })
    );
    assert.equal(r.decision.kind, 'showLayout');
});

test('deactivation key with the tiling system disabled shows no layout', () => {
    const r = decideDrag(
        facts({
            tilingSystemKeyHeld: true,
            tilingSystemDeactivationKeyHeld: true,
            tilingSystemEnabled: false,
        })
    );
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('deactivation key wins over the span key', () => {
    const r = decideDrag(
        facts({
            tilingSystemKeyHeld: true,
            tilingSystemDeactivationKeyHeld: true,
            spanKeyHeld: true,
        })
    );
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('span key change without the tiling system key still acts', () => {
    const r = decideDrag(
        facts({ pointer: { x: 10, y: 10 }, spanKeyHeld: true })
    );
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('moving with the tiling system key change ignored (setting off) still acts', () => {
    const r = decideDrag(
        facts({ tilingSystemKeyHeld: true, tilingSystemEnabled: false })
    );
    assert.deepEqual(r.decision, { kind: 'showSnapAssistant' });
});

test('edge preview wins over a disabled snap assistant', () => {
    const r = decideDrag(
        facts({ pointerNearEdge: true, snapAssistEnabled: false })
    );
    assert.deepEqual(r.decision, { kind: 'showEdgePreview' });
});
