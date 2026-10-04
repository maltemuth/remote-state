# 0047. Reserved keys are dropped from states, with a warning

Status: Accepted
Date: 2026-10-04

## Context

[0046](0046-reserved-keys-documented.md) left keys named `__proto__` and `constructor` in states, and documented that clients applying patches with Immer can't handle them: Immer refuses patches whose path goes through either key, and loses an own `__proto__` key from the values it adds. A game whose keys come from players can produce them without meaning to.

## Decision

The normalization every state and view goes through, a JSON round trip, also drops keys named `__proto__` and `constructor`, at any depth. Clients never see them, so every client can apply every patch. When a state stored by `createGame` or a transition had such keys, the server logs a warning naming the game, the sequence and the keys. Views lose such keys the same way, without a warning.

Keys named `prototype` are kept: Immer only refuses them on functions, which JSON doesn't have.

## Alternatives considered

- **Documenting only,** as in 0046. Leaves clients that receive patches with views that differ from the server's.
- **Sending whole views when patches touch reserved keys.** Keeps the keys, but needs a check of every update's patches, and clients still couldn't patch through them later.
- **Rejecting such states** as an error of the game. Turns a player's choice of name into a failed action.

## Consequences

- A game that means to use a key named `constructor`, such as standings of racing constructors, loses it, and has to name it differently.
- What clients receive matches what's stored, in every format.
- A warning per affected transition shows the game's author where keys were dropped.
