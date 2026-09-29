# 0010. Every game is treated as a game with hidden information

Status: Accepted; the patch mechanism it calls for is settled by [0011](0011-patches-are-diffs-of-views.md)
Date: 2026-09-29

## Context

Games differ in how much they hide: chess hides nothing, a shuffled deck is hidden from everyone, and hands of cards are hidden per player. The [State synchronization](../designs/state-synchronization.md) proposal considered treating games without hidden information differently: broadcasting one message to everyone, allowing client-side prediction, and offering patches only to them. That raised the question of how the library would know a game is open: by the game declaring it, or by inferring it from a missing filter.

## Decision

The library treats every game as a game with hidden information. A game without hidden information is a special case of that, in one of two ways:

- **every player receives the same information,** such as a game where the deck is hidden from everyone
- **every player receives all information,** such as chess

There's no separate mode for such games, and nothing for a game to declare.

## Alternatives considered

- **A separate mode for open games,** declared by the game or inferred from a missing `filterStateForPlayer`. It would unlock broadcasting and client-side prediction in a simple way. But it creates two code paths, and a game wrongly declared as open leaks information. Inferring it is fragile: this repository's tic-tac-toe example is effectively open, but has a filter to show the opponent's ID as `"opponent"`.

## Consequences

- Every feature, patches included, must work for games with hidden information. Offering patches only to open games is ruled out.
- Patches therefore need a mechanism that produces them per player's view. The candidates are in the proposal: a patch filter written by the game, visibility declared by the game, or patches recorded on each player's view.
- Optimizations for identical views, such as broadcasting one message when all views are equal, remain possible, but as internal details that follow from the views, not as a mode.
- Client-side prediction using the game's own rules needs the full state on the client. That's only available where a player's view equals the full state, so it stays open.
