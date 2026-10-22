import { test } from 'node:test';
import assert from 'node:assert/strict';
import BehaviourSettings, {
    ActivationKey,
    EdgeTilingMode,
} from '../src/settings/behaviourSettings.ts';
import { MemoryStorage } from '../src/settings/storage.ts';

test('an empty activation key reads as the default of that key', () => {
    const behaviour = new BehaviourSettings(new MemoryStorage());
    assert.equal(behaviour.tilingSystemActivationKey, ActivationKey.CTRL);
    assert.equal(behaviour.tilingSystemDeactivationKey, ActivationKey.NONE);
    assert.equal(behaviour.spanMultipleTilesActivationKey, ActivationKey.ALT);
});

test('a stored activation key reads back', () => {
    const behaviour = new BehaviourSettings(new MemoryStorage());
    behaviour.tilingSystemActivationKey = ActivationKey.SUPER;
    assert.equal(behaviour.tilingSystemActivationKey, ActivationKey.SUPER);
    behaviour.tilingSystemDeactivationKey = ActivationKey.NONE;
    assert.equal(behaviour.tilingSystemDeactivationKey, ActivationKey.NONE);
});

test('an unknown or missing edge tiling mode reads as the default mode', () => {
    const storage = new MemoryStorage();
    const behaviour = new BehaviourSettings(storage);
    assert.equal(behaviour.edgeTilingMode, EdgeTilingMode.DEFAULT);
    storage.setString(behaviour.keys.EDGE_TILING_MODE, 'nonsense');
    assert.equal(behaviour.edgeTilingMode, EdgeTilingMode.DEFAULT);
    behaviour.edgeTilingMode = EdgeTilingMode.GRANULAR;
    assert.equal(behaviour.edgeTilingMode, EdgeTilingMode.GRANULAR);
});

test('switches and numbers round trip through the storage', () => {
    const behaviour = new BehaviourSettings(new MemoryStorage());
    behaviour.raiseTogether = true;
    behaviour.snapAssistantThreshold = -5;
    assert.equal(behaviour.raiseTogether, true);
    assert.equal(behaviour.snapAssistantThreshold, -5);
});
