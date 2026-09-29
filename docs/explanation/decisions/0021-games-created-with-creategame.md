# 0021. Hosts create games with `createGame`, separately from admitting players

Status: Accepted
Date: 2026-09-29

## Context

Hosts admit people to games through single-use codes ([0020](0020-hosts-admit-players-through-codes.md)), and the library's public endpoint for creating games is removed. Today, creating a game also creates its first player, with the `admin` role, and returns that player's token. Something has to replace it.

## Decision

The host creates a game by calling `createGame(options)` on the server object, which returns the new game's ID. It creates no player. The host then admits people to the game with `admit`, including whoever asked for the game to be created.

## Alternatives considered

- **`admit` creating the game when it's given no game ID.** One call instead of two, but `admit` would do two different things, and a host couldn't create a game without admitting someone to it, for example for a scheduled tournament.

## Consequences

- A game can exist with no players, until the host admits someone.
- There's no longer a creator known to the library, and no automatic `admin` role. Whether the creator has special powers is up to the game ([0022](0022-roles-belong-to-game-state.md)).
- What `options` contains is part of the [Game options](../designs/game-options.md) proposal.
