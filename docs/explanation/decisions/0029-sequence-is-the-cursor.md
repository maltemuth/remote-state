# 0029. The `sequence` is the client's cursor

Status: Accepted
Date: 2026-09-29

## Context

A client that catches up asks for what changed since the last state it has ([0009](0009-separate-state-and-update-endpoints.md)), so it needs something that names that state. The [State synchronization](../designs/state-synchronization.md) proposal considered the `sequence` number, an opaque token from the server, and a cursor per player kept by the server.

## Decision

The cursor is the `sequence`: the number every stored state already has, which grows by one per accepted action and is included in every update. The client keeps it, and sends it as `since` when catching up.

## Alternatives considered

- **An opaque token from the server.** The server could later change what it encodes without breaking clients, but nothing needs encoding beyond the `sequence`, and clients couldn't compare or log it.
- **A cursor per player, kept by the server.** The server would know what each player has seen, at the cost of state per player that must be updated on every delivery.

## Consequences

- Clients can tell whether an update is the next one, a duplicate, or leaves a gap, by comparing numbers.
- The server keeps no per-client delivery state.
- The `sequence` is the same for every audience, so it says nothing about what a particular player can see.
