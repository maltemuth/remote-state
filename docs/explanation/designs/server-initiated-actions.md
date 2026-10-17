# Server-initiated actions

Status: Mostly decided in [0040](../decisions/0040-server-initiated-actions.md) and [0041](../decisions/0041-named-timers.md); restarts are open ([0042](../decisions/0042-timer-restarts-open.md)), and games pause on a restart for now ([0052](../decisions/0052-games-pause-on-restart.md))

## Outcome

Games schedule named timers, returned along with a new state, and hosts can run actions as the system through `act` (options A and C). Scheduling a name again replaces the timer, actions can cancel timers, and due timers run as the player `"system"` through the usual validation. Timers are kept in memory for now; what happens to them on a restart is still open ([0042](../decisions/0042-timer-restarts-open.md)). Until it's decided, every game is offered to the plugin's `onRestart` when the server starts, and a game with timers pauses there until a person resumes it ([0052](../decisions/0052-games-pause-on-restart.md)). A seeded random number generator is left for later.

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

- **Telling the host about changes:** a computer player run by the host through `act` can't learn that it's its turn without polling. Should the host be able to subscribe to a game's transitions?

- **Timers and restarts:** should pending timers be stored, and when the server restarts, run right away, start over with their full duration, or resume with their remaining time? Possibly differently per timer, for example a turn timeout versus a game clock.

- How precise must timing be for the games this is meant for?
- How is the system recorded as the author of a state? The history currently needs a player.
- Should the library provide a seeded random number generator, so that computer players and random events can be reproduced from the history?
