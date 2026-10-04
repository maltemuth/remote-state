# 0032. Accepted actions are answered with 201 and no body

Status: Superseded by [0034](0034-action-response-with-sequence.md)
Date: 2026-10-04

## Context

`POST /api/games/:gameId/actions` answers an accepted action with 201 and the acting player's new view. Since the socket sends every update to every connected client, including the one that acted ([0031](0031-socket-sends-state-on-connect.md)), the acting client receives its new view twice, and must use the `sequence` to ignore one copy.

## Decision

An accepted action is answered with 201 Created and no body. All state, including the acting client's own result, arrives through the socket. A rejected action is still answered with 400 and the game's reason.

## Alternatives considered

- **The new view, as before.** The acting client gets its result without waiting for the socket, but twice, and through two channels that must be reconciled.
- **201 with only the new `sequence`.** Tells the acting client which update to wait for. Left out for now; it can be added later without breaking clients that ignore the body.

## Consequences

- Every client applies state the same way, from one channel.
- The acting client needs a socket connection to see the result of its own action; without one, it fetches `GET …/state`.
- The acting client can't tell which socket update its action produced.
