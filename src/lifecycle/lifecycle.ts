export interface Part {
    name: string;
    /** names of the parts that must be running before this one starts */
    dependsOn?: string[];
    start(): void;
    stop(): void;
}

/**
 * Starts parts in dependency order and stops them in reverse. Parts with no
 * order between them start in the order they were given. A failed start stops
 * the failed part and the parts already started, then rethrows the error.
 */
export class Lifecycle {
    private readonly _order: Part[];
    private _running: Part[] = [];

    constructor(parts: Part[]) {
        this._order = Lifecycle._sort(parts);
    }

    private static _sort(parts: Part[]): Part[] {
        const byName = new Map<string, Part>();
        for (const part of parts) {
            if (byName.has(part.name))
                throw new Error(`duplicate part "${part.name}"`);
            byName.set(part.name, part);
        }
        const sorted: Part[] = [];
        const done = new Set<string>();
        const visiting = new Set<string>();
        const visit = (part: Part) => {
            if (done.has(part.name)) return;
            if (visiting.has(part.name))
                throw new Error(`dependency cycle at "${part.name}"`);
            visiting.add(part.name);
            for (const dep of part.dependsOn ?? []) {
                const depPart = byName.get(dep);
                if (!depPart)
                    throw new Error(
                        `"${part.name}" depends on unknown part "${dep}"`
                    );
                visit(depPart);
            }
            visiting.delete(part.name);
            done.add(part.name);
            sorted.push(part);
        };
        parts.forEach(visit);
        return sorted;
    }

    /** names of the running parts, in start order */
    get running(): string[] {
        return this._running.map(p => p.name);
    }

    start(): void {
        if (this._running.length > 0) this.stop();
        for (const part of this._order) {
            try {
                // counted as running before it starts, so a half-started part is
                // stopped too; every stop must cope with a part that never finished
                this._running.push(part);
                part.start();
            } catch (error) {
                try {
                    this.stop();
                } catch {
                    // the start error is the one worth reporting
                }
                throw error;
            }
        }
    }

    /** stops every running part, even if one fails; then rethrows the first error */
    stop(): void {
        const errors: unknown[] = [];
        const running = this._running;
        this._running = [];
        for (const part of running.reverse()) {
            try {
                part.stop();
            } catch (error) {
                errors.push(error);
            }
        }
        if (errors.length > 0) throw errors[0];
    }
}
