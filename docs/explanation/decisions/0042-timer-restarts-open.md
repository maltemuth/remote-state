# 0042. What happens to timers on a restart is still open

Status: Accepted, refined by [0052](0052-games-pause-on-restart.md)
Date: 2026-10-04

## Context

[0041](0041-named-timers.md) decided that pending timers are stored and start over with their full duration when the server restarts. Whether that's right isn't settled: it depends on the games, for example a turn timeout versus a game clock that must account for real elapsed time, and on whether players should keep, lose or regain their time over a restart.

## Decision

How timers behave across a restart remains a design question, in the [Server-initiated actions](../designs/server-initiated-actions.md) proposal. Until it's decided, timers are kept in memory only: pending timers are lost when the server stops.

The rest of 0041 stands: timers are named per game, scheduling a name again replaces it, actions can cancel timers, and due timers run as the system through the usual validation.

## Alternatives considered

- **Storing timers and restarting them with their full duration,** as decided in 0041. Committing to one restart behavior before the question is settled.

## Consequences

- Timers need no table yet.
- A restart silently drops pending timers: a game waiting for a timeout waits until a player acts.
- The restart behavior, and storing timers, are decided later, with a new record.
