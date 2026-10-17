# 0056. Views and patches are computed when they're sent, not stored

Status: Accepted
Date: 2026-10-17

## Context

Every transition stored one diff per audience next to the full state ([0012](0012-store-player-diffs.md), [0024](0024-views-per-audience.md)), so that `GET …/updates` could join them. To store them, the server built every audience's views of the two states and diffed them inside the transaction, whether or not anyone of that audience was connected. The publisher then reused them.

That made sending as expensive as storing. With [0054](0054-wal-without-syncing-every-commit.md), diffing was a third of the server's time under load, and the load test's clients, in the `state` format, never received a patch. The stored diffs were only read when a client caught up, and catching up already rebuilt views from stored states whenever a player had changed audience ([0035](0035-updates-across-audiences.md)).

## Decision

- **Only full states are stored,** with their actions, as before. The per-audience diffs and their table are gone.
- **The publisher computes views and patches after the commit,** only for the audiences of the sockets connected, and once per audience: a view for the `state` format, a patch for `immer`.
- **Catching up builds its patch from the stored states,** the player's view at `since` and their current one, as it did across audience changes.

## Alternatives considered

- **Keeping the stored diffs, and computing them after the commit.** Moves the work out of the transaction but doesn't save it.
- **Keeping recent diffs in memory for catching up.** Faster catch-up, which isn't on any hot path; can come with [Games in memory](../designs/games-in-memory.md).

## Consequences

- Under full load, the same Windows desktop handled about 283 actions per second instead of 133, and at human pace the median latency fell from 8.8 ms to 4.9 ms ([measurements](../../reference/performance.md)).
- A transition nobody is connected to costs no view or diff at all.
- Catching up costs two state reads, two views and one diff, however many steps it spans. Before, it read one row per step.
- Catching up from a sequence whose state is gone redirects to the whole state, also without an audience change.
- A view filter that throws no longer fails the action: it's recorded, and the error is logged when it's sent. Filters were already required to be pure functions of the state and the audience.
- Databases from earlier versions have to be deleted ([0048](0048-no-database-upgrades-before-1-0.md)).
