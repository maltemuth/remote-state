# 0026. Joining a game is a state transition run by the game

Status: Accepted
Date: 2026-09-29

## Context

When a code is redeemed for an identity the game has no player for yet, the library creates a player ([0020](0020-hosts-admit-players-through-codes.md)). The host has already decided that this person may play; the game's own rules still apply, such as a player limit, or no joining after the game has started.

Joining usually changes the game, too: someone becomes X or O, or takes a seat. Today that takes a separate `join` action after registering, and nothing keeps the library's players and the game's seats consistent ([Player information](../designs/player-information.md)).

## Decision

A game provides a join hook, for example `onJoin(state, player)`. It receives:

- the current full state, including the game's options from `createGame` ([0021](0021-games-created-with-creategame.md))
- the new player's ID
- the identity details the host passed to `admit`, such as a display name; not the identity ID

It returns the new state, or throws to refuse. The library runs it like an action: under the game's lock, with a new `sequence`, stored, diffed per audience and sent to everyone.

If the hook refuses, redeeming the code fails with the game's reason, no player is created, and the code is used up.

## Alternatives considered

- **A check,** such as `canJoin(state, player) → true | reason`. Simpler, but joining the library and joining the game stay two steps, with a moment in which the library has a player the game's state doesn't know.

## Consequences

- A player exists in the library only once the game has accepted them into its state.
- Games learn who joined, and their details, through their own state.
- The `join` actions of the example games go away, and so does the separate `player-joined` socket event: other players see a newcomer through the state update.
- The hook sets the new player's audience ([0027](0027-audiences-set-by-join-hook-and-actions.md)).
- Joining is recorded in the game's history like any action.
