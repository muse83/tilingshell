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

// What a dragged window shows on every drag tick (ADR 0007, second entry function).

export interface DragState {
    // key states and pointer position the last tick acted on
    tilingSystemKeyHeld: boolean;
    spanKeyHeld: boolean;
    pointer: { x: number; y: number } | null;
}

export interface DragFacts {
    previous: DragState;
    pointer: { x: number; y: number };
    // the window can be moved and resized
    windowMovable: boolean;
    pointerOnThisMonitor: boolean;
    tilingSystemKeyHeld: boolean;
    tilingSystemDeactivationKeyHeld: boolean;
    spanKeyHeld: boolean;
    tilingSystemEnabled: boolean;
    spanMultipleTilesEnabled: boolean;
    activeScreenEdgesEnabled: boolean;
    snapAssistEnabled: boolean;
    snapAssisting: boolean;
    // the pointer is close enough to a screen edge to start edge tiling
    pointerNearEdge: boolean;
}

export type DragDecision =
    // another monitor or a window that cannot move or resize: hide everything
    | { kind: 'closeAll' }
    // keys and pointer are as in the last tick: do no work
    | { kind: 'unchanged' }
    | {
          kind: 'showLayout';
          allowSpanMultipleTiles: boolean;
          changedSpanMultipleTiles: boolean;
      }
    | { kind: 'showEdgePreview' }
    | { kind: 'showSnapAssistant' }
    // layout hidden, and neither the edge preview nor the snap assistant is shown
    | { kind: 'showNothing' };

export interface DragResult {
    decision: DragDecision;
    state: DragState;
}

export function decideDrag(f: DragFacts): DragResult {
    if (!f.windowMovable || !f.pointerOnThisMonitor)
        return { decision: { kind: 'closeAll' }, state: f.previous };

    const changedSpanMultipleTiles =
        f.spanMultipleTilesEnabled && f.spanKeyHeld !== f.previous.spanKeyHeld;
    const changedShowTilingSystem =
        f.tilingSystemEnabled &&
        f.tilingSystemKeyHeld !== f.previous.tilingSystemKeyHeld;
    if (
        !changedSpanMultipleTiles &&
        !changedShowTilingSystem &&
        f.pointer.x === f.previous.pointer?.x &&
        f.pointer.y === f.previous.pointer?.y
    )
        return { decision: { kind: 'unchanged' }, state: f.previous };

    const state: DragState = {
        tilingSystemKeyHeld: f.tilingSystemKeyHeld,
        spanKeyHeld: f.spanKeyHeld,
        pointer: f.pointer,
    };

    const showLayout =
        f.tilingSystemEnabled &&
        f.tilingSystemKeyHeld &&
        !f.tilingSystemDeactivationKeyHeld;
    if (showLayout) {
        return {
            decision: {
                kind: 'showLayout',
                allowSpanMultipleTiles:
                    f.spanMultipleTilesEnabled && f.spanKeyHeld,
                changedSpanMultipleTiles,
            },
            state,
        };
    }

    if (f.activeScreenEdgesEnabled && !f.snapAssisting && f.pointerNearEdge)
        return { decision: { kind: 'showEdgePreview' }, state };

    return {
        decision: {
            kind: f.snapAssistEnabled ? 'showSnapAssistant' : 'showNothing',
        },
        state,
    };
}
