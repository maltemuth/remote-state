# 0027. Audiences are set by the join hook and by actions

Status: Accepted
Date: 2026-09-29

## Context

Each player belongs to one audience, stored on the player ([0024](0024-views-per-audience.md)). The game has to set it when a player joins, and may need to change it: for example, a poker player who is knocked out and keeps watching as a spectator.

## Decision

- **The join hook may return the new player's audience** with the new state ([0026](0026-join-hook-is-a-state-transition.md)).
- **An action may return audience changes** with the new state, for any of the game's players.
- **Otherwise, a player's audience doesn't change.** A new player without an audience gets the default ([0025](0025-default-audiences.md)).

The library stores the result on the player, and records membership after each action ([0024](0024-views-per-audience.md)).

## Alternatives considered

- **A function deriving each player's audience from the state,** for example `audienceOf(state, playerId)`, called by the library after the join hook and after every action. Audiences would always follow the state without extra steps, but the library would call game code for every player on every action, and changes of audience wouldn't be visible in the action that caused them.

## Consequences

- Every audience change is explicit, in the result of the join or the action that caused it.
- A game must remember to change audiences wherever its state changes who sees what. Forgetting leaves a player in their old audience, seeing their old view.
- Game functions that change state return the state, and optionally audience changes, instead of only the state. For the join hook and actions, the exact shape is part of the reference once built.
