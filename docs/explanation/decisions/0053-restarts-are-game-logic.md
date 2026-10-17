# 0053. What a game does on a restart is its own logic

Status: Accepted
Date: 2026-10-17

## Context

[0052](0052-games-pause-on-restart.md) added `onRestart`, and said a game with timers is expected to pause there until a person resumes it. That's one policy, taken from the games in sight, whose turn timers shouldn't run before everyone is back. Other games want something else: a game clock might carry on, a computer opponent might move right away, a game might end. Who counts as back, and who may resume, depends on the game and its host too.

## Decision

- **`onRestart` is a hook, nothing more.** The library offers every stored game to it when it starts, and records what it returns, as 0052 describes. It assumes nothing about what a game does there.
- **Pausing until a person resumes the game is an example,** shown in the docs and the tic-tac-toe example, not something the library expects.
- **Presence is game logic as well.** What it means to be back, and what that changes, is for the game and its host to decide, with actions as for anything else.

## Alternatives considered

- **Keeping 0052's expectation.** It reads as the library's policy, and would steer games without turn timers toward pausing for no reason.

## Consequences

- The docs present pausing as one way to handle a restart, next to scheduling timers again or doing nothing.
- If the library reports connections to the plugin, as the [Game lifecycle](../designs/game-lifecycle.md) proposal discusses, that's a hook like `onRestart`; what a connection means stays with the game.
