# 0040. Games schedule actions, and hosts can act as the system

Status: Accepted
Date: 2026-10-04

## Context

Every state change was triggered by a player's request, so a game couldn't end a turn when time runs out, run a clock, or move for a computer player ([Server-initiated actions](../designs/server-initiated-actions.md)). The proposal compared actions scheduled by the game (A), a periodic tick (B), and an entry point for the host (C).

## Decision

- **Games schedule actions** (A). The join hook and `executeAction` can return timers along with the new state; the library runs each timer's action when it's due ([0041](0041-named-timers.md)).
- **Hosts can act as the system** (C). The host API gets `act(gameId, action)`, for example for computer players run by the host, or events from outside the game.
- **Both run like any action:** under the game's lock, through `validateAction` and `executeAction`, recorded in the history and sent to clients.
- **The system's player ID is `"system"`,** exported as `SYSTEM`. Player IDs are UUIDs, so it can't clash with a real player. Games recognize it in `validateAction` and `executeAction`. The history records system actions without a player.

## Alternatives considered

- **A periodic tick** (B). Its cost grows with the number of games, and timing is only as precise as the interval. Scheduled actions cover the same needs.
- **Only a host entry point** (C alone). Every host would have to build scheduling and restarts itself, and time-based rules would live outside the game.
- **`null` as the system's player ID.** Changes the type of `playerId` for every game.

## Consequences

- Time-based rules stay inside the game, next to the rules they belong to.
- A game must decide in its rules what the system may do; an action from `"system"` that the rules don't expect is rejected like any other.
- A host can't impersonate a player through `act`: it acts as the system.
