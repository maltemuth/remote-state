# 0013. Also store diffs of the full state

Status: Accepted
Date: 2026-09-29

## Context

Each action stores the new full state ([0011](0011-patches-are-diffs-of-views.md)) and the diff of every player's view ([0012](0012-store-player-diffs.md)). What changed in the full state can only be found by comparing two stored snapshots. That information is likely to be useful later: for debugging, for reviewing a game move by move, or for features that don't exist yet, such as replays.

## Decision

For every accepted action, the server also computes the diff between the previous and the new full state, with `rfc6902`, and stores it with the new state in JSON Patch format.

It's informational only. The full states remain the source of truth, and nothing in synchronization depends on these diffs.

## Alternatives considered

- **Not storing them,** and comparing snapshots when needed. Nothing is lost, since the snapshots are stored, but every use repeats the work.

## Consequences

- **One more diff per action.** That's small next to the per-player diffs.
- **They contain hidden information,** like the full state itself. They must never be sent to clients, through any endpoint or socket event, and need the same care as the full state in logs.
- **They're not guaranteed minimal.** As with the player diffs, `rfc6902` produces correct patches, not always the smallest ones.
