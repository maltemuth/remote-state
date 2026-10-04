# 0036. Hosts pass the initial state; the library knows no game options

Status: Accepted
Date: 2026-10-04

## Context

Hosts create games with `createGame(options)` ([0021](0021-games-created-with-creategame.md)), and the [Game options](../designs/game-options.md) proposal asked how settings such as a board size reach the game. The library would have passed options to the game's `getInitialState`, unread.

But options are part of the game: a setting may be hidden from some players, may change between rounds, or may be fixed for good. All of that is game logic. The library only stores and transports states.

## Decision

- **`createGame` takes the initial state,** for example `createGame(initialState)`, stores it, and returns the new game's ID.
- **The host gets the initial state from the game,** however the game offers it, for example `battleship.initialState({ boardSize: 10 })`.
- **The library has no concept of game options.** A game that has options keeps them in its state. Who sees them is decided by its view filter and audiences ([0024](0024-views-per-audience.md)); whether and how they change is decided by its rules.

## Alternatives considered

- **`createGame(options)`, passed to the game's `getInitialState(options)` by the library,** as in 0021. The library would carry data it never reads, and its API would need a type for it.

## Consequences

- The library no longer calls `getInitialState`; it isn't part of the plugin anymore. How a game is set up is the game's own interface, used by the host.
- Any starting point works: a puzzle position, a rematch built from a finished game's state, a saved game.
- The library trusts the initial state it's given. The host is trusted code in the same process ([0023](0023-no-server-to-server-admit.md)); a state the game's rules can't handle is between the host and the game.
- `createGame` is typed by the plugin's state type, with no new type parameter.
