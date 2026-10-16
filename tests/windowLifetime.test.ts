import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    liveActor,
    stillAlive,
    connectOnceIfAlive,
} from '../src/components/windowLifetime/windowLifetime.ts';

class FakeActor {
    destroyed = false;
    connected = new Map<number, () => void>();
    disconnected: number[] = [];
    private _nextId = 1;
    is_destroyed() {
        return this.destroyed;
    }
    connect(_signal: string, cb: () => void) {
        const id = this._nextId++;
        this.connected.set(id, cb);
        return id;
    }
    disconnect(id: number) {
        if (this.destroyed) throw new Error('disconnect on disposed actor');
        this.disconnected.push(id);
    }
    emit() {
        [...this.connected.values()].forEach(cb => cb());
    }
}

class FakeWindow {
    actor: FakeActor | null;
    constructor(actor: FakeActor | null = new FakeActor()) {
        this.actor = actor;
    }
    get_compositor_private() {
        return this.actor;
    }
}

test('a live window gives its actor', () => {
    const win = new FakeWindow();
    assert.equal(liveActor(win), win.actor);
});

test('a window detached from its actor (unmanaging) gives nothing', () => {
    const win = new FakeWindow();
    win.actor = null;
    assert.equal(liveActor(win), null);
});

test('a window whose actor is destroyed gives nothing', () => {
    const win = new FakeWindow();
    win.actor!.destroyed = true;
    assert.equal(liveActor(win), null);
});

test('stillAlive is false once the window got another or no actor', () => {
    const win = new FakeWindow();
    const actor = win.actor!;
    assert.equal(stillAlive(win, actor), true);

    win.actor = new FakeActor();
    assert.equal(stillAlive(win, actor), false);

    win.actor = null;
    assert.equal(stillAlive(win, actor), false);
});

test('stillAlive checks ownership before asking the actor', () => {
    const win = new FakeWindow();
    const actor = win.actor!;
    // a disposed actor can throw on any call; it must not be asked
    actor.is_destroyed = () => {
        throw new Error('asked a disposed actor');
    };
    win.actor = null;
    assert.equal(stillAlive(win, actor), false);
});

test('connectOnceIfAlive runs the handler once and disconnects', () => {
    const win = new FakeWindow();
    const actor = win.actor!;
    let calls = 0;
    connectOnceIfAlive(win, 'first-frame', () => calls++);
    actor.emit();
    assert.equal(calls, 1);
    assert.deepEqual(actor.disconnected, [1]);
});

test('connectOnceIfAlive does nothing for a window that is gone', () => {
    const win = new FakeWindow(null);
    assert.equal(
        connectOnceIfAlive(win, 'first-frame', () => {}),
        false
    );
});

test('connectOnceIfAlive does not touch an actor destroyed before the signal', () => {
    const win = new FakeWindow();
    const actor = win.actor!;
    let calls = 0;
    connectOnceIfAlive(win, 'first-frame', () => calls++);
    actor.destroyed = true;
    win.actor = null;
    actor.emit();
    assert.equal(calls, 0);
    assert.deepEqual(actor.disconnected, []);
});
