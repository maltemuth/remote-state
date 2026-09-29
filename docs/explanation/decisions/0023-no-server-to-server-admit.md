# 0023. `admit` is only called in-process

Status: Accepted
Date: 2026-09-29

## Context

Hosts admit people by calling `admit` on the server object ([0020](0020-hosts-admit-players-through-codes.md)). A host running in another process couldn't do so without an endpoint for it, which would have to authenticate the host itself.

## Decision

There's no server-to-server endpoint for `admit` or `createGame`. Hosts call them in the same process as the library.

## Alternatives considered

- **An authenticated endpoint for hosts in other processes.** Needs a credential for the host, such as a shared secret, and a way to manage it, for a deployment the library doesn't support ([0006](0006-single-process.md)).

## Consequences

- No host credential exists, and nothing needs to protect one.
- Running the library separately from its host would need a new decision.
