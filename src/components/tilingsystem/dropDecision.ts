// What happens when a dragged window is dropped: facts in, decision out, nothing stored.
// Free of any GNOME API at runtime so it can be tested with plain Node (ADR 0007).

export interface DropFacts {
    tilingSystemKeyHeld: boolean;
    snapAssisting: boolean;
    // the layout picked in the snap assistant; undefined when it is not (or no longer) known
    snapAssistLayoutId: string | undefined;
    edgeTilingInProgress: boolean;
    edgeNeedsMaximize: boolean;
    windowCanMaximize: boolean;
    edgeModeIsDefault: boolean;
    suggestionsForSnapAssistant: boolean;
    suggestionsForEdgeTiling: boolean;
    suggestionsForTilingSystem: boolean;
    syncLayoutWithSnapAssistant: boolean;
    pointerOnThisMonitor: boolean;
    // the previewed selection has a positive width and height
    selectionValid: boolean;
    windowMaximized: boolean;
    // the workspace has a tiling layout to open suggestions on
    hasTilingLayout: boolean;
}

// Which layout the window suggestions are laid out on.
export type SuggestionsLayout =
    'quarters' | 'monitorLayout' | 'snapAssistLayout';

export type DropDecision =
    | { kind: 'nothing' }
    | { kind: 'maximiseByEdge' }
    | {
          kind: 'tile';
          suggestions: SuggestionsLayout | undefined;
          syncMonitorLayout: boolean;
      };

export function decideDrop(f: DropFacts): DropDecision {
    if (!f.tilingSystemKeyHeld && !f.snapAssisting && !f.edgeTilingInProgress)
        return { kind: 'nothing' };

    // the edge maximise comes before the guards below, as before
    if (f.edgeTilingInProgress && f.edgeNeedsMaximize && f.windowCanMaximize)
        return { kind: 'maximiseByEdge' };

    if (!f.pointerOnThisMonitor || !f.selectionValid || f.windowMaximized)
        return { kind: 'nothing' };

    const snapLayoutKnown = f.snapAssistLayoutId !== undefined;
    const suggestionsAllowed =
        (snapLayoutKnown && f.suggestionsForSnapAssistant) ||
        (f.edgeTilingInProgress && f.suggestionsForEdgeTiling) ||
        (f.tilingSystemKeyHeld && f.suggestionsForTilingSystem);

    let suggestions: SuggestionsLayout | undefined;
    if (f.hasTilingLayout && suggestionsAllowed) {
        if (f.edgeTilingInProgress)
            suggestions = f.edgeModeIsDefault ? 'quarters' : 'monitorLayout';
        else
            suggestions = snapLayoutKnown
                ? 'snapAssistLayout'
                : 'monitorLayout';
    }

    return {
        kind: 'tile',
        suggestions,
        syncMonitorLayout: snapLayoutKnown && f.syncLayoutWithSnapAssistant,
    };
}
