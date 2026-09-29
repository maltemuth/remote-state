# 0030. `GET …/updates` answers in one jump, from any `since`

Status: Accepted
Date: 2026-09-29

## Context

`GET /api/games/:gameId/updates?since=<sequence>` returns what changed for the player after `since` ([0009](0009-separate-state-and-update-endpoints.md), [0029](0029-sequence-is-the-cursor.md)). Diffs are stored per audience for every action ([0012](0012-store-player-diffs.md), [0024](0024-views-per-audience.md)). The endpoint could return each step's diff, or one patch from `since` to the current state; and it could refuse a `since` that's too old.

## Decision

The endpoint returns one patch, from the player's view at `since` to their current view, with the current `sequence`. It's the stored diffs after `since` of the player's audience, concatenated.

There's no limit on how old `since` may be: all diffs are kept.

## Alternatives considered

- **Step by step,** one diff per action. Clients could animate each missed move, but a client that was away for long receives many small updates, and has to apply them in order.
- **A limit on `since`,** with a whole state beyond it. Would allow pruning old diffs, which isn't needed for now ([Known limitations](../limitations.md)).

## Consequences

- A catching-up client applies a single patch, the same way as a live update.
- Intermediate steps aren't available to clients through this endpoint, for example to animate missed moves.
- The patch is correct but not minimal: a value changed several times appears once per change.
- A jump can only be built if the player was in the same audience throughout. When they weren't, or `since` is before they joined, the client needs the whole state from `GET …/state` ([0024](0024-views-per-audience.md)).
- Diffs are never pruned, so their storage keeps growing with the game.
