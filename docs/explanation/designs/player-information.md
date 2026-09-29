# Player information for game logic

Status: Open

## Problem

The library records each player's ID, name and role (`admin` or `player`), but the plugin's functions only receive the acting player's ID. A game can't find out how many players have registered, what they're called, or whether someone is the game's creator.

As a result, every game has to track its own players, usually through a `join` action that claims a seat. Both example games do exactly this, with nearly identical code. The library's registration and the game's seating are two separate steps that clients must perform in order, and nothing keeps them consistent.

## Constraints

- Plugin functions should stay plain functions of their inputs, so they remain easy to unit-test.
- The stored state history should keep enough information to explain every past state.
- Any change to the `GamePlugin` signatures is a breaking change for every game.

## Options

### A. A context argument

Every plugin call receives a context object, for example `{ player, players, game }`, with each player's ID, name and role.

- The game sees registrations directly, with no duplicate bookkeeping.
- Rules could depend on data outside the state. The state history alone would no longer explain a past decision, for example who was registered at the time.
- It changes the signature of every plugin function.

### B. Membership kept in the state by the library

The library stores the player list inside each game's state, for example by wrapping it as `{ players, game }`, and the plugin reads it from there.

- The state history is complete, and plugin functions stay pure.
- The library imposes part of the state's structure, and games must not overwrite it.

### C. Registration as a system action

Registering a player produces an action, for example `{ type: "player-registered", player }`, which the library runs through `executeAction` like any other. The game records whatever it needs in its own state.

- One path for every change, and the history is complete.
- Every game must handle the system actions, even if only to ignore them.
- This overlaps with [Game lifecycle](game-lifecycle.md), which would introduce similar events.

### D. Keep the status quo, and add helpers

Games keep their `join` actions, and the library offers a helper for common seat management.

- Nothing breaks.
- The double registration remains.

## Open questions

- Is registering the same as taking part, or are there spectators who register without playing?
- Who decides capacity: should the library reject registrations beyond a game's maximum, or should the game?
- Should the `admin` role mean anything to the game logic, for example the right to start or restart?
