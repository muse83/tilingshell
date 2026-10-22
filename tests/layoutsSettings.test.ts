import { test } from 'node:test';
import assert from 'node:assert/strict';
import LayoutsSettings, {
    KEY_LAYOUTS_JSON,
    KEY_SELECTED_LAYOUTS,
    SIGNAL_LAYOUTS_CHANGED,
    SIGNAL_SELECTED_CHANGED,
    defaultLayouts,
} from '../src/settings/layoutsSettings.ts';
import { MemoryStorage } from '../src/settings/storage.ts';

const one = (id: string) => ({
    id,
    tiles: [{ x: 0, y: 0, width: 1, height: 1, groups: [1] }],
});

function setup(stored?: string) {
    const storage = new MemoryStorage();
    if (stored !== undefined) storage.setString(KEY_LAYOUTS_JSON, stored);
    return { storage, settings: new LayoutsSettings(storage) };
}

test('empty storage is repaired to the default layouts and written back', () => {
    const { storage, settings } = setup();
    assert.deepEqual(settings.layouts, defaultLayouts());
    assert.equal(
        storage.getString(KEY_LAYOUTS_JSON),
        JSON.stringify(defaultLayouts())
    );
});

test('broken JSON is repaired to the default layouts', () => {
    const { settings } = setup('{not json');
    assert.deepEqual(settings.layouts, defaultLayouts());
});

test('an empty list is repaired to the default layouts', () => {
    const { settings } = setup('[]');
    assert.deepEqual(settings.layouts, defaultLayouts());
});

test('layouts without tiles are dropped, valid ones are kept', () => {
    const { settings } = setup(
        JSON.stringify([one('a'), { id: 'empty', tiles: [] }, one('b')])
    );
    assert.deepEqual(
        settings.layouts.map(l => l.id),
        ['a', 'b']
    );
});

test('writing layouts updates them and notifies listeners once', () => {
    const { settings } = setup();
    let calls = 0;
    settings.connect(SIGNAL_LAYOUTS_CHANGED, () => calls++);
    settings.setLayouts([one('x')]);
    assert.deepEqual(
        settings.layouts.map(l => l.id),
        ['x']
    );
    assert.equal(calls, 1);
});

test('a change written by another process is reloaded and announced', () => {
    const { storage, settings } = setup();
    const seen: string[][] = [];
    settings.connect(SIGNAL_LAYOUTS_CHANGED, () =>
        seen.push(settings.layouts.map(l => l.id))
    );
    // the preferences window writes the key directly into the shared storage
    storage.setString(KEY_LAYOUTS_JSON, JSON.stringify([one('p')]));
    assert.deepEqual(seen, [['p']]);
});

test('broken data written from outside is repaired and announced once', () => {
    const { storage, settings } = setup();
    let calls = 0;
    settings.connect(SIGNAL_LAYOUTS_CHANGED, () => calls++);
    storage.setString(KEY_LAYOUTS_JSON, 'garbage');
    assert.equal(calls, 1);
    assert.deepEqual(settings.layouts, defaultLayouts());
    assert.equal(
        storage.getString(KEY_LAYOUTS_JSON),
        JSON.stringify(defaultLayouts())
    );
});

test('resetLayouts brings back the default layouts', () => {
    const { settings } = setup(JSON.stringify([one('x')]));
    settings.resetLayouts();
    assert.deepEqual(settings.layouts, defaultLayouts());
});

test('selected layouts round trip; an empty list resets the key', () => {
    const { storage, settings } = setup();
    assert.deepEqual(settings.selected, []);
    settings.setSelected([['a', 'b'], ['c']]);
    assert.deepEqual(settings.selected, [['a', 'b'], ['c']]);
    settings.setSelected([]);
    assert.deepEqual(settings.selected, []);
    assert.deepEqual(storage.getStringLists(KEY_SELECTED_LAYOUTS), []);
});

test('selected layouts changes are announced, layout listeners stay quiet', () => {
    const { settings } = setup();
    let selected = 0;
    let layouts = 0;
    settings.connect(SIGNAL_SELECTED_CHANGED, () => selected++);
    settings.connect(SIGNAL_LAYOUTS_CHANGED, () => layouts++);
    settings.setSelected([['a']]);
    assert.equal(selected, 1);
    assert.equal(layouts, 0);
});

test('a disconnected listener is no longer called, destroy stops everything', () => {
    const { settings } = setup();
    let calls = 0;
    const id = settings.connect(SIGNAL_LAYOUTS_CHANGED, () => calls++);
    settings.disconnect(id);
    settings.setLayouts([one('x')]);
    assert.equal(calls, 0);

    settings.connect(SIGNAL_LAYOUTS_CHANGED, () => calls++);
    settings.destroy();
    settings.setLayouts([one('y')]);
    assert.equal(calls, 0);
});

test('writing the same selected layouts again is no change', () => {
    const { settings } = setup();
    let calls = 0;
    settings.connect(SIGNAL_SELECTED_CHANGED, () => calls++);
    settings.setSelected([['a']]);
    settings.setSelected([['a']]);
    assert.equal(calls, 1);
});
