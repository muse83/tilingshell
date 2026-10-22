# Which fork commits suit an upstream pull request

Date: 2026-10-22. Basis: the 47 commits of `gnome51-port` since the merge-base with upstream
`main`, compared with upstream `main` at version 18.0 (`5c3c052`). Upstream's
`CONTRIBUTING.md` asks for an issue first, small pull requests, a test on GNOME 50 and 51, a demo
video for behaviour changes and passing lint.

## Starting facts

- Upstream 18.0 already has "GNOME 51 support" and "GNOME 50 support". The port commits are
  therefore mostly obsolete as a contribution.
- Upstream still supports GNOME 42 and up and X11. The fork drops both (ADR 0001). Anything
  resting on that decision is fork-only.
- Fork and upstream both changed 22 of the same files (among them `tilingManager.ts`,
  `extension.ts`, `prefs.ts`, `settings.ts`, `globalState.ts`, `snapAssist.ts`,
  `keybindings.ts`, `tilingLayout.ts`). Every candidate below must be re-applied on top of 18.0
  and will need conflict work in those files. This note is a sort by purpose and fit, not a
  check that the patches apply. Nothing was cherry-picked yet.

## A. Offer upstream (small, independent, user-visible)

| Commits | What | Notes |
|---|---|---|
| `8ac9635`, `043bee2`, `4b6b607`, `957b21f` | Window memory per app (size, position, tile), hardened and with a testable decision module | The one real feature. Needs a demo video. Squash into one branch. Touches settings schema, prefs, `tilingManager.ts`. Depends on the tile state module (see C) only for the maximise rule; check how much. |
| `4c19bd4` | Guards for missing windows and displays | Pure bug fixes, easy to review. |
| `957620e`, `d4e8d32` | Skip suggestion callbacks for a window already gone (crash fix) | Pure bug fix. Check whether 18.0 already fixed it. |
| `fa8af0a` (part) | Editor resize cursor on GNOME 51 | Check against 18.0 first, probably already fixed. Drop the scrollbar and monitor-name fallbacks part, those assume GNOME 50+. |
| `10cc523` | Scaling mode derived from theme scale factor | Fixes fractional-scaling detection on GNOME 50. Check against 18.0. |
| `c0261ae` | Edge and keyboard maximise count as tiled | Behaviour change, needs a video. Tied to the tile state module, so likely hard to separate. |

## B. Obsolete as a contribution

`e1c8e34` (GNOME 51), `f22a28b` (typing of suggestion preview and border colour for GNOME 51),
`3ea2e05` (release 17.3.1), `a803e83` (leftovers of the port review). Upstream has its own 18.0.

## C. Fork-only (depend on dropping X11 and old GNOME, or are a large restructuring)

Offer only after upstream says it wants them, and only as a discussion in an issue.

- Dropping old GNOME and X11: `1aeec57`, `5cf1fcc`.
- Structure and tests: `2cb7887` (window lifetime), `c09b42e` (window placement),
  `352c3d3` (tile state), `39f5325`, `fea41ec` (display scale), `cf805e4` (edge tile geometry,
  moves 800 lines out of `edgeTilingManager.ts`), `bd621cc`, `240908b` (drop and drag decision),
  `db89ae2`, `936a634`, `4854d6e` (settings groups replace the wide settings class),
  `b03c149`, `808f55d`, `f53f94d` (start and stop order).
- These reshape 63 of 78 original files. Upstream gets a merge conflict on every later change of
  its own. The settings and start-order commits are the largest and the most intrusive.
- Build and quality: `8e7a351` (pin typings), `33e34ef` (typecheck gaps), `4792c19` (Prettier
  over all of `src`; a formatting-only diff over the whole tree is the opposite of a small pull
  request).

## D. Do not send

Project-internal material: `103731a`, `4ee1c53`, `517d4b3`, `59089f6`, `7b678bb`, `a394fcf`,
`0346e33`, `795aae0`, `fbebe78`, `777d0d4`, `6c6755a` (architecture review, ADRs, `CLAUDE.md`,
glossary), `037c7c2`, `e5aace5`, `83cc2f3` (dev stack for a Wayland test session in this fork).

## Suggested order

1. Open an upstream issue: describe window memory per app, offer a pull request, ask whether the
   restructuring is of interest at all.
2. Branch from upstream `main` (18.0). Bring over window memory (group A) as one branch, then the
   bug fixes as one or two further branches. Test on GNOME 50 and 51, record a video, run lint.
3. Check each bug fix of group A against 18.0 first; drop what is already fixed.

## Open

- Whether upstream accepts AI-assisted code is unknown; read its contribution notes and the
  GNOME extension review guidelines before sending anything.
- Whether the window memory feature depends on the tile state module is unchecked.
