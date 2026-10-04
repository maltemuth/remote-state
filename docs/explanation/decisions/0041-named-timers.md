# 0041. Timers are named, stored, and restart with the server

Status: Accepted
Date: 2026-10-04

## Context

Games schedule actions to run later ([0040](0040-server-initiated-actions.md)). A typical use is a turn timeout: every valid move should start a fresh timeout and drop the old one, and a finished game should drop it altogether. Timers must survive a restart of the single server process ([0006](0006-single-process.md)), and a restart shouldn't cost players their time.

## Decision

- **Timers are named, per game.** The join hook or `executeAction` returns timers with a name, a duration and an action, along with the new state. Scheduling a name that's already pending replaces that timer; an action can also cancel timers by name. Both take effect in the same transaction that records the state.
- **A due timer runs its action as the system** ([0040](0040-server-initiated-actions.md)), under the game's lock, only if the timer still exists. Its action goes through `validateAction` like any other, so an outdated action that a game forgot to cancel is rejected and nothing is recorded.
- **Timers are stored** with their duration and due time. The server keeps one in-memory timer per game, for its next due timer.
- **On startup, every pending timer starts over with its full duration.** A turn timeout that was interrupted by a restart gives the player the whole turn again.

## Alternatives considered

- **Only validating when a timer fires,** without cancelling. Simpler for games, but stale timers pile up and wake the server for nothing.
- **Running overdue timers right after a restart.** Players would lose their turn to the downtime.
- **Resuming each timer with its remaining time.** Fairer to the clock than a full restart, but needs the time spent before the restart stored on every change, and still counts time in which players couldn't act.
- **Timers at absolute times.** Useful for events at a set time of day, but they can't restart with their duration.

## Consequences

- A turn timeout is one named timer, rescheduled by every move and cancelled when the game ends.
- Durations restart after downtime, so a game clock that must account for real elapsed time can't rely on timers alone.
- A new table stores pending timers.
