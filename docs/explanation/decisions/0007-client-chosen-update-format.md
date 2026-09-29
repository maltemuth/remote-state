# 0007. Clients choose the format of state updates

Status: Accepted; how GET offers the choice is refined by [0009](0009-separate-state-and-update-endpoints.md), and the patch formats for games with hidden information by [0010](0010-every-game-has-hidden-information.md). How patches are produced is superseded by [0011](0011-patches-are-diffs-of-views.md): they're diffs of views, not recorded by Immer. How they're stored is superseded by [0012](0012-store-player-diffs.md). The set of formats is reduced to whole state and Immer patches by [0014](0014-immer-patches-only-external-format.md).
Date: 2026-09-29

## Context

Clients differ in what they need from state updates. Some want to replace their copy of the state, which is simplest. Others want only what changed, to save bandwidth or to render just the affected parts. Of those, some use Immer, as Redux Toolkit does, and others use a general JSON Patch library. The [State synchronization](../designs/state-synchronization.md) proposal discusses the options. Changes are to be produced with Immer's recorded patches, not by diffing states.

## Decision

Each client chooses one of three formats for the state it receives:

- **Whole state:** the player's full view.
- **JSON Patch:** standard RFC 6902 operations, with paths as JSON Pointer strings such as `/board/4/4`.
- **Immer patches:** Immer's own patch objects, with paths as arrays such as `["board", 4, 4]`.

The choice applies to socket subscriptions and to every GET endpoint that returns state; both accept the same format options. Immer runs only on the server. Clients receive plain JSON, and need Immer only if they choose its format.

## Alternatives considered

- **A single format for everyone.** Simpler to build, but it either wastes bandwidth and loses the change information (whole state only), or requires every client to apply patches (patches only).
- **JSON Patch only, without Immer's format.** Immer clients could convert the paths themselves. Offering Immer's format as well costs the server little, since that's what it records anyway.

## Consequences

- **Patches must be stored.** To answer "everything since sequence n" in a patch format, the history keeps the patches recorded for each state alongside its snapshot. They can't be recomputed later without diffing.
- **Every update message says what it contains**, whole state or patches, and the `sequence` it applies to and produces. A client whose copy isn't at a patch's base receives a whole state instead.
- **Patch formats depend on the game.** Patches are recorded on the full state, so they can leak hidden information. Games with hidden information can offer only the whole-state format, until the proposal settles how patches are filtered per player.
- **`executeAction` must change an Immer draft** for patches to exist. That's still an open question in the proposal.
