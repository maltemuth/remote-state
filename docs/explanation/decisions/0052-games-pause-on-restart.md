# 0052. On a restart, every game is offered to the plugin, which pauses itself

Status: Accepted
Date: 2026-10-17

## Context

Timers are kept in memory only, so a restart loses them ([0042](0042-timer-restarts-open.md)). A game waiting for a timeout then waits until something else happens in it. For a turn timer, that means a table can sit with no clock on the player to act, and the first player to come back and act restarts the clocks of others who may not have reconnected yet.

How timers should behave across a restart in general is still open, in [Server-initiated actions](../designs/server-initiated-actions.md). The games in sight mostly use turn timers, which can start over with their full time, but only once everyone is back: no rule can tell that, so a person has to.

## Decision

- **The plugin gets an optional `onRestart(state)`.** When the library starts on a database that already holds games, it calls `onRestart` with each game's latest state, as the system, under the game's lock, before it serves anything.
- **A game with timers is expected to pause there:** return a paused state, in which the game waits for someone to resume it with an action, typically the host's `act`. Resuming schedules again what the state calls for. A game may instead schedule its timers again in `onRestart`, through `transition`.
- **Returning the state it was given, with no changes, records nothing.** Every game is offered the hook, finished ones too, so most return their state unchanged.
- **A changed state is recorded** like any transition, with action type `restart` and the system as author.
- **A hook that throws is logged at `error`,** and its game is left as it was; the other games are still offered the hook, and the server starts.

## Alternatives considered

- **Storing the names of pending timers, and offering only those games.** Precise, but adds a table, written on every transition that schedules or cancels a timer, to answer a question the game can answer from its own state.
- **The host finds its open games and acts on them after a restart.** Keeps the library out of it, but every host has to keep track of its games and remember to do it.
- **Storing timers and starting them over, or with their remaining time.** That's the open question of 0042; neither is right for a turn whose player hasn't reconnected.

## Consequences

- Every restart reads the latest state of every stored game, which gets slower as games accumulate.
- Restarts don't leave games stuck or running without the people they wait for; resuming is up to a person.
- Games without `onRestart` behave as before: their timers are lost.
- 0042 stands: timers are still kept in memory, and how they should survive a restart remains open.
