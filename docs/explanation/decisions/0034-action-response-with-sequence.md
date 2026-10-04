# 0034. Accepted actions are answered with 201 and their `sequence`

Status: Accepted
Date: 2026-10-04

## Context

[0032](0032-action-response-without-body.md) answered accepted actions with 201 and no body, so that all state arrives through the socket. The acting client then can't tell which socket update its action produced.

## Decision

An accepted action is answered with 201 Created and `{ "sequence": <number> }`, the `sequence` of the state it produced. The state itself still arrives only through the socket.

## Alternatives considered

- **No body,** as in 0032. The client can't connect its action to the update it caused.
- **The new view,** as originally. The acting client gets its result twice, through two channels.

## Consequences

- The acting client knows which update to wait for, for example to show that its action is pending until that `sequence` arrives.
- Comparing it with the client's own `sequence` tells whether the update has already arrived, or whether there's a gap ([0029](0029-sequence-is-the-cursor.md)).
- All state still arrives through one channel.
