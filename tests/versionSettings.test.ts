import { test } from 'node:test';
import assert from 'node:assert/strict';
import VersionSettings, {
    KEY_LAST_VERSION_NAME_INSTALLED,
} from '../src/settings/versionSettings.ts';
import { MemoryStorage } from '../src/settings/storage.ts';

function setup(lastVersion: string, cycle: string[] = []) {
    const storage = new MemoryStorage();
    if (lastVersion)
        storage.setString(KEY_LAST_VERSION_NAME_INSTALLED, lastVersion);
    storage.setStrv('cycle-layouts', cycle);
    return { storage, version: new VersionSettings(storage) };
}

test('first run records the running version and migrates from it', () => {
    const { storage, version } = setup('0', ['<Super>a']);
    version.migrate('17.3');
    assert.equal(storage.getString(KEY_LAST_VERSION_NAME_INSTALLED), '17.3');
    // already at 17.3: no cycle layouts change
    assert.deepEqual(storage.getStrv('cycle-layouts-backward'), []);
});

test('first run without a known running version keeps 0', () => {
    const { storage, version } = setup('0');
    version.migrate(undefined);
    assert.equal(storage.getString(KEY_LAST_VERSION_NAME_INSTALLED), '0');
});

test('17.0 keeps the custom window border if the border was enabled', () => {
    const { storage, version } = setup('17.0');
    storage.setBoolean('enable-window-border', true);
    version.migrate('17.3');
    assert.equal(storage.getBoolean('window-use-custom-border-color'), true);
});

test('17.0 does not enable the custom border if the border was off', () => {
    const { storage, version } = setup('17.0');
    storage.setBoolean('window-use-custom-border-color', true);
    version.migrate('17.3');
    assert.equal(storage.getBoolean('window-use-custom-border-color'), false);
});

test('a version other than 17.3 gets the backwards cycle layouts keybinding', () => {
    const { storage, version } = setup('17.0', ['<Super>Tab']);
    version.migrate('17.3');
    assert.deepEqual(storage.getStrv('cycle-layouts-backward'), [
        '<Shift><Super>Tab',
    ]);
});

test('an older version gets the backwards keybinding, no border change', () => {
    const { storage, version } = setup('16.0', ['<Super>Tab']);
    version.migrate('17.3');
    assert.deepEqual(storage.getStrv('cycle-layouts-backward'), [
        '<Shift><Super>Tab',
    ]);
    assert.equal(storage.getBoolean('window-use-custom-border-color'), false);
});

test('version 17.3 changes nothing', () => {
    const { storage, version } = setup('17.3', ['<Super>Tab']);
    version.migrate('17.3');
    assert.deepEqual(storage.getStrv('cycle-layouts-backward'), []);
    assert.equal(storage.getBoolean('window-use-custom-border-color'), false);
});

test('first run of an old version records it and migrates in the same call', () => {
    const { storage, version } = setup('0', ['<Super>Tab']);
    storage.setBoolean('enable-window-border', true);
    version.migrate('17.0');
    assert.equal(storage.getString(KEY_LAST_VERSION_NAME_INSTALLED), '17.0');
    assert.equal(storage.getBoolean('window-use-custom-border-color'), true);
    assert.deepEqual(storage.getStrv('cycle-layouts-backward'), [
        '<Shift><Super>Tab',
    ]);
});

test('without a cycle layouts keybinding only <Shift> is written (kept as before)', () => {
    const { storage, version } = setup('16.0');
    version.migrate('17.3');
    assert.deepEqual(storage.getStrv('cycle-layouts-backward'), ['<Shift>']);
});

test('a backwards keybinding set by the user is overwritten (kept as before)', () => {
    const { storage, version } = setup('16.0', ['<Super>Tab']);
    storage.setStrv('cycle-layouts-backward', ['<Super>grave']);
    version.migrate('17.3');
    assert.deepEqual(storage.getStrv('cycle-layouts-backward'), [
        '<Shift><Super>Tab',
    ]);
});
