import { test } from 'node:test';
import assert from 'node:assert/strict';
import SpacingSettings from '../src/settings/spacingSettings.ts';
import { MemoryStorage } from '../src/settings/storage.ts';

function setup(inner: number, outer: number) {
    const storage = new MemoryStorage();
    const spacing = new SpacingSettings(storage);
    spacing.innerGaps = inner;
    spacing.outerGaps = outer;
    return spacing;
}

test('gaps are the stored value on every side, without a scale factor', () => {
    const spacing = setup(8, 12);
    assert.deepEqual(spacing.getInnerGaps(), {
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
    });
    assert.deepEqual(spacing.getOuterGaps(), {
        top: 12,
        bottom: 12,
        left: 12,
        right: 12,
    });
});

test('gaps are multiplied by the scale factor of the caller', () => {
    const spacing = setup(8, 12);
    assert.equal(spacing.getInnerGaps(2).left, 16);
    assert.equal(spacing.getOuterGaps(1.5).top, 18);
});

test('gaps change is announced to a connected listener until disconnected', () => {
    const spacing = setup(8, 12);
    let calls = 0;
    const id = spacing.connect(spacing.keys.INNER_GAPS, () => calls++);
    spacing.innerGaps = 10;
    spacing.innerGaps = 10; // unchanged: no announcement
    assert.equal(calls, 1);
    spacing.disconnect(id);
    spacing.innerGaps = 11;
    assert.equal(calls, 1);
});
