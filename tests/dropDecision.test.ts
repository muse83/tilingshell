import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    decideDrop,
    type DropFacts,
} from '../src/components/tilingsystem/dropDecision.ts';

// a drop that would tile with the tiling system key and nothing else going on
function facts(over: Partial<DropFacts> = {}): DropFacts {
    return {
        tilingSystemKeyHeld: true,
        snapAssisting: false,
        snapAssistLayoutId: undefined,
        edgeTilingInProgress: false,
        edgeNeedsMaximize: false,
        windowCanMaximize: true,
        edgeModeIsDefault: true,
        suggestionsForSnapAssistant: true,
        suggestionsForEdgeTiling: true,
        suggestionsForTilingSystem: true,
        syncLayoutWithSnapAssistant: false,
        pointerOnThisMonitor: true,
        selectionValid: true,
        windowMaximized: false,
        hasTilingLayout: true,
        ...over,
    };
}

test('no active mode: nothing happens', () => {
    const d = decideDrop(facts({ tilingSystemKeyHeld: false }));
    assert.deepEqual(d, { kind: 'nothing' });
});

test('tiling system key alone tiles and opens suggestions with the monitor layout', () => {
    assert.deepEqual(decideDrop(facts()), {
        kind: 'tile',
        suggestions: 'monitorLayout',
        syncMonitorLayout: false,
    });
});

test('tiling system without its suggestions setting tiles without suggestions', () => {
    const d = decideDrop(facts({ suggestionsForTilingSystem: false }));
    assert.deepEqual(d, {
        kind: 'tile',
        suggestions: undefined,
        syncMonitorLayout: false,
    });
});

test('edge tiling in default mode suggests the fixed four quarters', () => {
    const d = decideDrop(
        facts({ tilingSystemKeyHeld: false, edgeTilingInProgress: true })
    );
    assert.deepEqual(d, {
        kind: 'tile',
        suggestions: 'quarters',
        syncMonitorLayout: false,
    });
});

test('edge tiling in another mode suggests the monitor layout', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            edgeTilingInProgress: true,
            edgeModeIsDefault: false,
        })
    );
    assert.equal(d.kind === 'tile' && d.suggestions, 'monitorLayout');
});

test('edge tiling wins over the snap assistant layout for suggestions', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            edgeTilingInProgress: true,
            snapAssisting: true,
            snapAssistLayoutId: 'x',
        })
    );
    assert.equal(d.kind === 'tile' && d.suggestions, 'quarters');
});

test('edge tiling without its suggestions setting tiles without suggestions', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            edgeTilingInProgress: true,
            suggestionsForEdgeTiling: false,
        })
    );
    assert.equal(d.kind === 'tile' && d.suggestions, undefined);
});

test('snap assistant suggests the layout picked there', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            snapAssisting: true,
            snapAssistLayoutId: 'picked',
        })
    );
    assert.deepEqual(d, {
        kind: 'tile',
        suggestions: 'snapAssistLayout',
        syncMonitorLayout: false,
    });
});

test('snap assistant without its suggestions setting tiles without suggestions', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            snapAssisting: true,
            snapAssistLayoutId: 'picked',
            suggestionsForSnapAssistant: false,
        })
    );
    assert.equal(d.kind === 'tile' && d.suggestions, undefined);
});

test('snap assistant whose layout is unknown still tiles but gets no snap suggestions', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            snapAssisting: true,
            snapAssistLayoutId: undefined,
        })
    );
    assert.deepEqual(d, {
        kind: 'tile',
        suggestions: undefined,
        syncMonitorLayout: false,
    });
});

test('snap assistant layout is suggested when only the tiling system setting allows suggestions', () => {
    const d = decideDrop(
        facts({
            snapAssisting: true,
            snapAssistLayoutId: 'picked',
            suggestionsForSnapAssistant: false,
        })
    );
    assert.equal(d.kind === 'tile' && d.suggestions, 'snapAssistLayout');
});

test('layout sync only when the snap assistant layout is known and the setting is on', () => {
    const base = {
        tilingSystemKeyHeld: false,
        snapAssisting: true,
        snapAssistLayoutId: 'picked',
    };
    const on = decideDrop(
        facts({ ...base, syncLayoutWithSnapAssistant: true })
    );
    assert.equal(on.kind === 'tile' && on.syncMonitorLayout, true);
    const off = decideDrop(facts(base));
    assert.equal(off.kind === 'tile' && off.syncMonitorLayout, false);
    const unknown = decideDrop(
        facts({
            ...base,
            snapAssistLayoutId: undefined,
            syncLayoutWithSnapAssistant: true,
        })
    );
    assert.equal(unknown.kind === 'tile' && unknown.syncMonitorLayout, false);
});

test('no tiling layout on the workspace: tile, but no suggestions', () => {
    const d = decideDrop(facts({ hasTilingLayout: false }));
    assert.deepEqual(d, {
        kind: 'tile',
        suggestions: undefined,
        syncMonitorLayout: false,
    });
});

test('top edge drop maximises by edge', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            edgeTilingInProgress: true,
            edgeNeedsMaximize: true,
        })
    );
    assert.deepEqual(d, { kind: 'maximiseByEdge' });
});

test('top edge drop maximises even when the other guards would stop a tile', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            edgeTilingInProgress: true,
            edgeNeedsMaximize: true,
            pointerOnThisMonitor: false,
            selectionValid: false,
            windowMaximized: true,
        })
    );
    assert.deepEqual(d, { kind: 'maximiseByEdge' });
});

test('top edge drop of a window that cannot maximise falls through to tiling', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            edgeTilingInProgress: true,
            edgeNeedsMaximize: true,
            windowCanMaximize: false,
        })
    );
    assert.equal(d.kind, 'tile');
});

test('guards: other monitor, empty selection and maximised window do nothing', () => {
    for (const over of [
        { pointerOnThisMonitor: false },
        { selectionValid: false },
        { windowMaximized: true },
    ]) {
        assert.deepEqual(decideDrop(facts(over)), { kind: 'nothing' });
    }
});

test('guards also stop a drop in edge tiling and snap assistant mode', () => {
    const modes = [
        { tilingSystemKeyHeld: false, edgeTilingInProgress: true },
        {
            tilingSystemKeyHeld: false,
            snapAssisting: true,
            snapAssistLayoutId: 'picked',
        },
    ];
    for (const mode of modes) {
        for (const guard of [
            { pointerOnThisMonitor: false },
            { selectionValid: false },
            { windowMaximized: true },
        ]) {
            assert.deepEqual(decideDrop(facts({ ...mode, ...guard })), {
                kind: 'nothing',
            });
        }
    }
});

test('layout sync and suggestions together after the snap assistant', () => {
    const d = decideDrop(
        facts({
            tilingSystemKeyHeld: false,
            snapAssisting: true,
            snapAssistLayoutId: 'picked',
            syncLayoutWithSnapAssistant: true,
        })
    );
    assert.deepEqual(d, {
        kind: 'tile',
        suggestions: 'snapAssistLayout',
        syncMonitorLayout: true,
    });
});
