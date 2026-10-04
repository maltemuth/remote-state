# 0033. Clients wait for the server before showing an action's result

Status: Accepted
Date: 2026-10-04

## Context

A client could show the result of its own action before the server confirms it, to save a round trip. It could run the game's rules itself, which doesn't work with hidden information ([0010](0010-every-game-has-hidden-information.md)), since the client doesn't have the full state; or use a prediction per action that the game provides, rolled back when the server's update arrives or the action is rejected.

## Decision

Clients don't apply actions before the server confirms them. The store changes only through updates from the server.

## Alternatives considered

- **Running the game's rules on the client.** Instant, but only for games where every player sees everything the rules need.
- **Predictions per action, provided by the game.** Instant for any game, but every game writes and maintains a second, client-side version of its rules, and the client must match predictions to server updates, which the action response didn't support at the time ([0032](0032-action-response-without-body.md)).

## Consequences

- The client's store always holds a state the server sent; nothing is rolled back.
- Each action takes a round trip before its result is shown, which suits turn-based games.
- Games write their rules once, for the server.
- Fast-paced games would need this revisited.
