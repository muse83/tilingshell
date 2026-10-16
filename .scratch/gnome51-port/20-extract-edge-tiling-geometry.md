# 20 Extract edge tiling geometry as a pure module

Status: open
Blocked by: none

## Problem
`components/tilingsystem/edgeTilingManager.ts` (898 lines) mixes pure geometry with Settings
reads inside a GObject class. Three near-parallel strategy methods: default (~238), adaptive
(~321), granular (~493). Untested. No recent bugs, so low urgency.

## Goal
Pointer position + monitor work area + settings snapshot in, zone out, as a module testable
without GNOME.

## Scope
Grill the interface first; one module covering the three strategies; tests for each.

## Done when
The geometry runs under `node --test`, edge tiling behaviour unchanged in the dev stack.

## Source
`docs/research/architecture-review-2026-10-16.md`, candidate 5 (Speculative).
