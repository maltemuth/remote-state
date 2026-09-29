# 0001. Actions over HTTP, updates over Socket.IO

Status: Accepted
Date: 2025-08-24, recorded 2026-09-29

## Context

Clients need to do two different things: submit an action and learn whether it was accepted, and hear about state changes caused by other players. This choice was part of the original project plan.

## Decision

Clients submit actions and read state over HTTP. The server pushes state updates over Socket.IO. Clients send nothing over the socket; they only receive.

## Alternatives considered

- **Everything over Socket.IO.** One connection, but actions would need a hand-built request/response layer on top of events (acknowledgements, error codes, timeouts). Debugging and testing tools such as curl and supertest wouldn't work.
- **Everything over HTTP, with polling.** Simple, but players would see other players' moves late, and polling generates constant load.

## Consequences

- Each action gets a clear reply: a status code, the new state, or the reason it was rejected.
- The socket needs authenticating only once, in the handshake, and there's no second way to change state that would need securing.
- Clients need both an HTTP client and a Socket.IO client.
- Updates aren't replayed. A client that reconnects fetches the current state over HTTP; see [Known limitations](../limitations.md).
