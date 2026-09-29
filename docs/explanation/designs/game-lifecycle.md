# Game lifecycle

Status: Open

## Problem

The library doesn't tell the game logic when things happen outside actions, and it doesn't know what stage a game is in:

- **Players.** Players registering, leaving, or losing their connection aren't reported to the plugin. Only clients get `player-joined` and `player-left` socket events.
- **End of game.** The library can't tell that a game is over. Each plugin has to reject moves in finished games itself. Finished games stay open to new registrations and remain in the database forever.
- **Activity.** `lastActivityAt` is recorded for each player but never used.

## Constraints

- A disconnect is a transport event and can be temporary. It isn't the same as leaving the game.
- Whatever changes state must go through the same path as actions: the per-game lock, validation, and recording in the history.

## Options

### A. Hooks on the plugin

Optional functions such as `onPlayerRegistered`, `onPlayerDisconnected` and `onPlayerLeft` return a new state. The library records each result in the history, attributed to the system rather than a player.

- Explicit, and games only implement what they need.
- Adds several functions to the plugin interface.

### B. System actions

The library feeds lifecycle events into `executeAction` as actions with reserved types, for example `{ type: "system:player-left" }`.

- One path for every change, and nothing new in the interface.
- Every game must recognize and handle the reserved types, and action types become partly owned by the library.

### C. Game status exposed by the plugin

The plugin exposes a function, for example `getStatus(state)`, returning `waiting`, `playing` or `finished`. The library uses it to reject actions in finished games, close registration, and archive or delete old games.

- Gives the library what it needs to manage games, without knowing any rules.
- Combines with A or B, which cover the events.

## Open questions

- Should a disconnect be able to change game state, for example to pause a timed game?
- Can a player leave for good, and does their seat become free?
- How a player is removed, and what happens to their tokens and open sockets. Who may remove a player is the game's decision, in its state and rules ([0022](../decisions/0022-roles-belong-to-game-state.md)).
- What happens to finished games: kept, archived, or deleted after some time?
- Should this share a mechanism with [Player information](player-information.md) option C and [Server-initiated actions](server-initiated-actions.md)?
