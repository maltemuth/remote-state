# 0031. The socket sends the current state on connect

Status: Accepted
Date: 2026-09-29

## Context

A client that connects to the socket needs a starting point before patches make sense: each patch applies only to the view at the `sequence` before it. Either the client fetches the current state over HTTP ([0009](0009-separate-state-and-update-endpoints.md)), or the socket sends it.

## Decision

When a client connects, the socket first sends the player's current whole view with its `sequence`, then live updates in the format the client chose ([0014](0014-immer-patches-only-external-format.md)).

## Alternatives considered

- **The client fetches the state first.** An update can arrive between the fetch and the connection, or before the fetch returns, so every client has to buffer and compare sequences to stitch the two together.
- **The client sends its `sequence` in the handshake,** and the socket answers with the missing patch. Saves resending a whole state after short disconnects, but a reconnecting client can already use `GET …/updates` ([0030](0030-updates-in-one-jump.md)).

## Consequences

- A connected client always has a consistent starting point, with no race between HTTP and the socket.
- Every connection and reconnection costs one whole view.
- The initial state and the following updates are ordered by the same channel, so no update is missed or duplicated between them.
- `GET …/state` remains, for clients that don't use the socket and for reading state outside a connection.
