import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    DisplayScale,
    type ScaleSource,
} from '../src/components/displayScale/displayScale.ts';

const source = (themeScale: number, monitorScales: number[] = [1, 1]) => {
    const state = { themeScale, monitorScales };
    const src: ScaleSource = {
        themeScale: () => state.themeScale,
        monitorScale: i => state.monitorScales[i],
    };
    return { state, src };
};

test('logical scaling (theme scale 1): nothing needs explicit scaling', () => {
    const { src } = source(1, [2, 1]);
    const scale = new DisplayScale(src);
    assert.equal(scale.isScaled, false);
    assert.equal(scale.styleScaleOf(0), undefined);
    assert.equal(scale.styleScaleOf(1), undefined);
});

test('logical scaling: monitorScaleOf reports the compositor scale of that monitor', () => {
    const { src } = source(1, [2, 1.5]);
    const scale = new DisplayScale(src);
    assert.equal(scale.monitorScaleOf(0), 2);
    assert.equal(scale.monitorScaleOf(1), 1.5);
});

test('physical scaling (theme scale != 1): every monitor gets the theme scale', () => {
    const { src } = source(2, [1, 1]);
    const scale = new DisplayScale(src);
    assert.equal(scale.isScaled, true);
    assert.equal(scale.styleScaleOf(0), 2);
    assert.equal(scale.styleScaleOf(1), 2);
    assert.equal(scale.monitorScaleOf(1), 2);
});

test('refresh without a change does not notify', () => {
    const { src } = source(1);
    const scale = new DisplayScale(src);
    let calls = 0;
    scale.subscribe(() => calls++);
    scale.refresh();
    assert.equal(calls, 0);
});

test('switching between logical and physical scaling notifies and updates answers', () => {
    const { state, src } = source(1);
    const scale = new DisplayScale(src);
    let calls = 0;
    scale.subscribe(() => calls++);

    state.themeScale = 2;
    scale.refresh();
    assert.equal(calls, 1);
    assert.equal(scale.isScaled, true);
    assert.equal(scale.styleScaleOf(0), 2);

    state.themeScale = 1;
    scale.refresh();
    assert.equal(calls, 2);
    assert.equal(scale.isScaled, false);
    assert.equal(scale.styleScaleOf(0), undefined);
});

test('changing the physical scale (2 to 3) notifies too', () => {
    const { state, src } = source(2);
    const scale = new DisplayScale(src);
    let calls = 0;
    scale.subscribe(() => calls++);
    state.themeScale = 3;
    scale.refresh();
    assert.equal(calls, 1);
    assert.equal(scale.styleScaleOf(0), 3);
});

test('answers are live: they follow the source even before refresh', () => {
    const { state, src } = source(1);
    const scale = new DisplayScale(src);
    state.themeScale = 2;
    assert.equal(scale.styleScaleOf(0), 2);
});

test('unsubscribe stops notifications, other subscribers keep theirs', () => {
    const { state, src } = source(1);
    const scale = new DisplayScale(src);
    let a = 0;
    let b = 0;
    const unsubscribeA = scale.subscribe(() => a++);
    scale.subscribe(() => b++);
    unsubscribeA();
    state.themeScale = 2;
    scale.refresh();
    assert.equal(a, 0);
    assert.equal(b, 1);
});

test('a subscriber that unsubscribes while being notified does not break the others', () => {
    const { state, src } = source(1);
    const scale = new DisplayScale(src);
    let b = 0;
    const unsubscribeA = scale.subscribe(() => unsubscribeA());
    scale.subscribe(() => b++);
    state.themeScale = 2;
    scale.refresh();
    assert.equal(b, 1);
});

test('subscribers see the new scale when notified', () => {
    const { state, src } = source(1);
    const scale = new DisplayScale(src);
    let seen: number | undefined;
    scale.subscribe(() => (seen = scale.styleScaleOf(0)));
    state.themeScale = 2;
    scale.refresh();
    assert.equal(seen, 2);
});
