/**
 * The one place that answers "how are things scaled on this display?".
 *
 * Logical scaling (the GNOME 50+ default): the shell's theme scale factor stays 1 and
 * monitor and window sizes are already divided by the monitor scale, so widgets need no
 * explicit scaling. Physical scaling: the theme scale factor carries the scale, so widgets
 * must be styled with it. See docs/research/mutter-experimental-features-scaling.md.
 *
 * No GNOME imports here: the shell is reached through a ScaleSource.
 */
export interface ScaleSource {
    themeScale(): number;
    monitorScale(monitorIndex: number): number;
}

export class DisplayScale {
    private readonly _source: ScaleSource;
    private readonly _listeners: Set<() => void>;
    private _lastThemeScale: number;

    constructor(source: ScaleSource) {
        this._source = source;
        this._listeners = new Set();
        this._lastThemeScale = source.themeScale();
    }

    /** True when widgets need an explicit scale (physical scaling). */
    get isScaled(): boolean {
        return this._source.themeScale() !== 1;
    }

    /** The scale to style widgets of this monitor with, or undefined if none is needed. */
    styleScaleOf(monitorIndex: number): number | undefined {
        return this.isScaled ? this.monitorScaleOf(monitorIndex) : undefined;
    }

    /** The effective scale of this monitor, whichever scaling mode is active. */
    monitorScaleOf(monitorIndex: number): number {
        const themeScale = this._source.themeScale();
        if (themeScale === 1) return this._source.monitorScale(monitorIndex);
        return themeScale;
    }

    /** Re-read the source and tell subscribers if the scale changed. */
    refresh(): void {
        const themeScale = this._source.themeScale();
        if (themeScale === this._lastThemeScale) return;
        this._lastThemeScale = themeScale;
        [...this._listeners].forEach(listener => {
            if (this._listeners.has(listener)) listener();
        });
    }

    /** Returns the function that unsubscribes. */
    subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }
}
