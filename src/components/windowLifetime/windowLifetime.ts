// One place that answers "is this window still alive, and what is its actor?".
// A closed window is detached from its actor and the actor is destroyed; touching the actor
// after that makes mutter dereference a null pointer and crashes the whole shell.
// Free of any GNOME API so it can be tested with plain Node.

interface LifetimeActor {
    is_destroyed(): boolean;
    connect(signal: string, callback: () => void): number;
    disconnect(id: number): void;
}

interface LifetimeWindow {
    get_compositor_private(): unknown;
}

/** The window's actor, or null when the window is gone (unmanaging or destroyed). */
export function liveActor<A = LifetimeActor>(window: LifetimeWindow): A | null {
    const actor = window.get_compositor_private() as
        (A & LifetimeActor) | null | undefined;
    if (!actor || actor.is_destroyed()) return null;
    return actor;
}

/**
 * For callbacks that run later: is `actor` still the live actor of `window`?
 * Ownership is compared first because calling any method on an already disposed actor
 * can itself throw.
 */
export function stillAlive(
    window: LifetimeWindow,
    actor: Pick<LifetimeActor, 'is_destroyed'>
): boolean {
    return window.get_compositor_private() === actor && !actor.is_destroyed();
}

/**
 * Calls `handler` the first time `actor` emits `signal`, then disconnects.
 * Returns false (and connects nothing) when the window is already gone. If the window died
 * before the signal arrived, the handler is skipped and nothing is disconnected on the dead actor.
 */
export function connectOnceIfAlive(
    window: LifetimeWindow,
    signal: string,
    handler: () => void
): boolean {
    const actor = liveActor<LifetimeActor>(window);
    if (!actor) return false;
    const id = actor.connect(signal, () => {
        if (!stillAlive(window, actor)) return;
        actor.disconnect(id);
        handler();
    });
    return true;
}
