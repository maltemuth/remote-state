# Server-initiated actions

Status: Open

## Problem

Every state change is triggered by a client request. A game can't:

- end a turn when its time runs out
- run a clock
- move for a computer player
- trigger an event at a set time or after a delay

## Constraints

- The server runs as a single process ([0006](../decisions/0006-single-process.md)). Timers kept only in memory would be lost on restart, so pending deadlines must be stored.
- A server-initiated change must go through the same path as a client action: the per-game lock, validation, and the recorded history.
- The history must be able to attribute a change to the system. Today every state records a player.

## Options

### A. Actions scheduled by the game

`executeAction` can return actions to run later along with the new state, for example `{ state, schedule: [{ at, action }] }`. The library stores them and runs each one at its time, as the system.

- Precise, and restart-safe once stored.
- The return type of `executeAction` changes, and scheduled actions need cancelling when the state moves on.

### B. A periodic tick

The plugin provides `tick(state, now)`, which the library calls for every active game at a fixed interval. It returns a new state or nothing.

- Simple to write, and time-based rules live in one place.
- It costs work proportional to the number of active games, and timing is only as precise as the interval.

### C. An entry point for the host application

The library offers `server.submitSystemAction(gameId, action)`, and the host application does its own scheduling.

- The smallest library change, and the most flexible.
- Every user has to build scheduling and restart safety themselves.

## Open questions

- How precise must timing be for the games this is meant for?
- How is the system recorded as the author of a state? The history currently needs a player.
- Should the library provide a seeded random number generator, so that computer players and random events can be reproduced from the history?
