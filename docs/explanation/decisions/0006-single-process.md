# 0006. Run as a single process for now

Status: Accepted
Date: 2026-09-29

## Context

Three parts of the server keep state in memory: the per-game lock, Socket.IO's rooms, and the SQLite database file. Running several server processes would break all three. There are no known requirements for high availability, zero-downtime deploys, or more capacity than one process provides. Turn-based games need little CPU per action.

## Decision

The server runs as one process with SQLite. Support for multiple processes won't be built until there's a concrete requirement.

## Alternatives considered

- **Routing each game to a fixed process.** It keeps the in-memory lock and rooms working, but needs a load balancer that routes by game ID.
- **Shared infrastructure.** Postgres, locking in the database instead of in memory, and a Socket.IO adapter that relays events between processes. This is the full solution, and the most work.
- **Optimistic concurrency now.** Instead of the lock: retry an action when its write collides on the unique `(game_id, sequence)` index. It would help with one process or many, but it isn't needed yet.

## Consequences

- A crash or a deploy takes the service down briefly.
- The unique `(game_id, sequence)` index still protects the data if two processes ever write to one game. The second write fails; the state isn't corrupted.
- This decision should be revisited once availability or scaling requirements are known. The open questions are in [Known limitations](../limitations.md).
