# 0022. Roles belong to the game's state and rules

Status: Accepted
Date: 2026-09-29

## Context

Players have a `role` field, set to `admin` for a game's creator and `player` otherwise, but nothing checks it. Authorization is the implementer's job ([0016](0016-authentication-in-library-authorization-by-implementer.md)), and games are now created without a first player ([0021](0021-games-created-with-creategame.md)).

## Decision

The library has no roles. Games that need them, such as an admin, a spectator or a dealer, keep them in their own state, and enforce them in their rules, for example in `validateAction` and in the view filter.

## Alternatives considered

- **A `role` field kept by the library for games to use.** The library would store a value it never interprets, which a game could equally keep in its state, next to the rules that give it meaning.

## Consequences

- The `role` column on players is removed, with a migration.
- A game's roles are visible to its rules and view filter like any other state, and change through actions.
- Whether roles are shown to players is the view filter's decision, like any other state.
