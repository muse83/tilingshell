import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lifecycle, type Part } from '../src/lifecycle/lifecycle.ts';

const fake = (
    log: string[],
    name: string,
    dependsOn: string[] = [],
    opts: { failStart?: boolean; failStop?: boolean } = {}
): Part => ({
    name,
    dependsOn,
    start() {
        log.push(`start ${name}`);
        if (opts.failStart) throw new Error(`${name} start`);
    },
    stop() {
        log.push(`stop ${name}`);
        if (opts.failStop) throw new Error(`${name} stop`);
    },
});

test('parts start after their dependencies and stop in reverse', () => {
    const log: string[] = [];
    const life = new Lifecycle([
        fake(log, 'b', ['a']),
        fake(log, 'c', ['b']),
        fake(log, 'a'),
    ]);
    life.start();
    life.stop();
    assert.deepEqual(log, [
        'start a',
        'start b',
        'start c',
        'stop c',
        'stop b',
        'stop a',
    ]);
});

test('parts without an order between them start as given', () => {
    const log: string[] = [];
    const life = new Lifecycle([
        fake(log, 'x'),
        fake(log, 'y'),
        fake(log, 'z'),
    ]);
    life.start();
    assert.deepEqual(life.running, ['x', 'y', 'z']);
});

test('a failed start stops the parts already started and rethrows', () => {
    const log: string[] = [];
    const life = new Lifecycle([
        fake(log, 'a'),
        fake(log, 'b', ['a'], { failStart: true }),
        fake(log, 'c', ['b']),
    ]);
    assert.throws(() => life.start(), /b start/);
    assert.deepEqual(log, ['start a', 'start b', 'stop a']);
    assert.deepEqual(life.running, []);
});

test('a failing stop does not keep the other parts running', () => {
    const log: string[] = [];
    const life = new Lifecycle([
        fake(log, 'a'),
        fake(log, 'b', ['a'], { failStop: true }),
        fake(log, 'c', ['b']),
    ]);
    life.start();
    log.length = 0;
    assert.throws(() => life.stop(), /b stop/);
    assert.deepEqual(log, ['stop c', 'stop b', 'stop a']);
});

test('start while running restarts; stop twice stops nothing more', () => {
    const log: string[] = [];
    const life = new Lifecycle([fake(log, 'a')]);
    life.start();
    life.start();
    assert.deepEqual(log, ['start a', 'stop a', 'start a']);
    life.stop();
    life.stop();
    assert.equal(log.filter(l => l === 'stop a').length, 2);
});

test('unknown dependencies, cycles and duplicates are rejected', () => {
    const log: string[] = [];
    assert.throws(() => new Lifecycle([fake(log, 'a', ['nope'])]), /unknown/);
    assert.throws(
        () => new Lifecycle([fake(log, 'a', ['b']), fake(log, 'b', ['a'])]),
        /cycle/
    );
    assert.throws(
        () => new Lifecycle([fake(log, 'a'), fake(log, 'a')]),
        /duplicate/
    );
});
