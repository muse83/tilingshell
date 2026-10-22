// The spacing group of the settings module (ADR 0008): gaps between and around tiles. The scale
// factor comes from the caller; the group knows no monitor.
// Free of any GNOME API so it can be tested with plain Node.
import SettingsGroup from './settingsGroup.ts';

export type Gaps = {
    top: number;
    bottom: number;
    left: number;
    right: number;
};

const KEYS = {
    INNER_GAPS: 'inner-gaps',
    OUTER_GAPS: 'outer-gaps',
} as const;

export default class SpacingSettings extends SettingsGroup {
    readonly keys = KEYS;

    get innerGaps(): number {
        return this._storage.getNumber(KEYS.INNER_GAPS);
    }

    set innerGaps(val: number) {
        this._storage.setNumber(KEYS.INNER_GAPS, val);
    }

    get outerGaps(): number {
        return this._storage.getNumber(KEYS.OUTER_GAPS);
    }

    set outerGaps(val: number) {
        this._storage.setNumber(KEYS.OUTER_GAPS, val);
    }

    // gaps in pixels for the given scale factor
    getInnerGaps(scaleFactor: number = 1): Gaps {
        return this._gaps(this.innerGaps * scaleFactor);
    }

    getOuterGaps(scaleFactor: number = 1): Gaps {
        return this._gaps(this.outerGaps * scaleFactor);
    }

    private _gaps(value: number): Gaps {
        return { top: value, bottom: value, left: value, right: value };
    }
}
